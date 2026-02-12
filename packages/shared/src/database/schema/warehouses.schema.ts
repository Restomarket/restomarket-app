import { pgTable, uuid, varchar, text, timestamp, boolean, index } from 'drizzle-orm/pg-core';

export const warehouses = pgTable(
  'warehouses',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    vendorId: varchar('vendor_id', { length: 100 }).notNull(),
    erpWarehouseId: varchar('erp_warehouse_id', { length: 100 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    code: varchar('code', { length: 50 }),
    address: text('address'),
    city: varchar('city', { length: 100 }),
    postalCode: varchar('postal_code', { length: 20 }),
    country: varchar('country', { length: 2 }).default('FR'),
    isActive: boolean('is_active').default(true).notNull(),
    contentHash: varchar('content_hash', { length: 64 }).notNull(),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true, mode: 'date' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  table => [
    index('warehouses_vendor_erp_id_idx').on(table.vendorId, table.erpWarehouseId),
    index('warehouses_vendor_id_idx').on(table.vendorId),
    index('warehouses_is_active_idx').on(table.isActive),
    index('warehouses_content_hash_idx').on(table.contentHash),
  ],
);

export type Warehouse = typeof warehouses.$inferSelect;
export type NewWarehouse = typeof warehouses.$inferInsert;
