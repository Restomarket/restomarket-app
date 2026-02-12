import { and, eq, sql } from 'drizzle-orm';
import { BaseRepository } from '../base/base.repository.js';
import { stock } from '../../schema/index.js';
import type { Stock, NewStock } from '../../schema/index.js';

/**
 * Stock Repository Base
 *
 * Framework-agnostic repository for inventory/stock management.
 */
export class StockRepositoryBase extends BaseRepository<typeof stock> {
  async findByVendorWarehouseItem(
    vendorId: string,
    warehouseId: string,
    itemId: string,
  ): Promise<Stock | null> {
    try {
      const [entry] = await this.db
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
      return entry ?? null;
    } catch (error) {
      this.handleError('FIND_BY_VENDOR_WAREHOUSE_ITEM', error, { vendorId, warehouseId, itemId });
      return null;
    }
  }

  async updateQuantity(
    vendorId: string,
    warehouseId: string,
    itemId: string,
    quantity: string,
  ): Promise<Stock | null> {
    try {
      const availableQuantity = sql`${quantity}::numeric - COALESCE(reserved_quantity, 0)`;
      const [entry] = await this.db
        .update(stock)
        .set({
          quantity: quantity,
          availableQuantity: availableQuantity,
          updatedAt: this.getUpdatedTimestamp(),
        })
        .where(
          and(
            eq(stock.vendorId, vendorId),
            eq(stock.warehouseId, warehouseId),
            eq(stock.itemId, itemId),
          ),
        )
        .returning();
      return entry ?? null;
    } catch (error) {
      this.handleError('UPDATE_QUANTITY', error, { vendorId, warehouseId, itemId });
      return null;
    }
  }

  async upsertBatch(records: NewStock[]): Promise<Stock[]> {
    try {
      const result = await this.db
        .insert(stock)
        .values(records)
        .onConflictDoUpdate({
          target: [stock.vendorId, stock.warehouseId, stock.itemId],
          set: {
            quantity: sql`excluded.quantity`,
            reservedQuantity: sql`excluded.reserved_quantity`,
            availableQuantity: sql`excluded.available_quantity`,
            orderedQuantity: sql`excluded.ordered_quantity`,
            pump: sql`excluded.pump`,
            stockValue: sql`excluded.stock_value`,
            minStock: sql`excluded.min_stock`,
            maxStock: sql`excluded.max_stock`,
            contentHash: sql`excluded.content_hash`,
            lastSyncedAt: sql`excluded.last_synced_at`,
            updatedAt: this.getUpdatedTimestamp(),
          },
        })
        .returning();
      return result;
    } catch (error) {
      this.handleError('UPSERT_BATCH', error, { count: records.length });
      return [];
    }
  }
}
