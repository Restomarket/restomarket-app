import { pgTable, uuid, varchar, boolean, timestamp, index, unique } from 'drizzle-orm/pg-core';

/**
 * Product Families
 *
 * RestoMarket normalized top-level product classification.
 * ERP-specific codes are translated via erp_code_mappings (mappingType = 'family').
 *
 * Examples: VIANDES, POISSONS, FRUITS, BOISSONS
 */
export const families = pgTable(
  'families',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    // Vendor scoping
    vendorId: varchar('vendor_id', { length: 100 }).notNull(),

    // Identity
    code: varchar('code', { length: 50 }).notNull(),
    label: varchar('label', { length: 100 }).notNull(),

    // Status
    isActive: boolean('is_active').default(true).notNull(),

    // Audit
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  table => [
    unique('families_vendor_code_unique').on(table.vendorId, table.code),

    index('families_vendor_id_idx').on(table.vendorId),
    index('families_code_idx').on(table.code),
    index('families_is_active_idx').on(table.isActive),
  ],
);

export type Family = typeof families.$inferSelect;
export type NewFamily = typeof families.$inferInsert;
