import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  numeric,
  boolean,
  index,
} from 'drizzle-orm/pg-core';

export const items = pgTable(
  'items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    vendorId: varchar('vendor_id', { length: 100 }).notNull(),
    sku: varchar('sku', { length: 100 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    unitCode: varchar('unit_code', { length: 50 }).notNull(),
    unitLabel: varchar('unit_label', { length: 100 }).notNull(),
    vatCode: varchar('vat_code', { length: 50 }).notNull(),
    vatRate: numeric('vat_rate', { precision: 5, scale: 2 }).notNull(),
    familyCode: varchar('family_code', { length: 50 }),
    familyLabel: varchar('family_label', { length: 100 }),
    subfamilyCode: varchar('subfamily_code', { length: 50 }),
    subfamilyLabel: varchar('subfamily_label', { length: 100 }),
    unitPrice: numeric('unit_price', { precision: 10, scale: 2 }),
    // ERP-specific pricing fields (required for full ERP data parity)
    priceExclVat: numeric('price_excl_vat', { precision: 10, scale: 2 }).notNull().default('0'),
    priceInclVat: numeric('price_incl_vat', { precision: 10, scale: 2 }).notNull().default('0'),
    vatAmount: numeric('vat_amount', { precision: 10, scale: 2 }).notNull().default('0'),
    // ERP identifier
    erpId: varchar('erp_id', { length: 100 }).notNull().default(''),
    // Stock management flags
    manageStock: boolean('manage_stock').default(true).notNull(),
    allowNegativeStock: boolean('allow_negative_stock').default(false).notNull(),
    // Retail barcode
    barcode: varchar('barcode', { length: 100 }),
    currency: varchar('currency', { length: 3 }).default('EUR'),
    isActive: boolean('is_active').default(true).notNull(),
    contentHash: varchar('content_hash', { length: 64 }).notNull(),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true, mode: 'date' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  table => [
    index('items_vendor_sku_idx').on(table.vendorId, table.sku),
    index('items_vendor_id_idx').on(table.vendorId),
    index('items_sku_idx').on(table.sku),
    index('items_family_code_idx').on(table.familyCode),
    index('items_is_active_idx').on(table.isActive),
    index('items_content_hash_idx').on(table.contentHash),
    index('items_erp_id_idx').on(table.erpId),
    index('items_manage_stock_idx').on(table.manageStock),
  ],
);

export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;
