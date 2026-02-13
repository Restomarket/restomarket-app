/**
 * Reconciliation Service
 *
 * Detects and resolves drift between ERP and PostgreSQL using checksum comparison
 * and binary search narrowing.
 */

import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { createHash } from 'crypto';
import { ReconciliationEventsRepository } from '../../../database/adapters';
import { AgentRegistryService } from './agent-registry.service';
import { AgentCommunicationService } from './agent-communication.service';
import type {
  AgentChecksumResponse,
  DriftDetectionResult,
  ReconciliationResult,
  SkuRange,
} from '../interfaces/reconciliation.interface';
import { eq, and, sql } from 'drizzle-orm';
import { items } from '@repo/shared/database/schema';
import { DatabaseConnection } from '@repo/shared';
import { Inject } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../../../database/database.module';

@Injectable()
export class ReconciliationService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly reconciliationRepo: ReconciliationEventsRepository,
    private readonly agentRegistryService: AgentRegistryService,
    private readonly agentCommunicationService: AgentCommunicationService,
    @Inject(DATABASE_CONNECTION) private readonly db: DatabaseConnection,
  ) {
    this.logger.setContext(ReconciliationService.name);
  }

  /**
   * Detect drift for a specific vendor
   */
  async detectDrift(vendorId: string): Promise<DriftDetectionResult | null> {
    const startTime = Date.now();
    this.logger.info(`Starting drift detection for vendor ${vendorId}`);

    try {
      // 1. Get agent checksum
      const agentChecksum = await this.agentCommunicationService.callAgent<AgentChecksumResponse>(
        vendorId,
        'reconciliation',
        '/sync/checksum',
        {},
      );

      if (!agentChecksum) {
        this.logger.warn(`Failed to get checksum from agent ${vendorId}`);
        return null;
      }

      // 2. Compute PostgreSQL checksum
      const dbChecksum = await this.computeDbChecksum(vendorId);

      // 3. Compare checksums
      const hasDrift = agentChecksum.checksum !== dbChecksum;

      const result: DriftDetectionResult = {
        vendorId,
        hasDrift,
        erpChecksum: agentChecksum.checksum,
        dbChecksum,
        itemCount: agentChecksum.itemCount,
        detectedAt: new Date(),
        durationMs: Date.now() - startTime,
      };

      // 4. Log event
      await this.reconciliationRepo.create({
        vendorId,
        eventType: hasDrift ? 'drift_detected' : 'full_checksum',
        summary: {
          erpChecksum: agentChecksum.checksum,
          dbChecksum,
          itemCount: agentChecksum.itemCount,
          hasDrift,
        },
        durationMs: result.durationMs,
        timestamp: new Date(),
      });

      if (hasDrift) {
        this.logger.warn(`Drift detected for vendor ${vendorId}`, {
          erpChecksum: agentChecksum.checksum,
          dbChecksum,
        });

        // Binary search to find drifted items
        const driftedItems = await this.binarySearchSync(vendorId, null, null);
        result.driftedItems = driftedItems;

        // Resolve conflicts
        if (driftedItems.length > 0) {
          await this.resolveConflict(vendorId, driftedItems);
        }
      } else {
        this.logger.info(`No drift detected for vendor ${vendorId}`);
      }

      return result;
    } catch (error) {
      this.logger.error(`Drift detection failed for vendor ${vendorId}`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return null;
    }
  }

  /**
   * Binary search to narrow down drifted items
   */
  async binarySearchSync(
    vendorId: string,
    rangeStart: string | null,
    rangeEnd: string | null,
  ): Promise<string[]> {
    this.logger.debug(`Binary search sync for vendor ${vendorId}`, { rangeStart, rangeEnd });

    try {
      // Get SKU range from database if not provided
      if (!rangeStart || !rangeEnd) {
        const range = await this.getSkuRange(vendorId);
        if (!range) {
          this.logger.warn(`No items found for vendor ${vendorId}`);
          return [];
        }
        rangeStart = range.start;
        rangeEnd = range.end;
      }

      // Get items in range
      const rangeItems = await this.getItemsInRange(vendorId, rangeStart, rangeEnd);

      // If range is small enough (≤10 items), do item-by-item comparison
      if (rangeItems.length <= 10) {
        return this.compareItemsByItem(
          vendorId,
          rangeItems.map(item => item.sku),
        );
      }

      // Split range in half
      const midpoint = Math.floor(rangeItems.length / 2);
      const midSku = rangeItems[midpoint]?.sku;

      if (!midSku) {
        this.logger.warn('Cannot find midpoint SKU');
        return [];
      }

      // Get checksums for each half
      const firstHalfChecksum = await this.computeRangeChecksum(vendorId, rangeStart, midSku);
      const secondHalfChecksum = await this.computeRangeChecksum(vendorId, midSku, rangeEnd);

      // Get agent checksums for each half
      const agentFirstHalf = await this.agentCommunicationService.callAgent<AgentChecksumResponse>(
        vendorId,
        'reconciliation',
        '/sync/checksum',
        { rangeStart, rangeEnd: midSku },
      );

      const agentSecondHalf = await this.agentCommunicationService.callAgent<AgentChecksumResponse>(
        vendorId,
        'reconciliation',
        '/sync/checksum',
        { rangeStart: midSku, rangeEnd },
      );

      const driftedSkus: string[] = [];

      // Recurse on drifted halves
      if (agentFirstHalf && agentFirstHalf.checksum !== firstHalfChecksum) {
        const firstHalfDrift = await this.binarySearchSync(vendorId, rangeStart, midSku);
        driftedSkus.push(...firstHalfDrift);
      }

      if (agentSecondHalf && agentSecondHalf.checksum !== secondHalfChecksum) {
        const secondHalfDrift = await this.binarySearchSync(vendorId, midSku, rangeEnd);
        driftedSkus.push(...secondHalfDrift);
      }

      return driftedSkus;
    } catch (error) {
      this.logger.error(`Binary search failed for vendor ${vendorId}`, {
        error: error instanceof Error ? error.message : String(error),
        rangeStart,
        rangeEnd,
      });
      return [];
    }
  }

  /**
   * Resolve conflicts (ERP always wins)
   */
  async resolveConflict(
    vendorId: string,
    driftedSkus: string[],
  ): Promise<ReconciliationResult | null> {
    const startTime = Date.now();
    this.logger.info(`Resolving conflicts for vendor ${vendorId}`, { count: driftedSkus.length });

    try {
      // Get ERP data for drifted items
      const erpItems = await this.agentCommunicationService.callAgent<unknown[]>(
        vendorId,
        'reconciliation',
        '/sync/items',
        { skus: driftedSkus },
      );

      if (!erpItems || !Array.isArray(erpItems)) {
        this.logger.warn(`Failed to get ERP items for vendor ${vendorId}`);
        return null;
      }

      // ERP always wins - upsert ERP data to PostgreSQL
      let resolvedCount = 0;
      for (const erpItem of erpItems) {
        try {
          // Type assertion - assuming ERP returns item-like objects with required fields
          const itemData = erpItem as {
            sku: string;
            name: string;
            description?: string;
            unitCode: string;
            unitLabel: string;
            vatCode: string;
            vatRate: number;
            familyCode?: string;
            familyLabel?: string;
            subfamilyCode?: string;
            subfamilyLabel?: string;
            unitPrice?: number;
            currency?: string;
          };

          // Generate slug from item name + SKU
          const slug =
            itemData.name
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .replace(/[^a-z0-9\s-]/g, '')
              .replace(/\s+/g, '-')
              .replace(/-+/g, '-')
              .replace(/^-|-$/g, '') +
            '-' +
            itemData.sku.toLowerCase().replace(/[^a-z0-9]/g, '-');

          await this.db
            .insert(items)
            .values({
              vendorId,
              sku: itemData.sku,
              name: itemData.name,
              slug: slug.substring(0, 300),
              description: itemData.description || null,
              unitCode: itemData.unitCode,
              unitLabel: itemData.unitLabel,
              vatCode: itemData.vatCode,
              vatRate: itemData.vatRate.toString(),
              familyCode: itemData.familyCode || null,
              familyLabel: itemData.familyLabel || null,
              subfamilyCode: itemData.subfamilyCode || null,
              subfamilyLabel: itemData.subfamilyLabel || null,
              unitPrice: itemData.unitPrice?.toString() || null,
              currency: itemData.currency || 'EUR',
              lastSyncedAt: new Date(),
              contentHash: this.hashObject(itemData),
            })
            .onConflictDoUpdate({
              target: [items.vendorId, items.sku],
              set: {
                name: sql`excluded.name`,
                description: sql`excluded.description`,
                unitCode: sql`excluded.unit_code`,
                unitLabel: sql`excluded.unit_label`,
                vatCode: sql`excluded.vat_code`,
                vatRate: sql`excluded.vat_rate`,
                familyCode: sql`excluded.family_code`,
                familyLabel: sql`excluded.family_label`,
                subfamilyCode: sql`excluded.subfamily_code`,
                subfamilyLabel: sql`excluded.subfamily_label`,
                unitPrice: sql`excluded.unit_price`,
                currency: sql`excluded.currency`,
                lastSyncedAt: sql`excluded.last_synced_at`,
                contentHash: sql`excluded.content_hash`,
                updatedAt: sql`NOW()`,
              },
            });

          resolvedCount++;
        } catch (error) {
          this.logger.error(`Failed to upsert item ${(erpItem as { sku?: string }).sku}`, {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      const result: ReconciliationResult = {
        vendorId,
        totalItems: driftedSkus.length,
        conflictsFound: driftedSkus.length,
        conflictsResolved: resolvedCount,
        durationMs: Date.now() - startTime,
        startedAt: new Date(startTime),
        completedAt: new Date(),
      };

      // Log reconciliation event
      await this.reconciliationRepo.create({
        vendorId,
        eventType: 'drift_resolved',
        summary: {
          conflictsFound: result.conflictsFound,
          conflictsResolved: result.conflictsResolved,
          skus: driftedSkus,
        },
        durationMs: result.durationMs,
        timestamp: new Date(),
      });

      this.logger.info(`Conflicts resolved for vendor ${vendorId}`, {
        resolved: resolvedCount,
        total: driftedSkus.length,
      });

      return result;
    } catch (error) {
      this.logger.error(`Conflict resolution failed for vendor ${vendorId}`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return null;
    }
  }

  /**
   * Trigger full sync for vendor (public method for admin endpoint)
   */
  async triggerFullSync(vendorId: string): Promise<DriftDetectionResult | null> {
    this.logger.info(`Manual full sync triggered for vendor ${vendorId}`);
    return this.detectDrift(vendorId);
  }

  /**
   * Trigger full sync for all active vendors
   */
  async triggerFullSyncAll(): Promise<DriftDetectionResult[]> {
    this.logger.info('Manual full sync triggered for all vendors');

    const agents = await this.agentRegistryService.getAllAgents();
    const activeAgents = agents.filter(
      agent => agent.status === 'online' || agent.status === 'degraded',
    );

    const results: DriftDetectionResult[] = [];

    for (const agent of activeAgents) {
      const result = await this.detectDrift(agent.vendorId);
      if (result) {
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Compute checksum for all items in database for a vendor
   */
  private async computeDbChecksum(vendorId: string): Promise<string> {
    const dbItems = await this.db
      .select({
        sku: items.sku,
        name: items.name,
        contentHash: items.contentHash,
      })
      .from(items)
      .where(eq(items.vendorId, vendorId))
      .orderBy(items.sku);

    const concatenated = dbItems.map(item => `${item.sku}:${item.contentHash}`).join('|');
    return createHash('sha256').update(concatenated).digest('hex');
  }

  /**
   * Compute checksum for items in a specific SKU range
   */
  private async computeRangeChecksum(
    vendorId: string,
    rangeStart: string,
    rangeEnd: string,
  ): Promise<string> {
    const dbItems = await this.db
      .select({
        sku: items.sku,
        contentHash: items.contentHash,
      })
      .from(items)
      .where(
        and(
          eq(items.vendorId, vendorId),
          sql`${items.sku} >= ${rangeStart} AND ${items.sku} <= ${rangeEnd}`,
        ),
      )
      .orderBy(items.sku);

    const concatenated = dbItems.map(item => `${item.sku}:${item.contentHash}`).join('|');
    return createHash('sha256').update(concatenated).digest('hex');
  }

  /**
   * Get SKU range (min and max) for a vendor
   */
  private async getSkuRange(vendorId: string): Promise<SkuRange | null> {
    const result = await this.db
      .select({
        minSku: sql<string>`MIN(${items.sku})`,
        maxSku: sql<string>`MAX(${items.sku})`,
      })
      .from(items)
      .where(eq(items.vendorId, vendorId));

    const row = result[0];
    if (!row || !row.minSku || !row.maxSku) {
      return null;
    }

    return {
      start: row.minSku,
      end: row.maxSku,
    };
  }

  /**
   * Get items in a specific SKU range
   */
  private async getItemsInRange(vendorId: string, rangeStart: string, rangeEnd: string) {
    return this.db
      .select({
        sku: items.sku,
        name: items.name,
        contentHash: items.contentHash,
      })
      .from(items)
      .where(
        and(
          eq(items.vendorId, vendorId),
          sql`${items.sku} >= ${rangeStart} AND ${items.sku} <= ${rangeEnd}`,
        ),
      )
      .orderBy(items.sku);
  }

  /**
   * Compare items one by one
   */
  private async compareItemsByItem(vendorId: string, skus: string[]): Promise<string[]> {
    const driftedSkus: string[] = [];

    for (const sku of skus) {
      try {
        // Get DB item
        const dbItem = await this.db
          .select()
          .from(items)
          .where(and(eq(items.vendorId, vendorId), eq(items.sku, sku)))
          .limit(1);

        // Get ERP item
        const erpItem = await this.agentCommunicationService.callAgent<{
          sku: string;
          contentHash: string;
        }>(vendorId, 'reconciliation', '/sync/item', { sku });

        if (!dbItem[0] || !erpItem) {
          driftedSkus.push(sku);
          continue;
        }

        // Compare content hashes
        if (dbItem[0].contentHash !== erpItem.contentHash) {
          driftedSkus.push(sku);
        }
      } catch (error) {
        this.logger.error(`Failed to compare item ${sku}`, {
          error: error instanceof Error ? error.message : String(error),
        });
        driftedSkus.push(sku); // Assume drift on error
      }
    }

    return driftedSkus;
  }

  /**
   * Hash object for content comparison
   */
  private hashObject(obj: unknown): string {
    const jsonString = JSON.stringify(obj);
    return createHash('sha256').update(jsonString).digest('hex');
  }
}
