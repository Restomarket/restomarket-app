import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  integer,
  index,
  unique,
} from 'drizzle-orm/pg-core';

/**
 * Units of Measure
 *
 * RestoMarket normalized unit reference table.
 * ERP-specific codes are translated via erp_code_mappings (mappingType = 'unit').
 *
 * Examples: KG, L, PCE, BOT, CAR
 */
export const units = pgTable(
  'units',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    // Vendor scoping
    vendorId: varchar('vendor_id', { length: 100 }).notNull(),

    // Identity
    code: varchar('code', { length: 50 }).notNull(),
    label: varchar('label', { length: 100 }).notNull(),

    // Number of decimal places for this unit (e.g. KG=3, PCE=0)
    nbDecimal: integer('nb_decimal').default(0).notNull(),

    // Status
    isActive: boolean('is_active').default(true).notNull(),

    // Audit
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  table => [
    unique('units_vendor_code_unique').on(table.vendorId, table.code),

    index('units_vendor_id_idx').on(table.vendorId),
    index('units_code_idx').on(table.code),
    index('units_is_active_idx').on(table.isActive),
  ],
);

export type Unit = typeof units.$inferSelect;
export type NewUnit = typeof units.$inferInsert;
