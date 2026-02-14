import {
  pgTable,
  uuid,
  varchar,
  boolean,
  numeric,
  timestamp,
  text,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from './organization.schema.js';
import { authUsers } from './auth.schema.js';
import { priceLists } from './price-lists.schema.js';
import { warehouses } from './warehouses.schema.js';

/**
 * Customer ERP Profiles
 *
 * Maps Better Auth entities to vendor ERP customer records.
 *
 * Architecture:
 * - In B2B, an `organization` IS the customer entity (restaurant business).
 *   One profile per (vendorId, organizationId) pair.
 * - `userId` is an optional override for individual/direct buyer accounts
 *   that are not part of an organization (B2C edge case).
 *
 * Lifecycle:
 * - Created when a customer/org is first linked to a vendor's ERP.
 * - Synced from ERP: credit limits, payment terms, assigned price list.
 * - Read at order-creation time to populate ERP payload fields.
 *
 * ERP fields populated here avoid N+1 lookups during order sync:
 *   erpCustomerCode → SaleDocument.CustomerId (String)
 *   erpCustomerId   → SaleDocument.CustomerId (Guid)
 *   erpSettlementModeId → SaleDocument.SettlementModeId
 *   erpVatId        → SaleDocument.VatId (default VAT for this customer)
 *   erpTerritorialityId → SaleDocument.TerritorialityId
 */
export const customerErpProfiles = pgTable(
  'customer_erp_profiles',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    // ── Identity ──────────────────────────────────────────────────────────────

    /** Which vendor's ERP this profile belongs to */
    vendorId: varchar('vendor_id', { length: 100 }).notNull(),

    /**
     * Better Auth organization ID — the B2B customer entity.
     * FK to `organization.id` (Better Auth managed, text PK).
     * Null for individual (non-org) buyers.
     */
    organizationId: text('organization_id').references(() => organizations.id, {
      onDelete: 'cascade',
    }),

    /**
     * Better Auth user ID — for individual / direct buyer accounts.
     * FK to `user.id`. Null when profile belongs to an organization.
     * At least one of organizationId or userId must be set.
     */
    userId: text('user_id').references(() => authUsers.id, { onDelete: 'cascade' }),

    // ── ERP Customer Identifiers ──────────────────────────────────────────────

    /**
     * EBP Customer.Id (Guid) — the ERP's internal UUID for this customer.
     * Used in API calls that require the customer GUID.
     */
    erpCustomerId: varchar('erp_customer_id', { length: 100 }).notNull(),

    /**
     * EBP Customer.Id (String, max 20 chars) — the human-readable customer code.
     * Example: "CL00001", "RESTO_PARIS"
     * ⚠️  CRITICAL: This customer MUST exist in ERP before order import.
     * Used as SaleDocument.CustomerId in order payloads.
     */
    erpCustomerCode: varchar('erp_customer_code', { length: 20 }).notNull(),

    // ── ERP Default Settings (denormalised for fast order-payload construction) ─

    /**
     * Default price list assigned to this customer in ERP.
     * FK to price_lists.id — resolved at order-creation to apply correct pricing.
     */
    defaultPriceListId: uuid('default_price_list_id').references(() => priceLists.id, {
      onDelete: 'set null',
    }),

    /**
     * Default warehouse for this customer's orders.
     * FK to warehouses.id.
     */
    defaultWarehouseId: uuid('default_warehouse_id').references(() => warehouses.id, {
      onDelete: 'set null',
    }),

    /**
     * EBP SettlementMode.Id — payment terms code (max 6 chars in EBP).
     * Examples: "CB" (Credit Card), "VIR" (Bank Transfer), "30J" (Net 30).
     * Copied to SaleDocument.SettlementModeId at order sync.
     */
    erpSettlementModeId: varchar('erp_settlement_mode_id', { length: 10 }),

    /**
     * EBP Vat.Id (Guid) — default VAT rate for this customer.
     * Copied to SaleDocument.VatId when no line-level VAT is set.
     */
    erpVatId: varchar('erp_vat_id', { length: 100 }),

    /**
     * EBP Territoriality.Id (Guid) — VAT territory for this customer.
     * Determines domestic / EU / export VAT rules.
     * Copied to SaleDocument.TerritorialityId.
     */
    erpTerritorialityId: varchar('erp_territoriality_id', { length: 100 }),

    // ── Credit & Commercial ───────────────────────────────────────────────────

    /** Credit limit in the vendor's currency (0 = no limit) */
    creditLimit: numeric('credit_limit', { precision: 12, scale: 2 }).default('0'),

    /** Outstanding balance from ERP (synced periodically, not real-time) */
    outstandingBalance: numeric('outstanding_balance', { precision: 12, scale: 2 }).default('0'),

    /** Whether orders from this customer require manual approval */
    requiresApproval: boolean('requires_approval').notNull().default(false),

    // ── Status ────────────────────────────────────────────────────────────────

    isActive: boolean('is_active').notNull().default(true),

    // ── Sync Metadata ─────────────────────────────────────────────────────────

    contentHash: varchar('content_hash', { length: 64 }),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true, mode: 'date' }),

    /** ERP's own last-modified timestamp for differential sync */
    erpUpdatedAt: timestamp('erp_updated_at', { withTimezone: true, mode: 'date' }),

    // ── Audit ─────────────────────────────────────────────────────────────────

    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  table => [
    // One ERP profile per vendor per organization
    unique('customer_erp_profiles_vendor_org_unique').on(table.vendorId, table.organizationId),
    // One ERP profile per vendor per individual user (direct buyer)
    unique('customer_erp_profiles_vendor_user_unique').on(table.vendorId, table.userId),
    // ERP customer code is unique per vendor
    unique('customer_erp_profiles_vendor_erp_code_unique').on(
      table.vendorId,
      table.erpCustomerCode,
    ),

    index('customer_erp_profiles_vendor_id_idx').on(table.vendorId),
    index('customer_erp_profiles_organization_id_idx').on(table.organizationId),
    index('customer_erp_profiles_user_id_idx').on(table.userId),
    index('customer_erp_profiles_erp_customer_id_idx').on(table.erpCustomerId),
    index('customer_erp_profiles_is_active_idx').on(table.isActive),
  ],
);

// ── Relations ─────────────────────────────────────────────────────────────────

export const customerErpProfilesRelations = relations(customerErpProfiles, ({ one }) => ({
  organization: one(organizations, {
    fields: [customerErpProfiles.organizationId],
    references: [organizations.id],
  }),
  user: one(authUsers, {
    fields: [customerErpProfiles.userId],
    references: [authUsers.id],
  }),
  defaultPriceList: one(priceLists, {
    fields: [customerErpProfiles.defaultPriceListId],
    references: [priceLists.id],
  }),
  defaultWarehouse: one(warehouses, {
    fields: [customerErpProfiles.defaultWarehouseId],
    references: [warehouses.id],
  }),
}));

// ── Type Exports ──────────────────────────────────────────────────────────────

export type CustomerErpProfile = typeof customerErpProfiles.$inferSelect;
export type NewCustomerErpProfile = typeof customerErpProfiles.$inferInsert;
