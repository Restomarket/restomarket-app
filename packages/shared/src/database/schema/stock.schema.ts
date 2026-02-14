import { pgTable, uuid, varchar, timestamp, numeric, index, unique } from 'drizzle-orm/pg-core';
import { warehouses } from './warehouses.schema.js';
import { items } from './items.schema.js';

export const stock = pgTable(
  'stock',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    // Composite key: vendor + warehouse + item
    vendorId: varchar('vendor_id', { length: 100 }).notNull(),
    warehouseId: uuid('warehouse_id')
      .notNull()
      .references(() => warehouses.id),
    itemId: uuid('item_id')
      .notNull()
      .references(() => items.id),

    // Stock Quantities (ERP-aligned naming)
    realStock: numeric('real_stock', { precision: 10, scale: 3 }).notNull().default('0'), // Physical stock on hand
    virtualStock: numeric('virtual_stock', { precision: 10, scale: 3 }).notNull().default('0'), // Available for sale (realStock - reserved)
    reservedQuantity: numeric('reserved_quantity', { precision: 10, scale: 3 })
      .notNull()
      .default('0'), // Allocated for orders
    orderedQuantity: numeric('ordered_quantity', { precision: 10, scale: 3 })
      .notNull()
      .default('0'), // Ordered by customers
    incomingQuantity: numeric('incoming_quantity', { precision: 10, scale: 3 })
      .notNull()
      .default('0'), // EBP: CommandesFournisseurs — qty on open supplier purchase orders

    // Stock Valuation (PUMP - Weighted Average Cost)
    pump: numeric('pump', { precision: 10, scale: 4 }).notNull().default('0'), // Weighted avg unit cost
    stockValue: numeric('stock_value', { precision: 12, scale: 2 }).notNull().default('0'), // realStock × pump

    // Stock Thresholds
    minStock: numeric('min_stock', { precision: 10, scale: 3 }).notNull().default('0'), // Reorder point
    maxStock: numeric('max_stock', { precision: 10, scale: 3 }), // Max stock level
    stockToOrderThreshold: numeric('stock_to_order_threshold', { precision: 10, scale: 3 }).default(
      '0',
    ), // Reorder threshold (P0)

    // Sync metadata
    contentHash: varchar('content_hash', { length: 64 }).notNull(),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true, mode: 'date' }).notNull(),
    lastSyncedFrom: varchar('last_synced_from', { length: 50 }), // Source tracking ("EBP", "Manual Adjustment")

    /**
     * ERP's own last-modified timestamp for this stock record.
     * Used for differential sync: query ERP for stock where
     *   ERP.UpdatedAt > stock.erpUpdatedAt
     * Without this, every sync requires a full warehouse stock scan.
     * Maps to EBP: StockItem.UpdatedDate or equivalent audit field.
     */
    erpUpdatedAt: timestamp('erp_updated_at', { withTimezone: true, mode: 'date' }),

    // Audit
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  table => [
    // P0: Unique constraint (one stock record per vendor + warehouse + item)
    unique('stock_vendor_warehouse_item_unique').on(
      table.vendorId,
      table.warehouseId,
      table.itemId,
    ),

    // Performance indexes
    index('stock_vendor_warehouse_item_idx').on(table.vendorId, table.warehouseId, table.itemId),
    index('stock_vendor_id_idx').on(table.vendorId),
    index('stock_warehouse_id_idx').on(table.warehouseId),
    index('stock_item_id_idx').on(table.itemId),
    index('stock_content_hash_idx').on(table.contentHash),
    index('stock_erp_updated_at_idx').on(table.erpUpdatedAt),
  ],
);

export type Stock = typeof stock.$inferSelect;
export type NewStock = typeof stock.$inferInsert;
