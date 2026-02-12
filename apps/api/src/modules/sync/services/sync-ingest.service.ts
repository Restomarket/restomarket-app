import { Injectable, Inject } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { eq, and, sql } from 'drizzle-orm';
import { items, warehouses, stock } from '@repo/shared/database/schema';
import { DATABASE_CONNECTION, type DatabaseConnection } from '../../../database/database.module';
import { ErpMappingService } from './erp-mapping.service';
import { ItemSyncPayloadDto, StockSyncPayloadDto, WarehouseSyncPayloadDto } from '../dto';

export interface SyncResultItem {
  identifier: string; // SKU, erpWarehouseId, or combination
  status: 'processed' | 'skipped' | 'failed';
  reason?: string;
}

export interface SyncResponse {
  processed: number;
  skipped: number;
  failed: number;
  results: SyncResultItem[];
}

@Injectable()
export class SyncIngestService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: DatabaseConnection,
    private readonly erpMappingService: ErpMappingService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(SyncIngestService.name);
  }

  async handleItemChanges(
    vendorId: string,
    itemPayloads: ItemSyncPayloadDto[],
    isBatch = false,
  ): Promise<SyncResponse> {
    const maxBatchSize = isBatch ? 5000 : 500;
    if (itemPayloads.length > maxBatchSize) {
      throw new Error(
        `Maximum ${maxBatchSize} items per ${isBatch ? 'batch' : 'incremental'} sync request`,
      );
    }

    const results: SyncResultItem[] = [];
    const validatedBatch: Array<typeof items.$inferInsert> = [];
    let processedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    this.logger.debug({
      vendorId,
      itemCount: itemPayloads.length,
      isBatch,
      msg: 'Processing item sync request',
    });

    // Process items with chunking for batch mode
    const chunkSize = isBatch ? 50 : itemPayloads.length;
    for (let i = 0; i < itemPayloads.length; i += chunkSize) {
      const chunk = itemPayloads.slice(i, i + chunkSize);

      for (const itemPayload of chunk) {
        try {
          // 1. Check if item exists and compare content hash
          const existingItems = await this.db
            .select()
            .from(items)
            .where(and(eq(items.vendorId, vendorId), eq(items.sku, itemPayload.sku)))
            .limit(1);

          const existingItem = existingItems[0];

          if (existingItem) {
            // Content hash deduplication
            if (existingItem.contentHash === itemPayload.contentHash) {
              skippedCount++;
              results.push({
                identifier: itemPayload.sku,
                status: 'skipped',
                reason: 'no_changes',
              });
              continue;
            }

            // Timestamp staleness check
            const existingTimestamp = existingItem.lastSyncedAt.getTime();
            const newTimestamp = new Date(itemPayload.lastSyncedAt).getTime();
            if (newTimestamp < existingTimestamp) {
              failedCount++;
              results.push({
                identifier: itemPayload.sku,
                status: 'failed',
                reason: `stale_data: existing=${existingItem.lastSyncedAt.toISOString()}, incoming=${itemPayload.lastSyncedAt}`,
              });
              continue;
            }
          }

          // 2. Resolve ERP code mappings
          const unitMapping = await this.erpMappingService.resolve(
            vendorId,
            'unit',
            itemPayload.erpUnitCode,
          );
          if (!unitMapping) {
            failedCount++;
            results.push({
              identifier: itemPayload.sku,
              status: 'failed',
              reason: `unmapped_unit: ${itemPayload.erpUnitCode}`,
            });
            continue;
          }

          const vatMapping = await this.erpMappingService.resolve(
            vendorId,
            'vat',
            itemPayload.erpVatCode,
          );
          if (!vatMapping) {
            failedCount++;
            results.push({
              identifier: itemPayload.sku,
              status: 'failed',
              reason: `unmapped_vat: ${itemPayload.erpVatCode}`,
            });
            continue;
          }

          // Optional mappings (family/subfamily)
          const familyMapping = itemPayload.erpFamilyCode
            ? await this.erpMappingService.resolve(vendorId, 'family', itemPayload.erpFamilyCode)
            : null;

          const subfamilyMapping = itemPayload.erpSubfamilyCode
            ? await this.erpMappingService.resolve(
                vendorId,
                'subfamily',
                itemPayload.erpSubfamilyCode,
              )
            : null;

          // 3. Build upsert record
          validatedBatch.push({
            vendorId,
            sku: itemPayload.sku,
            name: itemPayload.name,
            description: itemPayload.description,
            unitCode: unitMapping.restoCode,
            unitLabel: unitMapping.restoLabel,
            vatCode: vatMapping.restoCode,
            vatRate: vatMapping.restoLabel, // Assuming restoLabel contains the rate for VAT
            familyCode: familyMapping?.restoCode ?? null,
            familyLabel: familyMapping?.restoLabel ?? null,
            subfamilyCode: subfamilyMapping?.restoCode ?? null,
            subfamilyLabel: subfamilyMapping?.restoLabel ?? null,
            unitPrice: itemPayload.unitPrice ? itemPayload.unitPrice.toString() : null,
            currency: itemPayload.currency ?? 'EUR',
            isActive: itemPayload.isActive ?? true,
            contentHash: itemPayload.contentHash,
            lastSyncedAt: new Date(itemPayload.lastSyncedAt),
            updatedAt: new Date(),
          });

          processedCount++;
          results.push({
            identifier: itemPayload.sku,
            status: 'processed',
          });
        } catch (error) {
          failedCount++;
          results.push({
            identifier: itemPayload.sku,
            status: 'failed',
            reason: error instanceof Error ? error.message : 'unknown_error',
          });
          this.logger.error({
            vendorId,
            sku: itemPayload.sku,
            error: error instanceof Error ? error.message : 'Unknown error',
            msg: 'Failed to process item',
          });
        }
      }

      // 4. Batch upsert validated items
      if (validatedBatch.length > 0) {
        try {
          await this.db
            .insert(items)
            .values(validatedBatch)
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
                isActive: sql`excluded.is_active`,
                contentHash: sql`excluded.content_hash`,
                lastSyncedAt: sql`excluded.last_synced_at`,
                updatedAt: sql`NOW()`,
              },
            });

          this.logger.info({
            vendorId,
            upsertedCount: validatedBatch.length,
            msg: 'Items upserted successfully',
          });
        } catch (error) {
          this.logger.error({
            vendorId,
            error: error instanceof Error ? error.message : 'Unknown error',
            msg: 'Failed to upsert items batch',
          });
          throw error;
        }

        validatedBatch.length = 0; // Clear for next chunk
      }
    }

    return {
      processed: processedCount,
      skipped: skippedCount,
      failed: failedCount,
      results,
    };
  }

  async handleStockChanges(
    vendorId: string,
    stockPayloads: StockSyncPayloadDto[],
    isBatch = false,
  ): Promise<SyncResponse> {
    const maxBatchSize = isBatch ? 5000 : 500;
    if (stockPayloads.length > maxBatchSize) {
      throw new Error(
        `Maximum ${maxBatchSize} stock records per ${isBatch ? 'batch' : 'incremental'} sync request`,
      );
    }

    const results: SyncResultItem[] = [];
    const validatedBatch: Array<typeof stock.$inferInsert> = [];
    let processedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    this.logger.debug({
      vendorId,
      stockCount: stockPayloads.length,
      isBatch,
      msg: 'Processing stock sync request',
    });

    // Process stock with chunking for batch mode
    const chunkSize = isBatch ? 50 : stockPayloads.length;
    for (let i = 0; i < stockPayloads.length; i += chunkSize) {
      const chunk = stockPayloads.slice(i, i + chunkSize);

      for (const stockPayload of chunk) {
        try {
          // 1. Resolve item ID from SKU
          const itemRecords = await this.db
            .select({ id: items.id })
            .from(items)
            .where(and(eq(items.vendorId, vendorId), eq(items.sku, stockPayload.itemSku)))
            .limit(1);

          if (itemRecords.length === 0) {
            failedCount++;
            results.push({
              identifier: `${stockPayload.itemSku}@${stockPayload.erpWarehouseId}`,
              status: 'failed',
              reason: `item_not_found: ${stockPayload.itemSku}`,
            });
            continue;
          }

          const itemId = itemRecords[0]!.id;

          // 2. Resolve warehouse ID from ERP warehouse ID
          const warehouseRecords = await this.db
            .select({ id: warehouses.id })
            .from(warehouses)
            .where(
              and(
                eq(warehouses.vendorId, vendorId),
                eq(warehouses.erpWarehouseId, stockPayload.erpWarehouseId),
              ),
            )
            .limit(1);

          if (warehouseRecords.length === 0) {
            failedCount++;
            results.push({
              identifier: `${stockPayload.itemSku}@${stockPayload.erpWarehouseId}`,
              status: 'failed',
              reason: `warehouse_not_found: ${stockPayload.erpWarehouseId}`,
            });
            continue;
          }

          const warehouseId = warehouseRecords[0]!.id;

          // 3. Check existing stock and compare content hash
          const existingStockRecords = await this.db
            .select()
            .from(stock)
            .where(
              and(
                eq(stock.vendorId, vendorId),
                eq(stock.warehouseId, warehouseId),
                eq(stock.itemId, itemId),
              ),
            )
            .limit(1);

          const existingStock = existingStockRecords[0];

          if (existingStock) {
            // Content hash deduplication
            if (existingStock.contentHash === stockPayload.contentHash) {
              skippedCount++;
              results.push({
                identifier: `${stockPayload.itemSku}@${stockPayload.erpWarehouseId}`,
                status: 'skipped',
                reason: 'no_changes',
              });
              continue;
            }

            // Timestamp staleness check
            const existingTimestamp = existingStock.lastSyncedAt.getTime();
            const newTimestamp = new Date(stockPayload.lastSyncedAt).getTime();
            if (newTimestamp < existingTimestamp) {
              failedCount++;
              results.push({
                identifier: `${stockPayload.itemSku}@${stockPayload.erpWarehouseId}`,
                status: 'failed',
                reason: `stale_data: existing=${existingStock.lastSyncedAt.toISOString()}, incoming=${stockPayload.lastSyncedAt}`,
              });
              continue;
            }
          }

          // 4. Build upsert record
          validatedBatch.push({
            vendorId,
            warehouseId,
            itemId,
            quantity: stockPayload.quantity.toString(),
            reservedQuantity: stockPayload.reservedQuantity.toString(),
            availableQuantity: stockPayload.availableQuantity.toString(),
            contentHash: stockPayload.contentHash,
            lastSyncedAt: new Date(stockPayload.lastSyncedAt),
            updatedAt: new Date(),
          });

          processedCount++;
          results.push({
            identifier: `${stockPayload.itemSku}@${stockPayload.erpWarehouseId}`,
            status: 'processed',
          });
        } catch (error) {
          failedCount++;
          results.push({
            identifier: `${stockPayload.itemSku}@${stockPayload.erpWarehouseId}`,
            status: 'failed',
            reason: error instanceof Error ? error.message : 'unknown_error',
          });
          this.logger.error({
            vendorId,
            itemSku: stockPayload.itemSku,
            erpWarehouseId: stockPayload.erpWarehouseId,
            error: error instanceof Error ? error.message : 'Unknown error',
            msg: 'Failed to process stock record',
          });
        }
      }

      // 5. Batch upsert validated stock
      if (validatedBatch.length > 0) {
        try {
          await this.db
            .insert(stock)
            .values(validatedBatch)
            .onConflictDoUpdate({
              target: [stock.vendorId, stock.warehouseId, stock.itemId],
              set: {
                quantity: sql`excluded.quantity`,
                reservedQuantity: sql`excluded.reserved_quantity`,
                availableQuantity: sql`excluded.available_quantity`,
                contentHash: sql`excluded.content_hash`,
                lastSyncedAt: sql`excluded.last_synced_at`,
                updatedAt: sql`NOW()`,
              },
            });

          this.logger.info({
            vendorId,
            upsertedCount: validatedBatch.length,
            msg: 'Stock records upserted successfully',
          });
        } catch (error) {
          this.logger.error({
            vendorId,
            error: error instanceof Error ? error.message : 'Unknown error',
            msg: 'Failed to upsert stock batch',
          });
          throw error;
        }

        validatedBatch.length = 0; // Clear for next chunk
      }
    }

    return {
      processed: processedCount,
      skipped: skippedCount,
      failed: failedCount,
      results,
    };
  }

  async handleWarehouseChanges(
    vendorId: string,
    warehousePayloads: WarehouseSyncPayloadDto[],
    isBatch = false,
  ): Promise<SyncResponse> {
    const maxBatchSize = isBatch ? 5000 : 500;
    if (warehousePayloads.length > maxBatchSize) {
      throw new Error(
        `Maximum ${maxBatchSize} warehouses per ${isBatch ? 'batch' : 'incremental'} sync request`,
      );
    }

    const results: SyncResultItem[] = [];
    const validatedBatch: Array<typeof warehouses.$inferInsert> = [];
    let processedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    this.logger.debug({
      vendorId,
      warehouseCount: warehousePayloads.length,
      isBatch,
      msg: 'Processing warehouse sync request',
    });

    // Process warehouses with chunking for batch mode
    const chunkSize = isBatch ? 50 : warehousePayloads.length;
    for (let i = 0; i < warehousePayloads.length; i += chunkSize) {
      const chunk = warehousePayloads.slice(i, i + chunkSize);

      for (const warehousePayload of chunk) {
        try {
          // 1. Check if warehouse exists and compare content hash
          const existingWarehouses = await this.db
            .select()
            .from(warehouses)
            .where(
              and(
                eq(warehouses.vendorId, vendorId),
                eq(warehouses.erpWarehouseId, warehousePayload.erpWarehouseId),
              ),
            )
            .limit(1);

          const existingWarehouse = existingWarehouses[0];

          if (existingWarehouse) {
            // Content hash deduplication
            if (existingWarehouse.contentHash === warehousePayload.contentHash) {
              skippedCount++;
              results.push({
                identifier: warehousePayload.erpWarehouseId,
                status: 'skipped',
                reason: 'no_changes',
              });
              continue;
            }

            // Timestamp staleness check
            const existingTimestamp = existingWarehouse.lastSyncedAt.getTime();
            const newTimestamp = new Date(warehousePayload.lastSyncedAt).getTime();
            if (newTimestamp < existingTimestamp) {
              failedCount++;
              results.push({
                identifier: warehousePayload.erpWarehouseId,
                status: 'failed',
                reason: `stale_data: existing=${existingWarehouse.lastSyncedAt.toISOString()}, incoming=${warehousePayload.lastSyncedAt}`,
              });
              continue;
            }
          }

          // 2. Build upsert record
          validatedBatch.push({
            vendorId,
            erpWarehouseId: warehousePayload.erpWarehouseId,
            name: warehousePayload.name,
            code: warehousePayload.code,
            address: warehousePayload.address,
            city: warehousePayload.city,
            postalCode: warehousePayload.postalCode,
            country: warehousePayload.country ?? 'FR',
            isActive: warehousePayload.isActive ?? true,
            contentHash: warehousePayload.contentHash,
            lastSyncedAt: new Date(warehousePayload.lastSyncedAt),
            updatedAt: new Date(),
          });

          processedCount++;
          results.push({
            identifier: warehousePayload.erpWarehouseId,
            status: 'processed',
          });
        } catch (error) {
          failedCount++;
          results.push({
            identifier: warehousePayload.erpWarehouseId,
            status: 'failed',
            reason: error instanceof Error ? error.message : 'unknown_error',
          });
          this.logger.error({
            vendorId,
            erpWarehouseId: warehousePayload.erpWarehouseId,
            error: error instanceof Error ? error.message : 'Unknown error',
            msg: 'Failed to process warehouse',
          });
        }
      }

      // 3. Batch upsert validated warehouses
      if (validatedBatch.length > 0) {
        try {
          await this.db
            .insert(warehouses)
            .values(validatedBatch)
            .onConflictDoUpdate({
              target: [warehouses.vendorId, warehouses.erpWarehouseId],
              set: {
                name: sql`excluded.name`,
                code: sql`excluded.code`,
                address: sql`excluded.address`,
                city: sql`excluded.city`,
                postalCode: sql`excluded.postal_code`,
                country: sql`excluded.country`,
                isActive: sql`excluded.is_active`,
                contentHash: sql`excluded.content_hash`,
                lastSyncedAt: sql`excluded.last_synced_at`,
                updatedAt: sql`NOW()`,
              },
            });

          this.logger.info({
            vendorId,
            upsertedCount: validatedBatch.length,
            msg: 'Warehouses upserted successfully',
          });
        } catch (error) {
          this.logger.error({
            vendorId,
            error: error instanceof Error ? error.message : 'Unknown error',
            msg: 'Failed to upsert warehouses batch',
          });
          throw error;
        }

        validatedBatch.length = 0; // Clear for next chunk
      }
    }

    return {
      processed: processedCount,
      skipped: skippedCount,
      failed: failedCount,
      results,
    };
  }
}
