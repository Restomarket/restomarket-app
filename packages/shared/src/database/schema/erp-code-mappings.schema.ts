import { pgTable, uuid, varchar, boolean, timestamp, index, unique } from 'drizzle-orm/pg-core';
import { units } from './units.schema.js';
import { vatRates } from './vat-rates.schema.js';
import { families } from './families.schema.js';
import { subfamilies } from './subfamilies.schema.js';

/**
 * ERP Code Mappings Schema
 *
 * Maps vendor-specific ERP codes to RestoMarket standardized codes.
 * Used during item ingest to translate units, VAT codes, families, subfamilies.
 *
 * Mapping types:
 * - unit: ERP 'KG' → RestoMarket 'kilogram' (unitId FK)
 * - vat: ERP 'TVA20' → RestoMarket 'vat_20' (vatRateId FK)
 * - family: ERP 'FRUITS' → RestoMarket 'fresh_produce' (familyId FK)
 * - subfamily: ERP 'POMME' → RestoMarket 'apples' (subfamilyId FK)
 *
 * Cached in-memory with 5min TTL (max 10,000 entries per vendor, LRU eviction)
 */

export const erpCodeMappings = pgTable(
  'erp_code_mappings',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    // Vendor identification
    vendorId: varchar('vendor_id', { length: 100 }).notNull(),

    // Mapping type: 'unit', 'vat', 'family', 'subfamily'
    mappingType: varchar('mapping_type', { length: 20 }).notNull(),

    // ERP-side code (vendor's naming)
    erpCode: varchar('erp_code', { length: 100 }).notNull(),

    // RestoMarket standardized code
    restoCode: varchar('resto_code', { length: 100 }).notNull(),

    // RestoMarket display label (for UI)
    restoLabel: varchar('resto_label', { length: 255 }).notNull(),

    // ── Resolved FK to the target reference table ───────────────────────────
    // Only ONE of these is set per row, based on mappingType.
    // Allows JOINs from mapping → reference table without string lookups.
    unitId: uuid('unit_id').references(() => units.id, { onDelete: 'set null' }),
    vatRateId: uuid('vat_rate_id').references(() => vatRates.id, { onDelete: 'set null' }),
    familyId: uuid('family_id').references(() => families.id, { onDelete: 'set null' }),
    subfamilyId: uuid('subfamily_id').references(() => subfamilies.id, { onDelete: 'set null' }),

    // Soft delete flag (deactivated mappings retained for audit)
    isActive: boolean('is_active').notNull().default(true),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  table => [
    // Unique constraint: one ERP code per type per vendor
    unique('erp_code_mappings_vendor_type_erp_unique').on(
      table.vendorId,
      table.mappingType,
      table.erpCode,
    ),

    // Composite index for mapping resolution queries (vendor + type + ERP code)
    index('erp_code_mappings_vendor_type_idx').on(table.vendorId, table.mappingType),

    // Index for active mappings (filtered queries)
    index('erp_code_mappings_active_idx').on(table.isActive),

    // FK indexes for resolved references
    index('erp_code_mappings_unit_id_idx').on(table.unitId),
    index('erp_code_mappings_vat_rate_id_idx').on(table.vatRateId),
    index('erp_code_mappings_family_id_idx').on(table.familyId),
    index('erp_code_mappings_subfamily_id_idx').on(table.subfamilyId),
  ],
);

// ============================================
// Type Exports
// ============================================
export type ErpCodeMapping = typeof erpCodeMappings.$inferSelect;
export type NewErpCodeMapping = typeof erpCodeMappings.$inferInsert;
