import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  numeric,
  boolean,
  integer,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { units } from './units.schema.js';
import { vatRates } from './vat-rates.schema.js';
import { families } from './families.schema.js';
import { subfamilies } from './subfamilies.schema.js';

export const items = pgTable(
  'items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    vendorId: varchar('vendor_id', { length: 100 }).notNull(),
    sku: varchar('sku', { length: 100 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),

    // SEO & Web Publishing (P0)
    slug: varchar('slug', { length: 300 }).notNull(),
    publishOnWeb: boolean('publish_on_web').default(true).notNull(),

    // Units and Classifications (denormalized codes + FK references)
    unitId: uuid('unit_id').references(() => units.id, { onDelete: 'set null' }),
    unitCode: varchar('unit_code', { length: 50 }).notNull(),
    unitLabel: varchar('unit_label', { length: 100 }).notNull(),
    vatRateId: uuid('vat_rate_id').references(() => vatRates.id, { onDelete: 'set null' }),
    vatCode: varchar('vat_code', { length: 50 }).notNull(),
    vatRate: numeric('vat_rate', { precision: 5, scale: 2 }).notNull(),
    familyId: uuid('family_id').references(() => families.id, { onDelete: 'set null' }),
    familyCode: varchar('family_code', { length: 50 }),
    familyLabel: varchar('family_label', { length: 100 }),
    subfamilyId: uuid('subfamily_id').references(() => subfamilies.id, { onDelete: 'set null' }),
    subfamilyCode: varchar('subfamily_code', { length: 50 }),
    subfamilyLabel: varchar('subfamily_label', { length: 100 }),

    // Pricing
    unitPrice: numeric('unit_price', { precision: 10, scale: 2 }),
    priceExclVat: numeric('price_excl_vat', { precision: 10, scale: 2 }).notNull().default('0'),
    priceInclVat: numeric('price_incl_vat', { precision: 10, scale: 2 }).notNull().default('0'),
    vatAmount: numeric('vat_amount', { precision: 10, scale: 2 }).notNull().default('0'),
    catalogPrice: numeric('catalog_price', { precision: 10, scale: 2 }), // ERP list price before customer discounts
    purchasePrice: numeric('purchase_price', { precision: 10, scale: 4 }), // Cost price (for margin calc)
    minimumOrderQuantity: numeric('minimum_order_quantity', { precision: 10, scale: 3 }).default(
      '1',
    ), // B2B MOQ
    lastSyncedFrom: varchar('last_synced_from', { length: 50 }), // Source tracking ("EBP", "Manual")

    // ERP identifier
    erpId: varchar('erp_id', { length: 100 }).notNull().default(''),

    // Stock Management Flags (P0 - ERP Behavior Control)
    manageStock: boolean('manage_stock').default(true).notNull(),
    allowNegativeStock: boolean('allow_negative_stock').default(false).notNull(),
    stockBookingAllowed: boolean('stock_booking_allowed').default(true).notNull(),
    automaticStockBooking: boolean('automatic_stock_booking').default(true).notNull(),
    trackingMode: integer('tracking_mode').default(0).notNull(), // 0=None, 1=Lot, 2=Serial
    pickMovementDisallowedOnTotallyBookedItem: boolean(
      'pick_movement_disallowed_on_totally_booked_item',
    )
      .default(false)
      .notNull(),

    // Aggregated Stock Totals (P1 - Performance)
    totalRealStock: numeric('total_real_stock', { precision: 10, scale: 3 }).default('0').notNull(),
    totalVirtualStock: numeric('total_virtual_stock', { precision: 10, scale: 3 })
      .default('0')
      .notNull(),
    totalReservedQuantity: numeric('total_reserved_quantity', { precision: 10, scale: 3 })
      .default('0')
      .notNull(),

    // Physical Attributes (P1 - Shipping)
    weight: numeric('weight', { precision: 10, scale: 3 }).default('0'),
    weightUnit: varchar('weight_unit', { length: 20 }).default('kg'),
    height: numeric('height', { precision: 10, scale: 2 }).default('0'),
    width: numeric('width', { precision: 10, scale: 2 }).default('0'),
    length: numeric('length', { precision: 10, scale: 2 }).default('0'),
    dimensionUnit: varchar('dimension_unit', { length: 20 }).default('cm'),
    itemsPerPackage: integer('items_per_package'),

    // E-Commerce Metadata (P2 - Oxatis Integration)
    metaTitle: varchar('meta_title', { length: 100 }),
    metaDescription: varchar('meta_description', { length: 200 }),
    metaKeywords: varchar('meta_keywords', { length: 200 }),
    brand: varchar('brand', { length: 50 }),
    daysToShip: integer('days_to_ship'),
    shipPriceTtc: numeric('ship_price_ttc', { precision: 10, scale: 2 }),

    // International Trade (P2)
    originCountryCode: varchar('origin_country_code', { length: 10 }),

    // Retail barcode
    barcode: varchar('barcode', { length: 100 }),
    currency: varchar('currency', { length: 3 }).default('EUR'),
    isActive: boolean('is_active').default(true).notNull(),

    /**
     * EBP Obsolete flag — item is discontinued in ERP.
     * When true: hide from catalog, skip sync writes, retain for history.
     * Maps to EBP Item.Obsolete (bool).
     */
    isObsolete: boolean('is_obsolete').default(false).notNull(),

    /**
     * EBP Vat.Id (GUID) for this item's default VAT rate.
     * Denormalized from erp_vat_rates so order-line payloads can be built
     * without a JOIN at sync time.
     */
    erpVatId: varchar('erp_vat_id', { length: 100 }),

    /**
     * ERP's own last-modified timestamp (NOT our sync time).
     * Used for differential sync: query ERP for items where
     *   ERP.UpdatedAt > items.erpUpdatedAt
     * Without this, every sync requires a full catalog scan.
     */
    erpUpdatedAt: timestamp('erp_updated_at', { withTimezone: true, mode: 'date' }),

    // Sync metadata
    contentHash: varchar('content_hash', { length: 64 }).notNull(),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true, mode: 'date' }).notNull(),

    // Audit
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  table => [
    // P0: Unique constraints (prevent duplicate items per vendor)
    unique('items_vendor_erp_id_unique').on(table.vendorId, table.erpId),
    unique('items_vendor_sku_unique').on(table.vendorId, table.sku),

    // Performance indexes
    index('items_vendor_sku_idx').on(table.vendorId, table.sku),
    index('items_vendor_id_idx').on(table.vendorId),
    index('items_sku_idx').on(table.sku),
    index('items_slug_idx').on(table.slug),
    index('items_unit_id_idx').on(table.unitId),
    index('items_vat_rate_id_idx').on(table.vatRateId),
    index('items_family_id_idx').on(table.familyId),
    index('items_subfamily_id_idx').on(table.subfamilyId),
    index('items_family_code_idx').on(table.familyCode),
    index('items_is_active_idx').on(table.isActive),
    index('items_content_hash_idx').on(table.contentHash),
    index('items_erp_id_idx').on(table.erpId),
    index('items_manage_stock_idx').on(table.manageStock),
    index('items_publish_on_web_idx').on(table.publishOnWeb),
    index('items_total_real_stock_idx').on(table.totalRealStock),
    index('items_total_virtual_stock_idx').on(table.totalVirtualStock),
    index('items_is_obsolete_idx').on(table.isObsolete),
    index('items_erp_updated_at_idx').on(table.erpUpdatedAt),
  ],
);

export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;
