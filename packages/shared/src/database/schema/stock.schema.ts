import { pgTable, uuid, varchar, timestamp, numeric, index } from 'drizzle-orm/pg-core';

export const stock = pgTable(
  'stock',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    vendorId: varchar('vendor_id', { length: 100 }).notNull(),
    warehouseId: uuid('warehouse_id').notNull(),
    itemId: uuid('item_id').notNull(),
    quantity: numeric('quantity', { precision: 10, scale: 2 }).notNull().default('0'),
    reservedQuantity: numeric('reserved_quantity', { precision: 10, scale: 2 })
      .notNull()
      .default('0'),
    availableQuantity: numeric('available_quantity', { precision: 10, scale: 2 })
      .notNull()
      .default('0'),
    contentHash: varchar('content_hash', { length: 64 }).notNull(),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true, mode: 'date' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  table => [
    index('stock_vendor_warehouse_item_idx').on(table.vendorId, table.warehouseId, table.itemId),
    index('stock_vendor_id_idx').on(table.vendorId),
    index('stock_warehouse_id_idx').on(table.warehouseId),
    index('stock_item_id_idx').on(table.itemId),
    index('stock_content_hash_idx').on(table.contentHash),
  ],
);

export type Stock = typeof stock.$inferSelect;
export type NewStock = typeof stock.$inferInsert;
