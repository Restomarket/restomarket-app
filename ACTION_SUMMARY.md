# Action Summary — Critical Gaps Found

> **Date:** 2026-02-12  
> **Status:** 🔴 CRITICAL BLOCKING ISSUES IDENTIFIED  
> **Impact:** Task 11 cannot be "passing" — needs immediate correction

---

## 🚨 Critical Finding

**Task 11 (Order Sync Processor) is marked as "passing" but CANNOT work because:**

1. ❌ **No `orders` table exists** — `sync_jobs.postgres_order_id` has no FK target
2. ❌ **No `order_items` table exists** — order line items have nowhere to go
3. ❌ **No `OrdersModule` exists** — no service to emit order creation events
4. ❌ **Missing critical fields in `items` schema** — no `erpId`, `priceExclVat`, `priceInclVat`, `manageStock`

**Result:** The order sync flow cannot function. This is a false-positive "passing" status.

---

## 📊 What I Analyzed

I compared three documents:

1. **Old Implementation Doc** (your long schema comparison from Convex migration)
2. **Current `specs/sync-architecture.md`** (feature spec)
3. **Current `IMPLEMENTATION_PLAN.md`** (23 tasks, Tasks 1-17 marked "passing")

**Discovery:**

- The old doc assumes comprehensive `orders` and `order_items` schemas exist
- The old doc assumes `items` schema has ERP fields like `erpId`, pricing breakdowns
- Current implementation has business tables (`items`, `warehouses`, `stock`) BUT missing critical fields
- **Orders tables don't exist at all**

---

## 📁 Documents Created

I've created 3 comprehensive analysis documents in the root:

### 1. `GAP_ANALYSIS.md` (33 KB)

**Purpose:** Detailed field-by-field comparison

**Key sections:**

- Critical Gap: Orders Schema & Module (most important)
- Gap 1: Missing Business Entity Repositories
- Gap 2: Spec vs Implementation Inconsistency
- Gap 3: Missing Fields in Existing Schemas (items, warehouses, stock)
- Gap 4-10: Other gaps

**Verdict:** 4 CRITICAL blocking gaps, 6 medium/low priority gaps

---

### 2. `REFINED_IMPLEMENTATION_PLAN.md` (50 KB)

**Purpose:** Complete revised task breakdown with 7 NEW tasks

**Key changes:**

- **Task 2** split into **Tasks 2.1-2.7** (7 sub-tasks)
- **Task 2.1:** Create Orders & Order Items Schemas (NEW — BLOCKING)
- **Task 2.2:** Add Missing Fields to Items Schema (NEW — BLOCKING)
- **Task 2.3:** Add Missing Fields to Warehouses Schema (NEW — P1)
- **Task 2.4:** Add Missing Fields to Stock Schema (NEW — P1)
- **Task 2.5:** Create Business Entity Repositories (NEW — BLOCKING)
- **Task 2.6:** Create Orders Module (NEW — BLOCKING)
- **Task 2.7:** Refactor SyncIngestService to Use Repositories (NEW — P1)
- **Task 11** status changed: ✅ passing → ❌ **BLOCKED**

**Total tasks:** 30 (23 original + 7 new)

---

### 3. `ACTION_SUMMARY.md` (this document)

**Purpose:** Quick reference for Ralph

---

## 🎯 What Ralph Must Do

### Immediate Actions (TODAY)

1. **Update `IMPLEMENTATION_PLAN.md`:**
   - Change Task 11 status from "passing" to "**blocked — depends on Task 2.1, Task 2.6**"
   - Add Tasks 2.1-2.7 after Task 2 (see `REFINED_IMPLEMENTATION_PLAN.md` for full specs)
   - Update Quick Status Dashboard table at bottom

2. **Update `specs/sync-architecture.md`:**
   - Fix REQ-2 NOTE (line 131-144) — says business tables don't exist, but they DO
   - Change to: "items/stock/warehouses ALREADY EXIST but need additional fields. Orders tables do NOT exist yet."

3. **Start implementing Task 2.1** (Orders Schema):
   - Create `packages/shared/src/database/schema/orders.schema.ts`
   - Create `packages/shared/src/database/schema/order-items.schema.ts`
   - Create `packages/shared/src/database/schema/order-relations.ts`
   - Update `packages/shared/src/database/schema/sync-relations.ts` (add FK from sync_jobs to orders)
   - Export from `index.ts`
   - Register in `database.module.ts`
   - Generate migration: `pnpm db:generate`
   - Apply migration: `pnpm db:migrate`

---

### Critical Path to Unblock Task 11

```
Task 2.1: Orders Schema
  ↓
Task 2.2: Items Schema Updates (add erpId, priceExclVat, priceInclVat, vatAmount, manageStock, allowNegativeStock, barcode)
  ↓
Task 2.5: Business Entity Repositories (items, warehouses, stock, orders, order_items)
  ↓
Task 2.6: Orders Module (service, controller, DTOs, event emitter)
  ↓
Task 11: Order Sync Processor — UNBLOCKED ✅
  ↓
Continue to Tasks 18-22
```

**Estimated time:** 2-3 days (full-time work)

---

## 📋 Task Priority Breakdown

### P0 (BLOCKING — must complete before Task 11)

| Task # | Description                         | Complexity | Status      |
| ------ | ----------------------------------- | ---------- | ----------- |
| 2.1    | Orders & Order Items Schemas        | 7          | not started |
| 2.2    | Add Critical Fields to Items Schema | 4          | not started |
| 2.5    | Business Entity Repositories        | 8          | not started |
| 2.6    | Orders Module                       | 7          | not started |

**Total P0 complexity:** 26 points

---

### P1 (Should Have — production quality)

| Task # | Description                            | Complexity | Status      |
| ------ | -------------------------------------- | ---------- | ----------- |
| 2.3    | Add Fields to Warehouses Schema        | 2          | not started |
| 2.4    | Add Fields to Stock Schema             | 3          | not started |
| 2.7    | Refactor SyncIngestService (use repos) | 5          | not started |

**Total P1 complexity:** 10 points

---

### P2 (Post-MVP — can defer)

- Frontend customer management
- Oxatis e-commerce integration
- Web publishing flags (`publish_on_web`)
- GPS coordinates for warehouses
- Dimensions for items (weight, height, width, length)
- Min/max stock thresholds

---

## 🔍 Key Architectural Insights

### 1. Business Entity Tables Already Exist (Contrary to Spec)

**Spec says:** "items, stock, warehouses tables do NOT exist yet"  
**Reality:** They DO exist in `packages/shared/src/database/schema/`

**Evidence:**

- `items.schema.ts` — has `contentHash`, `lastSyncedAt` ✅
- `warehouses.schema.ts` — has `contentHash`, `lastSyncedAt` ✅
- `stock.schema.ts` — has `contentHash`, `lastSyncedAt` ✅

**BUT:** Missing critical ERP fields (see Gap 3 in GAP_ANALYSIS.md)

---

### 2. SyncIngestService Uses Raw Drizzle (Tech Debt)

**Current implementation:**

```typescript
// Direct database access
const existingItems = await this.db
  .select()
  .from(items)
  .where(and(eq(items.vendorId, vendorId), eq(items.sku, itemPayload.sku)))
  .limit(1);
```

**Should use repository pattern:**

```typescript
const existingItem = await this.itemsRepository.findByVendorAndSku(vendorId, itemPayload.sku);
```

**Why this matters:**

- Repositories provide transaction support
- Centralized query logic
- Error handling in one place
- Easier to mock for testing

**Action:** Task 2.7 (P1 — not blocking, but improves code quality)

---

### 3. Repository Pattern Implemented for Sync Tables, Not Business Tables

**What exists:**

- ✅ `SyncJobsRepository` (base + adapter)
- ✅ `AgentRegistryRepository` (base + adapter)
- ✅ `ErpCodeMappingsRepository` (base + adapter)
- ✅ `DeadLetterQueueRepository` (base + adapter)
- ✅ `ReconciliationEventsRepository` (base + adapter)

**What's missing:**

- ❌ `ItemsRepository`
- ❌ `WarehousesRepository`
- ❌ `StockRepository`
- ❌ `OrdersRepository`
- ❌ `OrderItemsRepository`

**Action:** Task 2.5 (P0 — BLOCKING)

---

## 📈 Implementation Status

### Before Gap Analysis

```
Tasks 1-17: ✅ passing
Tasks 18-22: ❌ not started
```

**Believed completion:** 74% (17/23 tasks)

---

### After Gap Analysis

```
Tasks 1, 3-10, 12-17: ✅ passing (15 tasks)
Task 2: ⚠️ incomplete (needs 2.1-2.7 sub-tasks)
Task 11: ❌ BLOCKED (cannot work without orders schema/module)
Tasks 18-22: ❌ not started
Tasks 2.1-2.7: ❌ not started (7 NEW tasks)
```

**Actual completion:** 50% (15/30 tasks)

**Critical path blocked:** Task 11 is a false positive

---

## 🛠️ Field Additions Summary

### Items Schema (Task 2.2)

**Add 7 critical fields:**

1. `erpId` VARCHAR(100) NOT NULL — EBP Item.Id (Guid)
2. `priceExclVat` NUMERIC(10,2) NOT NULL — Price excluding VAT
3. `priceInclVat` NUMERIC(10,2) NOT NULL — Price including VAT
4. `vatAmount` NUMERIC(10,2) NOT NULL — VAT amount (derived)
5. `manageStock` BOOLEAN DEFAULT TRUE NOT NULL — Stock management flag
6. `allowNegativeStock` BOOLEAN DEFAULT FALSE NOT NULL — Allow negative stock
7. `barcode` VARCHAR(100) — Retail barcode

**Migration includes backfill logic** to populate from existing `unitPrice` and `vatRate`.

---

### Warehouses Schema (Task 2.3)

**Add 3 fields:**

1. `isDefault` BOOLEAN DEFAULT FALSE NOT NULL — Default warehouse flag
2. `isMain` BOOLEAN DEFAULT FALSE NOT NULL — Main warehouse flag (from ERP)
3. `type` INTEGER DEFAULT 0 NOT NULL — 0=Storage, 1=Transit

---

### Stock Schema (Task 2.4)

**Add 5 fields:**

1. `orderedQuantity` NUMERIC(10,2) DEFAULT 0 NOT NULL — Ordered by customers
2. `pump` NUMERIC(10,4) DEFAULT 0 NOT NULL — Weighted average unit cost
3. `stockValue` NUMERIC(12,2) DEFAULT 0 NOT NULL — quantity × pump
4. `minStock` NUMERIC(10,2) DEFAULT 0 NOT NULL — Reorder point
5. `maxStock` NUMERIC(10,2) — Max capacity

---

## 📝 Orders Schema Summary (Task 2.1)

**Two new tables:**

### orders table (40+ fields)

- Document identity: orderNumber, documentDate, documentType, validationState
- Customer info: vendorId, customerId, erpCustomerCode, email, phone
- Addresses: billingAddress (JSONB), shippingAddress (JSONB)
- Logistics: warehouseId, deliveryDate, deliveryState
- Financial: Full pricing breakdown (amountVatExcluded, discountRate, discountAmount, shippingAmountVatExcluded, vatAmount, amountVatIncluded)
- Payment: paymentMethod, paymentStatus, paymentProvider, paymentTransactionId
- **ERP sync:** erpReference, erpStatus, erpDocumentId, erpSerialId, erpVatId, erpTerritorialityId, erpSettlementModeId, erpSyncedAt, erpSyncError, contentHash
- Job tracking: reservationJobId (link to sync_jobs)

### order_items table (30+ fields)

- Line identity: orderId (FK), lineOrder, sku, itemId (FK), description
- Quantity tracking: quantity, orderedQuantity, deliveredQuantity, remainingQuantityToDeliver, returnedQuantity, invoicedQuantity, remainingQuantityToInvoice
- Pricing: Full breakdown (unitPrice, netPriceVatExcluded, netPriceVatIncluded, netAmountVatExcluded, netAmountVatIncludedWithDiscount, discountRate, vatRate, vatAmount)
- Unit & warehouse: unitCode, warehouseId (FK), manageStock
- Delivery: deliveryDate, deliveryState
- **Reservation:** reservationStatus, reservedAt, reservationExpiresAt (inline, no separate table)
- ERP sync: erpLineId, erpSyncedAt, stockMovementId

**Full schemas provided in `REFINED_IMPLEMENTATION_PLAN.md`.**

---

## ✅ Validation Commands for Each Task

**After completing any Task 2.x:**

```bash
# 1. Lint + auto-fix
pnpm turbo lint --filter=@apps/api --fix

# 2. Build shared (if schema changed)
pnpm turbo build --filter=@repo/shared

# 3. Build API
pnpm turbo build --filter=@apps/api

# 4. Type check workspace-wide
pnpm turbo type-check

# 5. Generate + apply migration (if schema changed)
pnpm db:generate
pnpm db:migrate

# 6. Run tests (if applicable)
pnpm turbo test --filter=@apps/api -- --testPathPattern=<relevant>
```

**All commands must exit 0 before proceeding to next task.**

---

## 🎯 Success Criteria

### When are we unblocked?

**Task 11 can be marked "passing" when:**

1. ✅ Task 2.1 complete — orders & order_items schemas exist
2. ✅ Task 2.2 complete — items schema has critical fields
3. ✅ Task 2.5 complete — business entity repositories exist
4. ✅ Task 2.6 complete — OrdersModule exists with event emitter
5. ✅ OrderErpSyncListener listens to order.created event
6. ✅ OrderSyncProcessor sends order to agent
7. ✅ AgentCallbackController updates orders.erpReference
8. ✅ Full flow tested: order created → job → agent → callback → order updated
9. ✅ All validation commands pass

---

## 🚀 Next Steps for Ralph

### Step 1: Update Documentation (10 minutes)

- [ ] Update `IMPLEMENTATION_PLAN.md` with Tasks 2.1-2.7
- [ ] Change Task 11 status to "blocked"
- [ ] Update `specs/sync-architecture.md` REQ-2 NOTE

### Step 2: Implement Task 2.1 — Orders Schema (2-3 hours)

- [ ] Create `orders.schema.ts` (40 fields)
- [ ] Create `order-items.schema.ts` (30 fields)
- [ ] Create `order-relations.ts`
- [ ] Update `sync-relations.ts` (FK from sync_jobs)
- [ ] Export from `index.ts`
- [ ] Register in `database.module.ts`
- [ ] Run `pnpm db:generate && pnpm db:migrate`
- [ ] Validate: `pnpm turbo build --filter=@apps/api`

### Step 3: Implement Task 2.2 — Items Schema Updates (1-2 hours)

- [ ] Add 7 fields to `items.schema.ts`
- [ ] Create migration with backfill logic
- [ ] Apply migration
- [ ] Validate: `pnpm turbo build --filter=@apps/api`

### Step 4: Implement Task 2.5 — Business Entity Repositories (3-4 hours)

- [ ] Create 5 base repositories in `packages/shared/`
- [ ] Create 5 NestJS adapters in `apps/api/`
- [ ] Update `DatabaseModule` providers
- [ ] Validate: `pnpm turbo build --filter=@apps/api`

### Step 5: Implement Task 2.6 — Orders Module (3-4 hours)

- [ ] Create OrdersService, OrdersController
- [ ] Create DTOs (CreateOrderDto, OrderItemDto, AddressDto)
- [ ] Create OrderCreatedEvent
- [ ] Wire event emitter
- [ ] Register OrdersModule in AppModule
- [ ] Write unit tests
- [ ] Validate: `pnpm turbo test --filter=@apps/api -- --testPathPattern=orders`

### Step 6: Re-validate Task 11 (1 hour)

- [ ] Update OrderErpSyncListener to listen for order.created
- [ ] Update AgentCallbackController to update orders.erpReference
- [ ] Test full flow
- [ ] Validate: `pnpm turbo test --filter=@apps/api -- --testPathPattern=order-sync|agent-callback`
- [ ] Change Task 11 status to "passing"

### Step 7: Continue to Tasks 18-22

- [ ] Docker image tagging (Task 18)
- [ ] GitHub Actions CI/CD (Task 19)
- [ ] Zero-downtime deployment (Task 20)
- [ ] Correlation ID verification (Task 21)
- [ ] Integration tests (Task 22)

---

## 📞 If You Have Questions

**About the analysis:**

- Read `GAP_ANALYSIS.md` for detailed field-by-field comparisons
- Read `REFINED_IMPLEMENTATION_PLAN.md` for complete task specs with code examples

**About implementation order:**

- Follow the critical path: 2.1 → 2.2 → 2.5 → 2.6 → 11
- Do NOT skip Task 2.1 — it's BLOCKING
- Do NOT proceed to Tasks 18-22 until Task 11 is unblocked

**About validation:**

- Run ALL validation commands after each task
- Do NOT commit if build fails
- Do NOT mark task as "passing" if any validation fails

---

## 🎉 When Complete

**After all gaps closed and Task 11 truly passing:**

1. All 15 tables exist (5 business + 5 sync + orders + order_items + 3 more)
2. All repositories implemented (10 total)
3. Orders module fully functional
4. Order sync flow working end-to-end
5. 100% of Tasks 1-17 actually passing (not false positives)
6. Ready to proceed with production hardening (Tasks 18-22)

**Expected timeline:** 2-3 days full-time work to close all P0 gaps.

---

**End of Action Summary**

**Ralph: Start with updating `IMPLEMENTATION_PLAN.md` and implementing Task 2.1. Good luck! 🚀**
