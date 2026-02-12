import { and, count, desc, eq, lt, sql } from 'drizzle-orm';
import { BaseRepository } from '../base/base.repository.js';
import { reconciliationEvents } from '../../schema/index.js';
import type { ReconciliationEvent, NewReconciliationEvent } from '../../../types/database.types.js';

/**
 * Reconciliation Events Repository Base
 *
 * Framework-agnostic repository for ERP reconciliation audit trail.
 * Handles event logging, metrics, and cleanup.
 */
export class ReconciliationEventsRepositoryBase extends BaseRepository<
  typeof reconciliationEvents
> {
  /**
   * Create reconciliation event
   */
  async create(data: NewReconciliationEvent): Promise<ReconciliationEvent | null> {
    try {
      const [event] = await this.db.insert(reconciliationEvents).values(data).returning();

      if (!event) {
        this.logger.error('Failed to create reconciliation event - no row returned', {
          vendorId: data.vendorId,
          eventType: data.eventType,
        });
        return null;
      }

      this.logger.info('Reconciliation event created', {
        eventId: event.id,
        vendorId: event.vendorId,
        eventType: event.eventType,
      });
      return event;
    } catch (error) {
      this.handleError('CREATE', error, {
        vendorId: data.vendorId,
        eventType: data.eventType,
      });
      return null;
    }
  }

  /**
   * Find events by vendor (paginated)
   */
  async findByVendor(
    vendorId: string,
    page = 1,
    limit = 50,
  ): Promise<{ data: ReconciliationEvent[]; total: number }> {
    try {
      const whereClause = eq(reconciliationEvents.vendorId, vendorId);

      const [data, countResult] = await Promise.all([
        this.db
          .select()
          .from(reconciliationEvents)
          .where(whereClause)
          .orderBy(desc(reconciliationEvents.timestamp))
          .limit(limit)
          .offset((page - 1) * limit),

        this.db.select({ value: count() }).from(reconciliationEvents).where(whereClause),
      ]);

      const total = Number(countResult[0]?.value ?? 0);

      return { data, total };
    } catch (error) {
      this.handleError('FIND_BY_VENDOR', error, { vendorId, page, limit });
      return { data: [], total: 0 };
    }
  }

  /**
   * Find recent events for a vendor (limited, no pagination)
   */
  async findRecent(vendorId: string, limit = 10): Promise<ReconciliationEvent[]> {
    try {
      const events = await this.db
        .select()
        .from(reconciliationEvents)
        .where(eq(reconciliationEvents.vendorId, vendorId))
        .orderBy(desc(reconciliationEvents.timestamp))
        .limit(limit);

      return events;
    } catch (error) {
      this.handleError('FIND_RECENT', error, { vendorId, limit });
      return [];
    }
  }

  /**
   * Delete events older than specified days
   */
  async deleteOlderThan(days: number): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const result = await this.db
        .delete(reconciliationEvents)
        .where(lt(reconciliationEvents.timestamp, cutoffDate))
        .returning({ id: reconciliationEvents.id });

      this.logger.info('Old reconciliation events deleted', { count: result.length, days });
      return result.length;
    } catch (error) {
      this.handleError('DELETE_OLDER_THAN', error, { days });
      return 0;
    }
  }

  /**
   * Get reconciliation metrics for a vendor
   */
  async getMetrics(vendorId: string): Promise<{
    totalEvents: number;
    driftDetected: number;
    driftResolved: number;
    fullChecksums: number;
    incrementalSyncs: number;
    avgDurationMs: number;
    lastRun: Date | null;
  }> {
    try {
      const [result] = await this.db
        .select({
          total: count(),
          driftDetected: sql<number>`count(*) filter (where ${reconciliationEvents.eventType} = 'drift_detected')`,
          driftResolved: sql<number>`count(*) filter (where ${reconciliationEvents.eventType} = 'drift_resolved')`,
          fullChecksums: sql<number>`count(*) filter (where ${reconciliationEvents.eventType} = 'full_checksum')`,
          incrementalSyncs: sql<number>`count(*) filter (where ${reconciliationEvents.eventType} = 'incremental_sync')`,
          avgDuration: sql<number>`avg(${reconciliationEvents.durationMs})`,
          lastTimestamp: sql<Date>`max(${reconciliationEvents.timestamp})`,
        })
        .from(reconciliationEvents)
        .where(eq(reconciliationEvents.vendorId, vendorId));

      if (!result) {
        return {
          totalEvents: 0,
          driftDetected: 0,
          driftResolved: 0,
          fullChecksums: 0,
          incrementalSyncs: 0,
          avgDurationMs: 0,
          lastRun: null,
        };
      }

      return {
        totalEvents: Number(result.total),
        driftDetected: Number(result.driftDetected),
        driftResolved: Number(result.driftResolved),
        fullChecksums: Number(result.fullChecksums),
        incrementalSyncs: Number(result.incrementalSyncs),
        avgDurationMs: result.avgDuration ? Math.round(Number(result.avgDuration)) : 0,
        lastRun: result.lastTimestamp || null,
      };
    } catch (error) {
      this.handleError('GET_METRICS', error, { vendorId });
      return {
        totalEvents: 0,
        driftDetected: 0,
        driftResolved: 0,
        fullChecksums: 0,
        incrementalSyncs: 0,
        avgDurationMs: 0,
        lastRun: null,
      };
    }
  }

  /**
   * Count events by type for a vendor
   */
  async countByType(vendorId: string, eventType: string): Promise<number> {
    try {
      const [result] = await this.db
        .select({ value: count() })
        .from(reconciliationEvents)
        .where(
          and(
            eq(reconciliationEvents.vendorId, vendorId),
            eq(reconciliationEvents.eventType, eventType),
          ),
        );

      return Number(result?.value ?? 0);
    } catch (error) {
      this.handleError('COUNT_BY_TYPE', error, { vendorId, eventType });
      return 0;
    }
  }

  /**
   * Find event by ID
   */
  async findById(id: string): Promise<ReconciliationEvent | null> {
    try {
      const [event] = await this.db
        .select()
        .from(reconciliationEvents)
        .where(eq(reconciliationEvents.id, id))
        .limit(1);

      return event ?? null;
    } catch (error) {
      this.handleError('FIND_BY_ID', error, { id });
      return null;
    }
  }
}
