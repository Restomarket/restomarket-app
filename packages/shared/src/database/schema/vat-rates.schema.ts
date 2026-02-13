import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  numeric,
  index,
  unique,
} from 'drizzle-orm/pg-core';

/**
 * VAT Rates
 *
 * RestoMarket normalized VAT rate reference table.
 * ERP-specific codes are translated via erp_code_mappings (mappingType = 'vat').
 *
 * Examples: TVA20 (20%), TVA5.5 (5.50%), TVA10 (10%)
 */
export const vatRates = pgTable(
  'vat_rates',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    // Vendor scoping
    vendorId: varchar('vendor_id', { length: 100 }).notNull(),

    // Identity
    code: varchar('code', { length: 50 }).notNull(),
    label: varchar('label', { length: 100 }).notNull(),

    // VAT rate as percentage (e.g. 20.00 for 20%)
    rate: numeric('rate', { precision: 5, scale: 2 }).notNull(),

    // Status
    isActive: boolean('is_active').default(true).notNull(),

    // Audit
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  table => [
    unique('vat_rates_vendor_code_unique').on(table.vendorId, table.code),

    index('vat_rates_vendor_id_idx').on(table.vendorId),
    index('vat_rates_code_idx').on(table.code),
    index('vat_rates_is_active_idx').on(table.isActive),
  ],
);

export type VatRate = typeof vatRates.$inferSelect;
export type NewVatRate = typeof vatRates.$inferInsert;
