import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  numeric,
  index,
  unique,
} from 'drizzle-orm/pg-core';

/**
 * EBP Warehouse Types (from Storehouse.Type enum)
 */
export enum WarehouseType {
  Storage = 0, // Storage storehouse (dépôt de stockage)
  Transit = 1, // Transit storehouse (dépôt de transit)
}

export const warehouses = pgTable(
  'warehouses',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    // Vendor identification
    vendorId: varchar('vendor_id', { length: 100 }).notNull(),
    erpWarehouseId: varchar('erp_warehouse_id', { length: 100 }).notNull(),

    // Warehouse details
    code: varchar('code', { length: 50 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),

    // Address
    address: text('address'),
    city: varchar('city', { length: 100 }),
    postalCode: varchar('postal_code', { length: 20 }),
    state: varchar('state', { length: 100 }), // P0: For US/Canada
    country: varchar('country', { length: 2 }).default('FR'),

    // GPS Coordinates (P1 - Distance Calculations)
    latitude: numeric('latitude', { precision: 10, scale: 7 }),
    longitude: numeric('longitude', { precision: 10, scale: 7 }),

    // Status
    isActive: boolean('is_active').default(true).notNull(),
    isDefault: boolean('is_default').default(false).notNull(),
    isMain: boolean('is_main').default(false).notNull(),
    type: integer('type').default(WarehouseType.Storage).notNull(), // 0=Storage, 1=Transit
    multiLocationEnabled: boolean('multi_location_enabled').default(false).notNull(), // P0: Bin/aisle tracking

    // Inventory Management (P1)
    lastInventoryDate: timestamp('last_inventory_date', { withTimezone: true, mode: 'date' }),

    // Sync metadata
    contentHash: varchar('content_hash', { length: 64 }).notNull(),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true, mode: 'date' }).notNull(),

    // Audit
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  table => [
    // P0: Unique constraints (prevent duplicate warehouses per vendor)
    unique('warehouses_vendor_erp_id_unique').on(table.vendorId, table.erpWarehouseId),
    unique('warehouses_vendor_code_unique').on(table.vendorId, table.code),

    // Performance indexes
    index('warehouses_vendor_erp_id_idx').on(table.vendorId, table.erpWarehouseId),
    index('warehouses_vendor_id_idx').on(table.vendorId),
    index('warehouses_is_active_idx').on(table.isActive),
    index('warehouses_content_hash_idx').on(table.contentHash),
  ],
);

export type Warehouse = typeof warehouses.$inferSelect;
export type NewWarehouse = typeof warehouses.$inferInsert;
