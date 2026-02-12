import { pgTable, uuid, varchar, boolean, timestamp, index, unique } from 'drizzle-orm/pg-core';

/**
 * ERP Code Mappings Schema
 *
 * Maps vendor-specific ERP codes to RestoMarket standardized codes.
 * Used during item ingest to translate units, VAT codes, families, subfamilies.
 *
 * Mapping types:
 * - unit: e.g., ERP 'KG' → RestoMarket 'kilogram'
 * - vat: e.g., ERP 'TVA20' → RestoMarket 'vat_20'
 * - family: e.g., ERP 'FRUITS' → RestoMarket 'fresh_produce'
 * - subfamily: e.g., ERP 'POMME' → RestoMarket 'apples'
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
  ],
);

// ============================================
// Type Exports
// ============================================
export type ErpCodeMapping = typeof erpCodeMappings.$inferSelect;
export type NewErpCodeMapping = typeof erpCodeMappings.$inferInsert;
