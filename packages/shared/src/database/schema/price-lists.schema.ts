import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  numeric,
  boolean,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { items } from './items.schema.js';

/**
 * Price Lists Schema
 *
 * B2B customer-specific or tier pricing synced from ERP.
 * Two tables: priceLists (list metadata) + priceListItems (SKU-level pricing with volume breaks).
 */
export const priceLists = pgTable(
  'price_lists',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    vendorId: varchar('vendor_id', { length: 100 }).notNull(),
    erpPriceListId: varchar('erp_price_list_id', { length: 100 }).notNull(), // ERP internal ID

    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),

    isDefault: boolean('is_default').default(false).notNull(),
    validFrom: timestamp('valid_from', { withTimezone: true, mode: 'date' }),
    validTo: timestamp('valid_to', { withTimezone: true, mode: 'date' }),
    currencyCode: varchar('currency_code', { length: 3 }).default('EUR').notNull(),
    isActive: boolean('is_active').default(true).notNull(),

    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  table => [
    unique('price_lists_vendor_erp_id_unique').on(table.vendorId, table.erpPriceListId),
    index('price_lists_vendor_id_idx').on(table.vendorId),
    index('price_lists_is_active_idx').on(table.isActive),
  ],
);

export const priceListItems = pgTable(
  'price_list_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    priceListId: uuid('price_list_id')
      .notNull()
      .references(() => priceLists.id, { onDelete: 'cascade' }),
    itemId: uuid('item_id').references(() => items.id),
    sku: varchar('sku', { length: 100 }).notNull(),

    // Pricing
    priceExclVat: numeric('price_excl_vat', { precision: 10, scale: 4 }).notNull(),
    priceInclVat: numeric('price_incl_vat', { precision: 10, scale: 4 }),

    // Volume breaks
    minQuantity: numeric('min_quantity', { precision: 10, scale: 3 }).default('1').notNull(),
    discountRate: numeric('discount_rate', { precision: 5, scale: 2 }).default('0').notNull(),

    // Validity window (can override the list-level dates)
    validFrom: timestamp('valid_from', { withTimezone: true, mode: 'date' }),
    validTo: timestamp('valid_to', { withTimezone: true, mode: 'date' }),
    isActive: boolean('is_active').default(true).notNull(),

    // Sync metadata
    contentHash: varchar('content_hash', { length: 64 }),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true, mode: 'date' }),

    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  table => [
    unique('price_list_items_list_sku_qty_unique').on(
      table.priceListId,
      table.sku,
      table.minQuantity,
    ),
    index('price_list_items_price_list_id_idx').on(table.priceListId),
    index('price_list_items_item_id_idx').on(table.itemId),
    index('price_list_items_sku_idx').on(table.sku),
    index('price_list_items_is_active_idx').on(table.isActive),
  ],
);

export type PriceList = typeof priceLists.$inferSelect;
export type NewPriceList = typeof priceLists.$inferInsert;
export type PriceListItem = typeof priceListItems.$inferSelect;
export type NewPriceListItem = typeof priceListItems.$inferInsert;
