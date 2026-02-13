import { pgTable, uuid, varchar, boolean, timestamp, index, unique } from 'drizzle-orm/pg-core';
import { families } from './families.schema.js';

/**
 * Product Subfamilies
 *
 * RestoMarket normalized second-level product classification under Family.
 * ERP-specific codes are translated via erp_code_mappings (mappingType = 'subfamily').
 *
 * Examples: BOEUF, SAUMON, AGRUMES
 */
export const subfamilies = pgTable(
  'subfamilies',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    // Vendor scoping
    vendorId: varchar('vendor_id', { length: 100 }).notNull(),

    // Parent family
    familyId: uuid('family_id')
      .notNull()
      .references(() => families.id, { onDelete: 'cascade' }),

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
    unique('subfamilies_vendor_code_unique').on(table.vendorId, table.code),

    index('subfamilies_vendor_id_idx').on(table.vendorId),
    index('subfamilies_family_id_idx').on(table.familyId),
    index('subfamilies_code_idx').on(table.code),
    index('subfamilies_is_active_idx').on(table.isActive),
  ],
);

export type Subfamily = typeof subfamilies.$inferSelect;
export type NewSubfamily = typeof subfamilies.$inferInsert;
