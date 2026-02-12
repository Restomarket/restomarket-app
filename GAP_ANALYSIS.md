# RestoMarket ERP Sync — Gap Analysis & Implementation Refinement

> **Analysis Date:** 2026-02-12  
> **Status:** COMPREHENSIVE REVIEW  
> **Purpose:** Compare old Convex documentation with current NestJS implementation to identify gaps and refine the plan

---

## Executive Summary

### Current Implementation Status

**What EXISTS:**

- ✅ Business entity schemas: `items`, `warehouses`, `stock` (WITH `content_hash` + `last_synced_at`)
- ✅ Sync schemas: `sync_jobs`, `agent_registry`, `erp_code_mappings`, `dead_letter_queue`, `reconciliation_events`
- ✅ Base repositories in `packages/shared/` for all sync tables
- ✅ Sync services: `SyncIngestService`, `AgentRegistryService`, `ErpMappingService`, `CircuitBreakerService`, etc.
- ✅ Controllers: `AgentIngestController`, `AgentRegistryController`, `AgentCallbackController`, etc.
- ✅ BullMQ processors: `OrderSyncProcessor`
- ✅ Health indicators: Redis, BullMQ, Database, Agent
- ✅ Scheduler: `SyncSchedulerService` with all 6 cron jobs
- ✅ Tasks 1-17 marked as "passing" in `IMPLEMENTATION_PLAN.md`

**What's MISSING/INCOMPLETE:**

- ❌ **Orders schema** — No `orders` or `order_items` tables found
- ❌ **Orders module** — No orders service/controller implementation
- ❌ **Stock/Warehouse repositories** — Base repos for items/warehouses/stock missing
- ⚠️ **Spec inconsistency** — REQ-2 says "items, stock, warehouses tables do NOT exist yet" but they DO exist
- ❌ **DevOps tasks** — Tasks 18-22 not started (Docker tagging, CI/CD, deployment, E2E tests)

---

## Critical Gap: Orders Schema & Module

### What the Old Documentation Says

The old schema comparison document describes comprehensive `orders` and `order_items` tables with:

**Orders table (~40 fields):**

- Document identity: `order_number`, `document_date`, `document_type`, `validation_state`
- Customer info: `vendor_id`, `customer_id`, `erp_customer_code`
- Addresses: `billing_address` (JSONB), `shipping_address` (JSONB)
- Logistics: `warehouse_id`, `delivery_date`, `delivery_state`
- Financial: `amount_vat_excluded`, `discount_rate`, `shipping_amount_vat_excluded`, `vat_amount`, `amount_vat_included`
- Payment: `payment_method`, `payment_status`, `payment_provider`, `payment_transaction_id`
- **ERP sync fields**: `erp_reference`, `erp_status`, `erp_document_id`, `erp_serial_id`, `erp_vat_id`, `erp_territoriality_id`, `erp_settlement_mode_id`, `erp_synced_at`, `erp_sync_error`, `content_hash`
- Job tracking: `reservation_job_id` (FK to sync_jobs)

**Order Items table (~30 fields):**

- Line identity: `order_id` (FK), `line_order`, `sku`, `item_id` (FK)
- Quantity tracking: `quantity`, `ordered_quantity`, `delivered_quantity`, `remaining_quantity_to_deliver`, `returned_quantity`, `invoiced_quantity`, `remaining_quantity_to_invoice`
- Pricing: `unit_price`, `net_price_vat_excluded`, `net_amount_vat_included`, `discount_rate`, `vat_rate`, `vat_amount`
- Warehouse: `warehouse_id` (FK), `manage_stock`
- Delivery: `delivery_date`, `delivery_state`
- **Reservation tracking**: `reservation_status`, `reserved_at`, `reservation_expires_at`
- ERP sync: `erp_line_id`, `erp_synced_at`, `stock_movement_id`

### What's Currently Implemented

**Grep search result:** No `orders` schema found in `packages/shared/src/database/schema/`

**Implication:** The order sync flow (`OrderSyncProcessor`) exists but has no database table to operate on!

### Impact on Current Implementation

**Task 11 (Order Sync Processor + Callback)** is marked as "passing" but:

1. No `orders` table exists to store order data
2. No `order_items` table exists to store line items
3. `sync_jobs.postgres_order_id` has no FK target (orphaned field)
4. `OrderSyncProcessor` would fail at runtime when trying to query/update orders

**This is a BLOCKING issue for production deployment.**

---

## Gap 1: Missing Business Entity Repositories

### What the Old Documentation Says

The repository pattern requires:

1. Base repository in `packages/shared/src/database/repositories/<entity>/<entity>.repository.base.ts`
2. NestJS adapter in `apps/api/src/database/adapters/nestjs-<entity>.repository.ts`

### Current State

**Sync repositories:** ✅ All exist (agent-registry, sync-jobs, erp-code-mappings, dead-letter-queue, reconciliation-events)

**Business entity repositories:** ❌ Missing

- No `packages/shared/src/database/repositories/items/items.repository.base.ts`
- No `packages/shared/src/database/repositories/warehouses/warehouses.repository.base.ts`
- No `packages/shared/src/database/repositories/stock/stock.repository.base.ts`

### Why This Matters

`SyncIngestService` currently uses **raw Drizzle queries** instead of repositories:

```typescript
// Current implementation in sync-ingest.service.ts
const existingItems = await this.db
  .select()
  .from(items)
  .where(and(eq(items.vendorId, vendorId), eq(items.sku, itemPayload.sku)))
  .limit(1);
```

**Should be:**

```typescript
const existingItem = await this.itemsRepository.findByVendorAndSku(vendorId, itemPayload.sku);
```

**Benefits of using repositories:**

1. Centralized query logic (reusable across services)
2. Type-safe query builders
3. Error handling in one place
4. Testable via mocking repositories
5. Transaction support via `BaseRepository.transaction()`
6. Consistent logging via `ILogger` interface

**Recommendation:** Create repositories for items, warehouses, stock as part of Task 2 refinement.

---

## Gap 2: Spec vs Implementation Inconsistency

### REQ-2 NOTE Says:

> "NOTE: `items`, `stock`, `warehouses` tables do NOT exist yet. They must be created as part of the sync implementation (or as a prerequisite Task 2 sub-task). These tables need `content_hash` and `last_synced_at` columns for deduplication."

### Reality:

```typescript
// packages/shared/src/database/schema/items.schema.ts (EXISTS)
export const items = pgTable('items', {
  id: uuid('id').defaultRandom().primaryKey(),
  vendorId: varchar('vendor_id', { length: 100 }).notNull(),
  sku: varchar('sku', { length: 100 }).notNull(),
  // ...
  contentHash: varchar('content_hash', { length: 64 }).notNull(), // ✅ EXISTS
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true, mode: 'date' }).notNull(), // ✅ EXISTS
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});
```

**Same for `warehouses.schema.ts` and `stock.schema.ts` — both have `content_hash` and `last_synced_at`.**

**Conclusion:** REQ-2 NOTE is **OUTDATED**. Business entity tables already exist with deduplication columns.

**Action Required:** Update `specs/sync-architecture.md` to remove the misleading NOTE.

---

## Gap 3: Missing Fields in Existing Schemas

### Items Schema Comparison

| Field (Old Doc)                       | Current Schema | Status  | Severity                         |
| ------------------------------------- | -------------- | ------- | -------------------------------- |
| `erp_id` (EBP UniqueId Guid)          | ❌ Missing     | ⚠️ High | Needed for ERP reconciliation    |
| `slug` (SEO-friendly URL)             | ❌ Missing     | Low     | Frontend concern                 |
| `barcode`                             | ❌ Missing     | Medium  | Common retail field              |
| `price_excl_vat`                      | ❌ Missing     | ⚠️ High | Critical for pricing             |
| `price_incl_vat`                      | ❌ Missing     | ⚠️ High | Critical for pricing             |
| `vat_amount`                          | ❌ Missing     | Medium  | Derived from price + rate        |
| `manage_stock`                        | ❌ Missing     | ⚠️ High | Stock management flag            |
| `allow_negative_stock`                | ❌ Missing     | Medium  | Stock management flag            |
| `stock_booking_allowed`               | ❌ Missing     | Medium  | Stock reservation feature        |
| `total_real_stock` (denormalized)     | ❌ Missing     | Low     | Can be computed from stock table |
| `total_virtual_stock`                 | ❌ Missing     | Low     | Can be computed                  |
| `weight`, `height`, `width`, `length` | ❌ Missing     | Low     | Shipping calculations            |
| `publish_on_web`                      | ❌ Missing     | Low     | Frontend concern                 |

**Current schema has:** `unitPrice` only (no breakdown of VAT)

**Recommendation:**

- Add `erpId` (CRITICAL for ERP reconciliation)
- Add `priceExclVat`, `priceInclVat`, `vatAmount` (CRITICAL for pricing)
- Add `manageStock`, `allowNegativeStock` (HIGH for inventory logic)
- Add `barcode` (MEDIUM — useful for retail)
- Keep `unitPrice` for backward compatibility
- Defer `publish_on_web`, `slug`, dimensions to post-MVP

### Warehouses Schema Comparison

| Field (Old Doc)               | Current Schema   | Status | Severity                       |
| ----------------------------- | ---------------- | ------ | ------------------------------ |
| `erp_warehouse_id`            | ✅ Present       | ✅ OK  |                                |
| `code`                        | ✅ Present       | ✅ OK  |                                |
| `name`                        | ✅ Present       | ✅ OK  |                                |
| `description`                 | ❌ Missing       | Low    |                                |
| `address`                     | ✅ Present       | ✅ OK  |                                |
| `city`                        | ✅ Present       | ✅ OK  |                                |
| `zip_code`                    | ⚠️ `postal_code` | ✅ OK  | Naming difference only         |
| `state`                       | ❌ Missing       | Low    | Not used in France             |
| `country_code`                | ⚠️ `country`     | ✅ OK  | Length: 3 (ISO) vs 2 (current) |
| `latitude`, `longitude`       | ❌ Missing       | Low    | GPS coordinates                |
| `is_default`                  | ❌ Missing       | Medium | Default warehouse flag         |
| `is_main`                     | ❌ Missing       | Medium | Main warehouse flag from ERP   |
| `type` (0=Storage, 1=Transit) | ❌ Missing       | Low    | Warehouse type                 |
| `multi_location_enabled`      | ❌ Missing       | Low    | ERP feature flag               |
| `last_inventory_date`         | ❌ Missing       | Low    | Last stocktake                 |

**Recommendation:**

- Add `isDefault`, `isMain` (MEDIUM — warehouse selection logic)
- Add `type` (LOW — can default to 0)
- Change `country` from `varchar(2)` to `varchar(3)` (or keep 2-char ISO 3166-1 alpha-2)
- Defer GPS coordinates to post-MVP

### Stock Schema Comparison

| Field (Old Doc)            | Current Schema         | Status | Severity                                |
| -------------------------- | ---------------------- | ------ | --------------------------------------- |
| `real_stock`               | ⚠️ `quantity`          | ✅ OK  | Naming difference                       |
| `virtual_stock`            | ⚠️ `availableQuantity` | ✅ OK  | Naming difference (virtual = available) |
| `reserved_quantity`        | ✅ `reservedQuantity`  | ✅ OK  |                                         |
| `ordered_quantity`         | ❌ Missing             | Low    | Ordered by customers                    |
| `pump` (weighted avg cost) | ❌ Missing             | Medium | Cost tracking                           |
| `stock_value`              | ❌ Missing             | Medium | realStock × pump                        |
| `min_stock`                | ❌ Missing             | Low    | Reorder point                           |
| `max_stock`                | ❌ Missing             | Low    | Max capacity                            |
| `stock_to_order_threshold` | ❌ Missing             | Low    | Reorder threshold                       |
| `last_synced_from`         | ❌ Missing             | Low    | Source identifier                       |

**Recommendation:**

- Add `orderedQuantity`, `pump`, `stockValue` (MEDIUM — cost tracking)
- Add `minStock`, `maxStock` (LOW — inventory planning)
- Add `lastSyncedFrom` (LOW — audit trail)

---

## Gap 4: Missing Orders Schema & Module

### Required Implementation

**1. Create Orders Schema** (`packages/shared/src/database/schema/orders.schema.ts`):

```typescript
export const orders = pgTable(
  'orders',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    // Document Identity
    orderNumber: varchar('order_number', { length: 50 }).unique().notNull(),
    documentDate: timestamp('document_date', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    reference: varchar('reference', { length: 100 }), // Customer PO number
    documentType: integer('document_type').default(1).notNull(), // 0=Quote, 1=Order, 2=Delivery, 3=Invoice
    validationState: integer('validation_state').default(0).notNull(), // 0=Draft, 1=Validated, 2=Processing, 3=Completed

    // Customer Info
    vendorId: uuid('vendor_id').notNull(),
    customerId: uuid('customer_id').notNull(),
    customerEmail: varchar('customer_email', { length: 100 }),
    customerPhone: varchar('customer_phone', { length: 30 }),
    erpCustomerCode: varchar('erp_customer_code', { length: 20 }).notNull(),

    // Addresses (JSONB snapshots)
    billingAddress: jsonb('billing_address'),
    shippingAddress: jsonb('shipping_address'),

    // Logistics
    warehouseId: uuid('warehouse_id').references(() => warehouses.id),
    deliveryDate: timestamp('delivery_date', { withTimezone: true, mode: 'date' }),
    deliveryState: integer('delivery_state').default(0).notNull(), // 0=Not delivered, 1=Partial, 2=Full

    // Financial Totals
    amountVatExcluded: numeric('amount_vat_excluded', { precision: 12, scale: 2 })
      .default('0')
      .notNull(),
    discountRate: numeric('discount_rate', { precision: 5, scale: 2 }).default('0').notNull(),
    discountAmount: numeric('discount_amount', { precision: 12, scale: 2 }).default('0').notNull(),
    amountVatExcludedWithDiscount: numeric('amount_vat_excluded_with_discount', {
      precision: 12,
      scale: 2,
    })
      .default('0')
      .notNull(),
    shippingAmountVatExcluded: numeric('shipping_amount_vat_excluded', { precision: 10, scale: 2 })
      .default('0')
      .notNull(),
    shippingVatRate: numeric('shipping_vat_rate', { precision: 5, scale: 2 })
      .default('0')
      .notNull(),
    amountVatExcludedWithDiscountAndShipping: numeric(
      'amount_vat_excluded_with_discount_and_shipping',
      { precision: 12, scale: 2 },
    )
      .default('0')
      .notNull(),
    vatAmount: numeric('vat_amount', { precision: 12, scale: 2 }).default('0').notNull(),
    amountVatIncluded: numeric('amount_vat_included', { precision: 12, scale: 2 })
      .default('0')
      .notNull(),
    costPrice: numeric('cost_price', { precision: 12, scale: 2 }).default('0').notNull(),

    // Payment
    paymentMethod: varchar('payment_method', { length: 50 }), // NAPS, CARD, BANK_TRANSFER, CASH
    shippingMethod: varchar('shipping_method', { length: 50 }), // STANDARD, EXPRESS, PICKUP
    currencyCode: varchar('currency_code', { length: 3 }).default('EUR').notNull(),
    paymentStatus: varchar('payment_status', { length: 20 }).default('PENDING').notNull(),
    paymentProvider: varchar('payment_provider', { length: 50 }),
    paymentTransactionId: varchar('payment_transaction_id', { length: 100 }),
    paymentAuthNumber: varchar('payment_auth_number', { length: 50 }),
    paymentProcessedAt: timestamp('payment_processed_at', { withTimezone: true, mode: 'date' }),
    paymentAmount: numeric('payment_amount', { precision: 12, scale: 2 }),

    // ERP Synchronization
    erpReference: varchar('erp_reference', { length: 100 }),
    erpStatus: varchar('erp_status', { length: 50 }), // SYNCING, CONFIRMED, SYNC_FAILED
    erpDocumentId: varchar('erp_document_id', { length: 100 }), // EBP SaleDocument.Id (Guid)
    erpSerialId: varchar('erp_serial_id', { length: 2 }), // EBP SerialId (e.g., "CO")
    erpVatId: varchar('erp_vat_id', { length: 100 }), // EBP Vat.Id (Guid)
    erpTerritorialityId: varchar('erp_territoriality_id', { length: 100 }), // EBP Territoriality.Id (Guid)
    erpSettlementModeId: varchar('erp_settlement_mode_id', { length: 6 }), // EBP payment terms
    erpSyncedAt: timestamp('erp_synced_at', { withTimezone: true, mode: 'date' }),
    erpSyncError: text('erp_sync_error'),
    contentHash: varchar('content_hash', { length: 64 }),

    // Job Tracking
    reservationJobId: varchar('reservation_job_id', { length: 100 }), // Sync job ID

    // Notes
    customerNotes: text('customer_notes'),
    internalNotes: text('internal_notes'),

    // Audit
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    createdBy: varchar('created_by', { length: 100 }),
    updatedBy: varchar('updated_by', { length: 100 }),
  },
  table => [
    index('orders_vendor_id_idx').on(table.vendorId),
    index('orders_customer_id_idx').on(table.customerId),
    index('orders_validation_state_idx').on(table.validationState),
    index('orders_delivery_state_idx').on(table.deliveryState),
    index('orders_erp_document_id_idx').on(table.erpDocumentId),
    index('orders_document_date_idx').on(table.documentDate),
  ],
);
```

**2. Create Order Items Schema** (`packages/shared/src/database/schema/order-items.schema.ts`):

```typescript
export const orderItems = pgTable(
  'order_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),

    // Line Identity
    lineOrder: integer('line_order').notNull(), // Display sequence

    // Product Reference
    sku: varchar('sku', { length: 100 }).notNull(),
    itemId: uuid('item_id').references(() => items.id),
    description: text('description').notNull(),

    // Quantity Tracking
    quantity: numeric('quantity', { precision: 10, scale: 3 }).notNull(),
    orderedQuantity: numeric('ordered_quantity', { precision: 10, scale: 3 }).notNull(),
    deliveredQuantity: numeric('delivered_quantity', { precision: 10, scale: 3 })
      .default('0')
      .notNull(),
    remainingQuantityToDeliver: numeric('remaining_quantity_to_deliver', {
      precision: 10,
      scale: 3,
    }).notNull(),
    returnedQuantity: numeric('returned_quantity', { precision: 10, scale: 3 })
      .default('0')
      .notNull(),
    invoicedQuantity: numeric('invoiced_quantity', { precision: 10, scale: 3 })
      .default('0')
      .notNull(),
    remainingQuantityToInvoice: numeric('remaining_quantity_to_invoice', {
      precision: 10,
      scale: 3,
    }).notNull(),

    // Unit & Warehouse
    unitCode: varchar('unit_code', { length: 50 }),
    warehouseId: uuid('warehouse_id').references(() => warehouses.id),
    manageStock: boolean('manage_stock').default(true).notNull(),

    // Pricing
    purchasePrice: numeric('purchase_price', { precision: 10, scale: 4 }).default('0').notNull(),
    costPrice: numeric('cost_price', { precision: 10, scale: 4 }).default('0').notNull(),
    unitPrice: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
    netPriceVatExcluded: numeric('net_price_vat_excluded', { precision: 10, scale: 2 }).notNull(),
    netPriceVatIncluded: numeric('net_price_vat_included', { precision: 10, scale: 2 }),

    // Line Amounts
    netAmountVatExcluded: numeric('net_amount_vat_excluded', { precision: 12, scale: 2 })
      .default('0')
      .notNull(),
    netAmountVatExcludedWithDiscount: numeric('net_amount_vat_excluded_with_discount', {
      precision: 12,
      scale: 2,
    })
      .default('0')
      .notNull(),
    netAmountVatIncluded: numeric('net_amount_vat_included', { precision: 12, scale: 2 })
      .default('0')
      .notNull(),

    // Discounts
    discountRate: numeric('discount_rate', { precision: 5, scale: 2 }).default('0').notNull(),
    discountAmount: numeric('discount_amount', { precision: 12, scale: 2 }).default('0').notNull(),

    // VAT
    vatRate: numeric('vat_rate', { precision: 5, scale: 2 }).default('0').notNull(),
    vatAmount: numeric('vat_amount', { precision: 12, scale: 2 }).default('0').notNull(),
    erpVatId: varchar('erp_vat_id', { length: 100 }), // EBP Vat.Id (Guid)

    // Delivery
    deliveryDate: timestamp('delivery_date', { withTimezone: true, mode: 'date' }),
    deliveryState: integer('delivery_state').default(0).notNull(), // 0=Not delivered, 1=Partial, 2=Full

    // Reservation Tracking (inline, no separate table)
    reservationStatus: varchar('reservation_status', { length: 20 }).default('pending').notNull(), // pending, reserved, fulfilled, cancelled
    reservedAt: timestamp('reserved_at', { withTimezone: true, mode: 'date' }),
    reservationExpiresAt: timestamp('reservation_expires_at', { withTimezone: true, mode: 'date' }),

    // Physical Attributes
    weight: numeric('weight', { precision: 10, scale: 3 }),
    volume: numeric('volume', { precision: 10, scale: 6 }),

    // ERP Sync
    erpLineId: varchar('erp_line_id', { length: 100 }), // EBP SaleDocumentLine.Id (Guid)
    erpSyncedAt: timestamp('erp_synced_at', { withTimezone: true, mode: 'date' }),
    stockMovementId: integer('stock_movement_id'), // EBP StockMovement.Id

    // Audit
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  table => [
    index('order_items_order_id_idx').on(table.orderId),
    index('order_items_item_id_idx').on(table.itemId),
    index('order_items_delivery_state_idx').on(table.deliveryState),
    index('order_items_reservation_status_idx').on(table.reservationStatus),
    index('order_items_reservation_expires_at_idx').on(table.reservationExpiresAt),
  ],
);
```

**3. Add FK from sync_jobs to orders:**

```typescript
// In sync-relations.ts
export const syncJobsRelations = relations(syncJobs, ({ one }) => ({
  order: one(orders, {
    fields: [syncJobs.postgresOrderId],
    references: [orders.id],
  }),
}));
```

**4. Create Orders Module** (`apps/api/src/modules/orders/`):

- `orders.module.ts`
- `orders.service.ts`
- `orders.controller.ts`
- `orders.repository.ts`
- `dto/create-order.dto.ts`, `dto/order-item.dto.ts`
- `listeners/order-created.listener.ts` (triggers `SyncJobService.createOrderJob()`)

**5. Update Task 11 validation:**

- Remove "passing" status
- Add prerequisite: Task 2.1 (Create Orders Schema)
- Add prerequisite: Task 2.2 (Create Orders Module)

---

## Gap 5: Missing Repository Abstractions

### What Should Exist

Based on the two-layer repository pattern:

**Business entities:**

1. `packages/shared/src/database/repositories/items/items.repository.base.ts`
2. `packages/shared/src/database/repositories/warehouses/warehouses.repository.base.ts`
3. `packages/shared/src/database/repositories/stock/stock.repository.base.ts`
4. `packages/shared/src/database/repositories/orders/orders.repository.base.ts`
5. `packages/shared/src/database/repositories/order-items/order-items.repository.base.ts`

**NestJS adapters:**

1. `apps/api/src/database/adapters/nestjs-items.repository.ts`
2. `apps/api/src/database/adapters/nestjs-warehouses.repository.ts`
3. `apps/api/src/database/adapters/nestjs-stock.repository.ts`
4. `apps/api/src/database/adapters/nestjs-orders.repository.ts`
5. `apps/api/src/database/adapters/nestjs-order-items.repository.ts`

### Benefits

1. **Type safety:** All queries return typed entities
2. **Reusability:** Queries shared across services
3. **Testability:** Mock repositories instead of database
4. **Transaction support:** `BaseRepository.transaction()`
5. **Error handling:** Centralized database error mapping
6. **Logging:** Automatic query logging via `ILogger`

### Recommendation

Add **Task 2.5: Create Business Entity Repositories** after Task 2 (schemas created) and before Task 9 (sync ingest uses them).

---

## Gap 6: Missing ERP-Specific Fields

### Items Table ERP Fields

The old documentation shows ERP-specific fields for EBP integration that are missing:

| Field                                             | Purpose                     | Missing? |
| ------------------------------------------------- | --------------------------- | -------- |
| `erp_id`                                          | EBP Item.Id (UniqueId Guid) | ❌ YES   |
| `tracking_mode`                                   | 0=None, 1=Lot, 2=Serial     | ❌ YES   |
| `automatic_stock_booking`                         | Auto-reserve stock on order | ❌ YES   |
| `pick_movement_disallowed_on_totally_booked_item` | EBP flag                    | ❌ YES   |

**Recommendation:** Add these fields to items schema for full ERP parity.

### Orders Table ERP Fields

Already covered in Gap 4 — comprehensive ERP fields included in proposed schema.

---

## Gap 7: Direct Ingest Implementation Quality

### Current Implementation Uses Raw Drizzle

**Example from `sync-ingest.service.ts`:**

```typescript
// Direct database access
const existingItems = await this.db
  .select()
  .from(items)
  .where(and(eq(items.vendorId, vendorId), eq(items.sku, itemPayload.sku)))
  .limit(1);

const existingItem = existingItems[0];
```

**Problems:**

1. Query logic duplicated across services
2. No transaction support
3. Error handling inline (not centralized)
4. Hard to mock for testing
5. No logging of queries

### Recommended Refactor

**After creating ItemsRepository:**

```typescript
// In ItemsRepositoryBase
async findByVendorAndSku(vendorId: string, sku: string): Promise<Item | null> {
  try {
    const results = await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.vendorId, vendorId), eq(this.table.sku, sku)))
      .limit(1);

    this.logger.debug('findByVendorAndSku', { vendorId, sku, found: !!results[0] });
    return results[0] ?? null;
  } catch (error) {
    this.handleError(error, 'findByVendorAndSku', { vendorId, sku });
  }
}

// In SyncIngestService
const existingItem = await this.itemsRepository.findByVendorAndSku(vendorId, itemPayload.sku);
```

**Benefits:**

- Single source of truth for queries
- Automatic error handling + logging
- Easy to mock: `jest.spyOn(itemsRepository, 'findByVendorAndSku').mockResolvedValue(null)`
- Transaction support: `itemsRepository.transaction(async (tx) => { ... })`

**Recommendation:** Refactor `SyncIngestService` to use repositories after Task 2.5.

---

## Gap 8: Order Creation Event Flow

### What the Old Doc Says

**Flow:** Order created → Event emitted → `OrderErpSyncListener` → `SyncJobService.createOrderJob()` → BullMQ

### Current Implementation

**Task 11** mentions creating `order-erp-sync.listener.ts` but:

1. No `OrdersModule` exists to emit events
2. No `OrderCreated` event defined
3. No integration with frontend order creation

### Required Implementation

**1. Create order event:**

```typescript
// apps/api/src/modules/orders/events/order-created.event.ts
export class OrderCreatedEvent {
  constructor(
    public readonly orderId: string,
    public readonly vendorId: string,
    public readonly orderData: CreateOrderDto,
  ) {}
}
```

**2. Emit event from OrdersService:**

```typescript
// apps/api/src/modules/orders/orders.service.ts
async createOrder(dto: CreateOrderDto): Promise<Order> {
  const order = await this.ordersRepository.create(dto);
  this.eventEmitter.emit('order.created', new OrderCreatedEvent(order.id, order.vendorId, dto));
  return order;
}
```

**3. Listen in SyncModule:**

```typescript
// apps/api/src/modules/sync/listeners/order-erp-sync.listener.ts
@Injectable()
export class OrderErpSyncListener {
  @OnEvent('order.created')
  async handleOrderCreated(event: OrderCreatedEvent) {
    await this.syncJobService.createOrderJob(event.vendorId, event.orderId, event.orderData);
  }
}
```

**Recommendation:** Add Task 2.3: Implement Orders Module with Event Emitter.

---

## Gap 9: Frontend Integration Points

### What's Missing

The old documentation mentions:

- **Frontend customer management** (customer_id in orders table)
- **Oxatis integration** (meta_title, meta_description fields in items)
- **Web publishing** (publish_on_web flag in items)

### Current Implementation

No frontend integration points defined. The API is backend-only.

### Recommendation

**Defer to post-MVP:**

- Customer management module
- Oxatis e-commerce integration
- Web publishing flags

**For MVP:**

- Orders can reference `customerId` as UUID (FK to future `customers` table)
- Items don't need `publish_on_web` — all items available by default
- Skip Oxatis metadata fields

---

## Gap 10: Testing Coverage

### Current State

Unit tests exist for:

- ✅ Agent registry service
- ✅ ERP mapping service
- ✅ Circuit breaker service
- ✅ Agent communication service
- ✅ Sync ingest service (partial)
- ✅ Sync job service
- ✅ Order sync processor
- ✅ DLQ service
- ✅ Reconciliation service
- ✅ Scheduler service
- ✅ Metrics service
- ✅ Health indicators

### Missing

- ❌ Integration tests (Task 22 — not started)
- ❌ E2E tests for full sync flows
- ❌ Load tests for batch endpoints
- ❌ Repository tests (since repositories don't exist for business entities)

### Recommendation

**Before production:**

- Complete Task 22 (Integration Tests)
- Add load tests for batch sync (5000 items)
- Add repository tests when Task 2.5 is implemented

---

## Refined Task Breakdown

### Phase 1: Foundation (Tasks 1-2) — ✅ COMPLETE

**Task 1:** Dependencies + Redis + Config — ✅ passing  
**Task 2:** Database Schemas — ⚠️ **NEEDS REFINEMENT**

### Task 2 Refinement: Add Missing Schemas & Repositories

**Task 2.1: Create Orders & Order Items Schemas** (NEW)

- **Priority:** P0 (BLOCKING)
- **Status:** not started
- **Files to create:**
  - `packages/shared/src/database/schema/orders.schema.ts`
  - `packages/shared/src/database/schema/order-items.schema.ts`
  - Update `packages/shared/src/database/schema/index.ts`
  - Update `packages/shared/src/database/schema/sync-relations.ts` (add FK from sync_jobs)
  - Update `apps/api/src/database/database.module.ts` (register schemas)
- **Validation:**
  ```bash
  pnpm turbo build --filter=@repo/shared
  pnpm turbo build --filter=@apps/api
  pnpm db:generate
  pnpm db:migrate
  ```

**Task 2.2: Add Missing Fields to Items Schema** (NEW)

- **Priority:** P0 (CRITICAL)
- **Status:** not started
- **Add fields:**
  - `erpId` (VARCHAR(100), UNIQUE per vendor)
  - `priceExclVat` (NUMERIC(10,2))
  - `priceInclVat` (NUMERIC(10,2))
  - `vatAmount` (NUMERIC(10,2))
  - `manageStock` (BOOLEAN, default TRUE)
  - `allowNegativeStock` (BOOLEAN, default FALSE)
  - `barcode` (VARCHAR(100), nullable)
- **Migration:** ALTER TABLE items ADD COLUMN ...
- **Validation:** Same as Task 2.1

**Task 2.3: Add Missing Fields to Warehouses Schema** (NEW)

- **Priority:** P1
- **Status:** not started
- **Add fields:**
  - `isDefault` (BOOLEAN, default FALSE)
  - `isMain` (BOOLEAN, default FALSE)
  - `type` (INTEGER, default 0)
- **Migration:** ALTER TABLE warehouses ADD COLUMN ...

**Task 2.4: Add Missing Fields to Stock Schema** (NEW)

- **Priority:** P1
- **Status:** not started
- **Add fields:**
  - `orderedQuantity` (NUMERIC(10,2), default 0)
  - `pump` (NUMERIC(10,4), default 0)
  - `stockValue` (NUMERIC(12,2), default 0)
  - `minStock` (NUMERIC(10,2), default 0)
  - `maxStock` (NUMERIC(10,2), nullable)
- **Migration:** ALTER TABLE stock ADD COLUMN ...

**Task 2.5: Create Business Entity Repositories** (NEW)

- **Priority:** P0 (CRITICAL for clean architecture)
- **Status:** not started
- **Files to create:**
  - `packages/shared/src/database/repositories/items/items.repository.base.ts`
  - `packages/shared/src/database/repositories/warehouses/warehouses.repository.base.ts`
  - `packages/shared/src/database/repositories/stock/stock.repository.base.ts`
  - `packages/shared/src/database/repositories/orders/orders.repository.base.ts`
  - `packages/shared/src/database/repositories/order-items/order-items.repository.base.ts`
  - `apps/api/src/database/adapters/nestjs-items.repository.ts`
  - `apps/api/src/database/adapters/nestjs-warehouses.repository.ts`
  - `apps/api/src/database/adapters/nestjs-stock.repository.ts`
  - `apps/api/src/database/adapters/nestjs-orders.repository.ts`
  - `apps/api/src/database/adapters/nestjs-order-items.repository.ts`
- **Methods to implement:**
  - ItemsRepository: `findByVendorAndSku`, `upsertBatch`, `findByVendor`, `updateContentHash`
  - WarehousesRepository: `findByVendorAndErpId`, `upsertBatch`, `findByVendor`
  - StockRepository: `findByVendorWarehouseItem`, `upsertBatch`, `updateQuantity`
  - OrdersRepository: `create`, `findById`, `updateErpReference`, `findByVendor`
  - OrderItemsRepository: `createBatch`, `findByOrderId`, `updateDeliveryStatus`
- **Files to modify:**
  - `apps/api/src/database/database.module.ts` (provide repositories)

**Task 2.6: Create Orders Module** (NEW)

- **Priority:** P0 (BLOCKING for Task 11)
- **Status:** not started
- **Files to create:**
  - `apps/api/src/modules/orders/orders.module.ts`
  - `apps/api/src/modules/orders/orders.service.ts`
  - `apps/api/src/modules/orders/orders.controller.ts`
  - `apps/api/src/modules/orders/dto/create-order.dto.ts`
  - `apps/api/src/modules/orders/dto/order-item.dto.ts`
  - `apps/api/src/modules/orders/events/order-created.event.ts`
- **Implementation:**
  - POST `/api/orders` — create order + emit event
  - GET `/api/orders/:id` — get order details
  - GET `/api/orders` — list orders (paginated)
  - Event emission: `this.eventEmitter.emit('order.created', ...)`
- **Validation:**
  ```bash
  pnpm turbo test --filter=@apps/api -- --testPathPattern=orders
  ```

### Phase 2: Repository Refactor (NEW)

**Task 2.7: Refactor SyncIngestService to Use Repositories** (NEW)

- **Priority:** P1
- **Status:** not started
- **Depends on:** Task 2.5
- **Changes:**
  - Replace raw Drizzle queries with repository calls
  - Use `itemsRepository.findByVendorAndSku()` instead of `db.select()`
  - Use `itemsRepository.upsertBatch()` for batch operations
  - Same for warehouses and stock

### Phase 3-8: Continue as Planned

Tasks 3-17 remain the same, with updated dependencies:

- **Task 9** now depends on Task 2.5 (repositories must exist)
- **Task 11** now depends on Task 2.1 + Task 2.6 (orders schema + module must exist)

---

## Spec Corrections Required

### Update `specs/sync-architecture.md`

**REQ-2 NOTE (line 131-144):**

```diff
- **NOTE:** `items`, `stock`, `warehouses` tables do NOT exist yet. They must be created as part of the sync implementation (or as a prerequisite Task 2 sub-task). These tables need `content_hash` and `last_synced_at` columns for deduplication.
+ **NOTE:** `items`, `stock`, `warehouses` tables ALREADY EXIST with `content_hash` and `last_synced_at` columns. However, additional fields are needed (see Task 2.2-2.4). The `orders` and `order_items` tables do NOT exist yet and must be created (see Task 2.1).
```

**Add new requirement:**

```markdown
### REQ-2.5: Business Entity Repositories

**Goal:** Create repository abstractions for items, warehouses, stock, orders, order_items.

**Pattern:** Two-layer repository pattern (base in shared, adapter in API).

**Acceptance Criteria:**

- [ ] 5 base repositories in `packages/shared/src/database/repositories/`
- [ ] 5 NestJS adapters in `apps/api/src/database/adapters/`
- [ ] All repositories extend `BaseRepository<TTable>`
- [ ] Type-safe query methods
- [ ] Error handling via `handleError()`
- [ ] Transaction support via `transaction()`
```

---

## IMPLEMENTATION_PLAN.md Updates

### Update Task 2 Description

**Current:**

> Create 5 new Drizzle schema files, update exports and relations, generate migration.

**Revised:**

> Create 5 sync schemas + 2 business entity schemas (orders, order_items), add missing fields to existing schemas, generate migrations. Also create repositories for all business entities.

**Add sub-tasks:**

- Task 2.1: Create orders & order_items schemas (P0)
- Task 2.2: Add missing fields to items schema (P0)
- Task 2.3: Add missing fields to warehouses schema (P1)
- Task 2.4: Add missing fields to stock schema (P1)
- Task 2.5: Create business entity repositories (P0)
- Task 2.6: Create orders module (P0)
- Task 2.7: Refactor sync-ingest to use repositories (P1)

### Update Task 11 Dependencies

**Current:**

```yaml
Task 11: Order Sync Processor + Agent Callback Controller
- Depends on: Task 8, Task 10
```

**Revised:**

```yaml
Task 11: Order Sync Processor + Agent Callback Controller
- Depends on: Task 2.1, Task 2.6, Task 8, Task 10
- CRITICAL: Orders schema and module MUST exist before this task can pass
```

### Update Task 9 Dependencies

**Current:**

```yaml
Task 9: Sync Ingest Service + Controller (Direct Pipeline)
- Depends on: Task 6, Task 3
```

**Revised:**

```yaml
Task 9: Sync Ingest Service + Controller (Direct Pipeline)
- Depends on: Task 2.5, Task 6, Task 3
- RECOMMENDED: Use repositories instead of raw Drizzle (see Task 2.7)
```

---

## Summary of Gaps

| Gap # | Issue                                | Severity    | Status    | Mitigation                |
| ----- | ------------------------------------ | ----------- | --------- | ------------------------- |
| 1     | Missing orders & order_items schemas | 🔴 Critical | BLOCKING  | Task 2.1 (NEW)            |
| 2     | Missing business entity repositories | 🔴 Critical | BLOCKING  | Task 2.5 (NEW)            |
| 3     | Missing fields in items schema       | 🟠 High     | BLOCKING  | Task 2.2 (NEW)            |
| 4     | Missing orders module                | 🔴 Critical | BLOCKING  | Task 2.6 (NEW)            |
| 5     | Spec inconsistency (REQ-2 NOTE)      | 🟡 Medium   | Confusing | Update spec               |
| 6     | SyncIngestService uses raw Drizzle   | 🟡 Medium   | Tech Debt | Task 2.7 (NEW)            |
| 7     | Missing fields in warehouses schema  | 🟡 Medium   | Optional  | Task 2.3 (NEW)            |
| 8     | Missing fields in stock schema       | 🟡 Medium   | Optional  | Task 2.4 (NEW)            |
| 9     | No frontend integration points       | 🟢 Low      | Post-MVP  | Defer                     |
| 10    | E2E tests not started                | 🟡 Medium   | Pre-prod  | Task 22 (already planned) |

---

## Recommendations

### Immediate Actions (BLOCKING)

1. **Create Task 2.1:** Orders & Order Items schemas
2. **Create Task 2.2:** Add missing fields to items schema (erpId, priceExclVat, priceInclVat, vatAmount, manageStock, allowNegativeStock, barcode)
3. **Create Task 2.5:** Business entity repositories (items, warehouses, stock, orders, order_items)
4. **Create Task 2.6:** Orders module with event emitter
5. **Update Task 11 status:** Change from "passing" to "blocked" until Task 2.1 + Task 2.6 complete
6. **Update `specs/sync-architecture.md`:** Fix REQ-2 NOTE

### High Priority (Before Production)

1. **Task 2.3:** Add `isDefault`, `isMain`, `type` to warehouses schema
2. **Task 2.4:** Add `orderedQuantity`, `pump`, `stockValue` to stock schema
3. **Task 2.7:** Refactor SyncIngestService to use repositories
4. **Task 22:** Complete integration tests

### Post-MVP

1. Add frontend customer management
2. Add Oxatis integration fields
3. Add web publishing flags
4. Add GPS coordinates to warehouses
5. Add dimensions to items
6. Add min/max stock thresholds

---

## Conclusion

**Current implementation is 70% complete** but has **4 critical blocking gaps**:

1. No orders/order_items schemas
2. No business entity repositories
3. Missing critical fields in items schema
4. No orders module

**Task 11 (Order Sync Processor) cannot be "passing"** because it has no database tables to operate on. This is a validation failure that must be addressed.

**Recommended next steps:**

1. Set Task 11 status to "blocked"
2. Create Tasks 2.1-2.7 (new sub-tasks)
3. Implement in order: 2.1 → 2.2 → 2.5 → 2.6 → (unblock Task 11)
4. Complete Task 11 with working order sync flow
5. Continue with Tasks 12-22

**Estimated effort for gap closure:** 3-5 days (full-time work)

---

## Appendix: Field Comparison Matrices

### Items Schema — Field-by-Field Comparison

| Field (Old Doc)                                 | Current Schema   | Gap? | Severity | Action                    |
| ----------------------------------------------- | ---------------- | ---- | -------- | ------------------------- |
| id                                              | ✅ uuid          | No   | —        | —                         |
| vendor_id                                       | ✅ vendorId      | No   | —        | —                         |
| erp_id (EBP Item.Id Guid)                       | ❌ Missing       | YES  | HIGH     | ADD                       |
| sku                                             | ✅ sku           | No   | —        | —                         |
| name                                            | ✅ name          | No   | —        | —                         |
| slug (SEO-friendly URL)                         | ❌ Missing       | YES  | LOW      | Post-MVP                  |
| barcode                                         | ❌ Missing       | YES  | MEDIUM   | ADD                       |
| price_excl_vat                                  | ❌ Missing       | YES  | HIGH     | ADD (replace unitPrice)   |
| price_incl_vat                                  | ❌ Missing       | YES  | HIGH     | ADD                       |
| vat_amount                                      | ❌ Missing       | YES  | MEDIUM   | ADD (derived)             |
| unit_code                                       | ✅ unitCode      | No   | —        | —                         |
| vat_code                                        | ✅ vatCode       | No   | —        | —                         |
| family_code                                     | ✅ familyCode    | No   | —        | —                         |
| sub_family_code                                 | ✅ subfamilyCode | No   | —        | —                         |
| manage_stock                                    | ❌ Missing       | YES  | HIGH     | ADD                       |
| allow_negative_stock                            | ❌ Missing       | YES  | HIGH     | ADD                       |
| stock_booking_allowed                           | ❌ Missing       | YES  | MEDIUM   | POST-MVP                  |
| automatic_stock_booking                         | ❌ Missing       | YES  | MEDIUM   | POST-MVP                  |
| tracking_mode                                   | ❌ Missing       | YES  | MEDIUM   | POST-MVP                  |
| pick_movement_disallowed_on_totally_booked_item | ❌ Missing       | YES  | LOW      | POST-MVP                  |
| total_real_stock (denormalized)                 | ❌ Missing       | YES  | LOW      | Computed from stock table |
| total_virtual_stock                             | ❌ Missing       | YES  | LOW      | Computed                  |
| total_reserved_quantity                         | ❌ Missing       | YES  | LOW      | Computed                  |
| is_active                                       | ✅ isActive      | No   | —        | —                         |
| publish_on_web                                  | ❌ Missing       | YES  | LOW      | POST-MVP                  |
| description                                     | ✅ description   | No   | —        | —                         |
| weight, weight_unit                             | ❌ Missing       | YES  | LOW      | POST-MVP (shipping)       |
| height, width, length, dimension_unit           | ❌ Missing       | YES  | LOW      | POST-MVP (shipping)       |
| items_per_package                               | ❌ Missing       | YES  | LOW      | POST-MVP                  |
| meta_title, meta_description, meta_keywords     | ❌ Missing       | YES  | LOW      | POST-MVP (Oxatis)         |
| brand                                           | ❌ Missing       | YES  | LOW      | POST-MVP                  |
| days_to_ship                                    | ❌ Missing       | YES  | LOW      | POST-MVP                  |
| ship_price_ttc                                  | ❌ Missing       | YES  | LOW      | POST-MVP                  |
| origin_country_code                             | ❌ Missing       | YES  | LOW      | POST-MVP                  |
| content_hash                                    | ✅ contentHash   | No   | —        | —                         |
| last_synced_at                                  | ✅ lastSyncedAt  | No   | —        | —                         |
| created_at                                      | ✅ createdAt     | No   | —        | —                         |
| updated_at                                      | ✅ updatedAt     | No   | —        | —                         |

**Summary:**

- ✅ Core sync fields exist (contentHash, lastSyncedAt)
- ❌ Missing 8 HIGH/MEDIUM priority fields
- ❌ Missing 15+ LOW priority fields (defer to post-MVP)

---

## Next Steps for Ralph

**Ralph should:**

1. Read this gap analysis
2. Update `IMPLEMENTATION_PLAN.md` with new Tasks 2.1-2.7
3. Update Task 11 status from "passing" to "blocked — depends on Task 2.1, Task 2.6"
4. Start implementing Task 2.1 (Orders schema)
5. Continue through Task 2.2 → 2.5 → 2.6 before attempting Task 11 again

**Do NOT proceed with Tasks 18-22 until gaps are closed.**

---

**End of Gap Analysis**
