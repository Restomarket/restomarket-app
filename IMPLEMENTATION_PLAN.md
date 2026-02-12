# Implementation Plan — ERP Sync Architecture

> **Spec:** `specs/sync-architecture.md`  
> **Last Updated:** 2026-02-12  
> **Total Tasks:** 31 across 8 phases + 1 validation gate  
> **Revision:** 2.1 — Added Pre-Implementation Checklist + Task 6.1 (ERP mapping seed)

---

## Revision History

| Date       | Version | Change                                                                       |
| ---------- | ------- | ---------------------------------------------------------------------------- |
| 2026-02-12 | 2.1     | Added Pre-Implementation Checklist, Task 6.1 (seed ERP mappings from Convex) |
| 2026-02-12 | 2.0     | Added Tasks 2.1-2.7, corrected Task 11 status to BLOCKED, updated deps       |
| 2026-02-12 | 1.0     | Initial 23-task plan                                                         |

---

## Current Status Summary

**Verified against codebase on 2026-02-12:**

- **Tasks 1, 2, 3-10, 12-17:** passing (17 tasks — sync infrastructure complete)
- **Tasks 18-21:** passing (4 tasks — DevOps implemented in `infrastructure/scripts/` + `.github/workflows/`)
- **Tasks 2.1-2.6:** passing (6 gap-closure tasks — orders schema, field updates, business repos, orders module)
- **Task 11:** **UNBLOCKED** — all dependencies resolved (Task 2.1, 2.5, 2.6 complete)
- **Task 2.7:** not started (tech debt — refactor SyncIngestService to use repositories)
- **Task 6.1:** not started (ERP mapping seed from Convex)
- **Task 22:** not started (integration/E2E tests)

**Actual completion:** 27/31 tasks (87%)

---

## Task Ordering Rationale

```
Phase 1: Foundation       ─── Infrastructure, deps, config, Redis, Docker
Phase 1b: Gap Closure     ─── Orders schema, missing fields, business repos, orders module (NEW)
Phase 2: Database         ─── Sync repositories (everything else depends on tables)
Phase 3: Module Scaffold  ─── SyncModule skeleton, guards (everything else depends on DI)
Phase 4: Core Services    ─── Agent registry, mappings, circuit breaker (ingest depends on these)
Phase 5: Direct Ingest    ─── Direct ingest pipeline (Agent → NestJS → PG in one hop)
Phase 6: Outbound Sync    ─── BullMQ order→ERP processor, DLQ
Phase 7: Background       ─── Reconciliation, scheduler, cleanup, metrics
Phase 8: Hardening        ─── Security, performance, CI/CD, deployment
```

**Critical Path to Unblock Task 11:**

```
Task 2.1 (Orders Schema) → Task 2.2 (Items Fields) → Task 2.5 (Business Repos) → Task 2.6 (Orders Module) → Task 11 UNBLOCKED
```

---

## Pre-Implementation Checklist

> **Complete these actions BEFORE starting Task 1**

### Required Actions

- [ ] **Export Convex ERP mappings** — These are the production mapping data from the legacy Convex system. They must be available for Task 6.1.

  ```bash
  # The export already exists at the repo root:
  # item-mapping.json (103 mappings: 39 unit, 22 vat, 7 family, 35 subfamily)
  #
  # If you need a fresh export from Convex:
  cd convex-sync
  npx convex export --table item_mapping --output mappings.json
  # Verify: cat mappings.json | jq 'length'  # Should be 103
  ```

- [ ] **Verify mapping data completeness** — The export must contain all 4 mapping types:

  | Mapping Type | Expected Count | Purpose                                                      |
  | ------------ | -------------- | ------------------------------------------------------------ |
  | `unit`       | 39             | ERP unit codes → Resto unit codes (REQUIRED for item ingest) |
  | `vat`        | 22             | ERP VAT codes → Resto VAT codes (REQUIRED for item ingest)   |
  | `family`     | 7              | ERP family codes → Resto categories (optional)               |
  | `subfamily`  | 35             | ERP subfamily codes → Resto subcategories (optional)         |

- [ ] **Verify vendorId consistency** — All mappings use vendorId `971a1d7b-8cd4-41d9-925f-f658deb6efa5`. This must match the vendor registered in the agent registry.

- [ ] **Note: Empty erpCode entry** — The export contains one mapping with `erpCode: ""` (a default unit fallback). Decide whether to import it or filter it out during transformation.

### Convex Export Format (Reference)

Each mapping in `item-mapping.json` looks like:

```json
{
  "_creationTime": 1767647238626.603,
  "_id": "k17dva3mg6hbzw82wvwcsc3jv97yn4y2",
  "createdAt": 1767647238626,
  "erpCode": "KG",
  "isActive": true,
  "mappingType": "unit",
  "restoCode": "unit_kg_rm",
  "restoLabel": "KILOGRAMME",
  "updatedAt": 1767647238626,
  "vendorId": "971a1d7b-8cd4-41d9-925f-f658deb6efa5"
}
```

**Transformation needed:** Strip Convex-specific fields (`_creationTime`, `_id`, `createdAt`, `updatedAt`) and format into `SeedErpMappingsDto` shape for the `/api/admin/mappings/seed` endpoint. See Task 6.1 for details.

---

## Phase 1: Foundation (Tasks 1-2)

### Task 1: Install Dependencies + Redis + Config Schema

- **Priority:** P0
- **Risk:** low
- **Status:** passing
- **Depends on:** nothing
- **Complexity:** 3
- **Spec reference:** REQ-1, REQ-13

**Description:**
Install NEW packages only (BullMQ, schedule, opossum, bcrypt — helmet and throttler already installed). Add sync-specific env vars to Zod config. Add BullModule and ScheduleModule to AppModule. Update .env.example.

**ALREADY EXISTS (DO NOT re-add):**

- `helmet` in `apps/api/src/main.ts`
- `@nestjs/throttler` + `ThrottlerGuard` in `apps/api/src/app.module.ts`
- `app.enableShutdownHooks()` in `apps/api/src/main.ts`
- `SWAGGER_ENABLED` gating in `apps/api/src/main.ts`
- CORS restricted to config origins in `apps/api/src/main.ts`
- `ValidationPipe` in `apps/api/src/main.ts` only
- Redis in `docker-compose.yml` (already has redis:7-alpine with healthcheck)

**Implementation Details:**

1. Install NEW packages only (in `apps/api/`):

   ```bash
   pnpm --filter @apps/api add @nestjs/bullmq bullmq ioredis @nestjs/schedule @nestjs/terminus opossum bcrypt
   pnpm --filter @apps/api add -D @types/opossum @types/bcrypt
   ```

2. Update `apps/api/src/config/validation.schema.ts` — add to existing `envSchema`:

   ```typescript
   REDIS_URL: z.string().url().default('redis://localhost:6379'),
   AGENT_SECRET: z.string().min(16).optional(),     // optional during dev, required in prod
   API_SECRET: z.string().min(32).optional(),        // optional during dev, required in prod
   SLACK_WEBHOOK_URL: z.string().url().optional(),
   BULLMQ_CONCURRENCY: z.string().default('5').transform(Number).pipe(z.number().min(1).max(20)),
   ```

3. Add a `redis.config.ts` registerAs factory in `apps/api/src/config/` following existing pattern (see `database.config.ts`)

4. Update `apps/api/src/app.module.ts`:
   - Add `ScheduleModule.forRoot()` to imports
   - Add `BullModule.forRootAsync(...)` using ConfigService for `REDIS_URL`
   - Load the new `redisConfig` in ConfigModule.forRoot load array

5. Update `apps/api/.env.example` with new env vars (REDIS_URL, AGENT_SECRET, API_SECRET, etc.)

**Files to create:**

- `apps/api/src/config/redis.config.ts`

**Files to modify:**

- `apps/api/package.json` (via pnpm --filter add)
- `apps/api/src/config/validation.schema.ts`
- `apps/api/src/app.module.ts`
- `apps/api/.env.example`

**Validation Commands:**

```bash
pnpm install
pnpm turbo lint --filter=@apps/api --fix
pnpm turbo build --filter=@apps/api
pnpm turbo type-check
docker compose config
```

---

### Task 2: Create Sync Database Schemas (Drizzle)

- **Priority:** P0
- **Risk:** medium (schema design is architectural)
- **Status:** passing
- **Depends on:** Task 1
- **Complexity:** 6
- **Spec reference:** REQ-2

**Description:**  
Create 5 sync-specific Drizzle schema files, update exports and relations, generate migration.

> **NOTE (2026-02-12):** This task covers the 5 **sync coordination** tables only. Business entity gaps (orders, missing fields, repositories) are addressed in Tasks 2.1-2.7 below.

**Implementation Details:**

Schema files to create (in `packages/shared/src/database/schema/`):

1. **`sync-jobs.schema.ts`** — UUID PK, postgresOrderId (nullable FK→orders), vendorId, operation, status, payload (JSONB), retry tracking, timestamps, indexes
2. **`agent-registry.schema.ts`** — UUID PK, unique vendorId, agentUrl, erpType, status, lastHeartbeat, authTokenHash, timestamps
3. **`erp-code-mappings.schema.ts`** — UUID PK, vendorId+mappingType+erpCode (unique), restoCode, restoLabel, isActive, timestamps
4. **`dead-letter-queue.schema.ts`** — UUID PK, FK→sync_jobs, vendorId, operation, payload (JSONB), failure info, resolved tracking
5. **`reconciliation-events.schema.ts`** — UUID PK, vendorId, eventType, summary (JSONB), details, timestamp, durationMs

**Also modify:**

- `packages/shared/src/database/schema/index.ts` — export all new schemas
- Create `packages/shared/src/database/schema/sync-relations.ts` — add relations
- `apps/api/src/database/database.module.ts` — add new schema tables to the explicit `schema` object

**Validation Commands:**

```bash
pnpm turbo lint --filter=@apps/api --fix
pnpm turbo build --filter=@repo/shared
pnpm turbo build --filter=@apps/api
pnpm turbo type-check
pnpm db:generate
pnpm db:migrate
```

---

## Phase 1b: Gap Closure (Tasks 2.1-2.7) — NEW

> **Added 2026-02-12** after gap analysis revealed critical blocking issues.  
> See `GAP_ANALYSIS.md` for full field-by-field comparison.

### Task 2.1: Create Orders & Order Items Schemas

- **Priority:** P0 (BLOCKING — blocks Task 11)
- **Risk:** medium
- **Status:** passing
- **Depends on:** Task 2
- **Complexity:** 7
- **Spec reference:** REQ-2, REQ-6

**Description:**
Create comprehensive `orders` and `order_items` schemas with full ERP integration fields. These are required for the order sync flow (Task 11) to function.

**Why this is blocking:**

- `sync_jobs.postgres_order_id` has no FK target (orphaned field)
- `OrderSyncProcessor` cannot query/update orders at runtime
- Agent callback cannot update `orders.erp_reference`

**Implementation Details:**

1. **Create `packages/shared/src/database/schema/orders.schema.ts`** (~40 fields):
   - Document identity: `orderNumber` (unique), `documentDate`, `documentType`, `validationState`
   - Customer info: `vendorId`, `customerId`, `customerEmail`, `customerPhone`, `erpCustomerCode`
   - Addresses: `billingAddress` (JSONB), `shippingAddress` (JSONB)
   - Logistics: `warehouseId` (FK→warehouses), `deliveryDate`, `deliveryState`
   - Financial totals: Full pricing breakdown (`amountVatExcluded`, `discountRate`, `discountAmount`, `vatAmount`, `amountVatIncluded`, `costPrice`, shipping amounts)
   - Payment: `paymentMethod`, `paymentStatus`, `paymentProvider`, `paymentTransactionId`, `paymentAmount`
   - ERP sync: `erpReference`, `erpStatus`, `erpDocumentId`, `erpSerialId`, `erpVatId`, `erpTerritorialityId`, `erpSettlementModeId`, `erpSyncedAt`, `erpSyncError`, `contentHash`
   - Job tracking: `reservationJobId`
   - Notes: `customerNotes`, `internalNotes`
   - Audit: `createdAt`, `updatedAt`, `createdBy`, `updatedBy`
   - Indexes: vendorId, customerId, validationState, deliveryState, erpDocumentId, documentDate, paymentStatus

2. **Create `packages/shared/src/database/schema/order-items.schema.ts`** (~30 fields):
   - Line identity: `orderId` (FK→orders, cascade delete), `lineOrder`, `sku`, `itemId` (FK→items), `description`
   - Quantity tracking: `quantity`, `orderedQuantity`, `deliveredQuantity`, `remainingQuantityToDeliver`, `returnedQuantity`, `invoicedQuantity`, `remainingQuantityToInvoice`
   - Unit & warehouse: `unitCode`, `warehouseId` (FK→warehouses), `manageStock`
   - Pricing: Full breakdown (`purchasePrice`, `costPrice`, `unitPrice`, `netPriceVatExcluded`, `netPriceVatIncluded`, `netAmountVatExcluded`, `netAmountVatIncluded`)
   - Discounts & VAT: `discountRate`, `discountAmount`, `vatRate`, `vatAmount`, `erpVatId`
   - Delivery: `deliveryDate`, `deliveryState`
   - Reservation: `reservationStatus`, `reservedAt`, `reservationExpiresAt` (inline, no separate table)
   - Physical: `weight`, `volume`
   - ERP sync: `erpLineId`, `erpSyncedAt`, `stockMovementId`
   - Indexes: orderId, itemId, deliveryState, reservationStatus, reservationExpiresAt

3. **Create `packages/shared/src/database/schema/order-relations.ts`**:
   - `ordersRelations`: warehouse (one), items (many)
   - `orderItemsRelations`: order (one), item (one), warehouse (one)

4. **Update `packages/shared/src/database/schema/sync-relations.ts`**:
   - Add FK from `syncJobs.postgresOrderId` → `orders.id`

5. **Export from `packages/shared/src/database/schema/index.ts`**

6. **Register in `apps/api/src/database/database.module.ts`**

**Files to create:**

- `packages/shared/src/database/schema/orders.schema.ts`
- `packages/shared/src/database/schema/order-items.schema.ts`
- `packages/shared/src/database/schema/order-relations.ts`

**Files to modify:**

- `packages/shared/src/database/schema/index.ts`
- `packages/shared/src/database/schema/sync-relations.ts`
- `apps/api/src/database/database.module.ts`

**Validation Commands:**

```bash
pnpm turbo lint --filter=@apps/api --fix
pnpm turbo build --filter=@repo/shared
pnpm turbo build --filter=@apps/api
pnpm turbo type-check
pnpm db:generate
pnpm db:migrate
```

**Acceptance Criteria:**

- [ ] `orders` table created with ~40 fields + indexes
- [ ] `order_items` table created with ~30 fields + indexes
- [ ] Relations properly defined (orders↔orderItems, orders↔warehouses, orderItems↔items)
- [ ] `sync_jobs.postgres_order_id` FK target resolved
- [ ] Schemas exported and registered
- [ ] Migration generated and applied
- [ ] Build passes: `pnpm turbo build --filter=@apps/api` exits 0

---

### Task 2.2: Add Missing Critical Fields to Items Schema

- **Priority:** P0 (CRITICAL for ERP parity)
- **Risk:** low
- **Status:** not started
- **Depends on:** Task 2
- **Complexity:** 4
- **Spec reference:** REQ-5

**Description:**  
Add ERP-specific and pricing fields required for full ERP data parity. Current `items` schema has `unitPrice` only — no VAT breakdown, no `erpId`, no stock management flags.

**Fields to add (7):**

| Field                | Type          | Default | Nullable | Purpose               |
| -------------------- | ------------- | ------- | -------- | --------------------- |
| `erpId`              | VARCHAR(100)  | —       | NOT NULL | EBP Item.Id (Guid)    |
| `priceExclVat`       | NUMERIC(10,2) | —       | NOT NULL | Price excluding VAT   |
| `priceInclVat`       | NUMERIC(10,2) | —       | NOT NULL | Price including VAT   |
| `vatAmount`          | NUMERIC(10,2) | —       | NOT NULL | VAT amount (derived)  |
| `manageStock`        | BOOLEAN       | TRUE    | NOT NULL | Stock management flag |
| `allowNegativeStock` | BOOLEAN       | FALSE   | NOT NULL | Allow negative stock  |
| `barcode`            | VARCHAR(100)  | —       | YES      | Retail barcode        |

**Migration includes backfill logic** to populate `priceExclVat`/`priceInclVat`/`vatAmount` from existing `unitPrice` + `vatRate`, and `erpId` from `sku` as temporary placeholder.

**New indexes:** `items_erp_id_idx`, `items_manage_stock_idx`

**Files to modify:**

- `packages/shared/src/database/schema/items.schema.ts`

**Validation Commands:**

```bash
pnpm turbo build --filter=@repo/shared
pnpm turbo build --filter=@apps/api
pnpm turbo type-check
pnpm db:generate
pnpm db:migrate
```

**Acceptance Criteria:**

- [ ] 7 new fields added to items schema
- [ ] Migration generated with backfill logic for existing data
- [ ] All existing data migrated successfully (no nulls in NOT NULL columns)
- [ ] Build passes

---

### Task 2.3: Add Missing Fields to Warehouses Schema

- **Priority:** P1 (should have for production)
- **Risk:** low
- **Status:** not started
- **Depends on:** Task 2
- **Complexity:** 2

**Description:**  
Add warehouse type and default flags needed for warehouse selection logic.

**Fields to add (3):**

| Field       | Type    | Default | Purpose                        |
| ----------- | ------- | ------- | ------------------------------ |
| `isDefault` | BOOLEAN | FALSE   | Default warehouse flag         |
| `isMain`    | BOOLEAN | FALSE   | Main warehouse flag (from ERP) |
| `type`      | INTEGER | 0       | 0=Storage, 1=Transit           |

**Files to modify:**

- `packages/shared/src/database/schema/warehouses.schema.ts`

**Validation Commands:** Same as Task 2.2

**Acceptance Criteria:**

- [ ] 3 new fields added
- [ ] Migration applied
- [ ] Build passes

---

### Task 2.4: Add Missing Fields to Stock Schema

- **Priority:** P1 (should have for production)
- **Risk:** low
- **Status:** not started
- **Depends on:** Task 2
- **Complexity:** 3

**Description:**  
Add cost tracking and inventory planning fields to the stock schema.

**Fields to add (5):**

| Field             | Type          | Default | Nullable | Purpose                |
| ----------------- | ------------- | ------- | -------- | ---------------------- |
| `orderedQuantity` | NUMERIC(10,2) | 0       | NOT NULL | Ordered by customers   |
| `pump`            | NUMERIC(10,4) | 0       | NOT NULL | Weighted avg unit cost |
| `stockValue`      | NUMERIC(12,2) | 0       | NOT NULL | quantity × pump        |
| `minStock`        | NUMERIC(10,2) | 0       | NOT NULL | Reorder point          |
| `maxStock`        | NUMERIC(10,2) | —       | YES      | Max capacity           |

**Files to modify:**

- `packages/shared/src/database/schema/stock.schema.ts`

**Validation Commands:** Same as Task 2.2

**Acceptance Criteria:**

- [ ] 5 new fields added
- [ ] Migration applied
- [ ] Build passes

---

### Task 2.5: Create Business Entity Repositories

- **Priority:** P0 (BLOCKING — required for clean architecture and Task 2.6)
- **Risk:** medium
- **Status:** not started
- **Depends on:** Task 2.1, Task 2.2
- **Complexity:** 8
- **Spec reference:** REQ-2.5

**Description:**  
Create repository abstractions for all business entities following the existing two-layer pattern (base in `packages/shared/`, NestJS adapter in `apps/api/`).

**Currently existing:** Sync repos only (SyncJobs, AgentRegistry, ErpCodeMappings, DeadLetterQueue, ReconciliationEvents, User)

**To create:**

| Repository           | Base Location                                            | Key Methods                                                                 |
| -------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------- |
| ItemsRepository      | `packages/shared/src/database/repositories/items/`       | `findByVendorAndSku`, `findByVendorAndErpId`, `upsertBatch`, `findByVendor` |
| WarehousesRepository | `packages/shared/src/database/repositories/warehouses/`  | `findByVendorAndErpId`, `upsertBatch`, `findByVendor`                       |
| StockRepository      | `packages/shared/src/database/repositories/stock/`       | `findByVendorWarehouseItem`, `upsertBatch`, `updateQuantity`                |
| OrdersRepository     | `packages/shared/src/database/repositories/orders/`      | `create`, `findById`, `updateErpReference`, `findByVendor`                  |
| OrderItemsRepository | `packages/shared/src/database/repositories/order-items/` | `createBatch`, `findByOrderId`, `updateDeliveryStatus`                      |

Each base repository extends `BaseRepository<TTable>` (from `packages/shared/src/database/repositories/base/`).

Each NestJS adapter wraps the base with `@Injectable()` + `PinoLogger` + `DATABASE_CONNECTION` injection.

**Files to create:**

Base repos:

- `packages/shared/src/database/repositories/items/items.repository.base.ts`
- `packages/shared/src/database/repositories/warehouses/warehouses.repository.base.ts`
- `packages/shared/src/database/repositories/stock/stock.repository.base.ts`
- `packages/shared/src/database/repositories/orders/orders.repository.base.ts`
- `packages/shared/src/database/repositories/order-items/order-items.repository.base.ts`

NestJS adapters:

- `apps/api/src/database/adapters/nestjs-items.repository.ts`
- `apps/api/src/database/adapters/nestjs-warehouses.repository.ts`
- `apps/api/src/database/adapters/nestjs-stock.repository.ts`
- `apps/api/src/database/adapters/nestjs-orders.repository.ts`
- `apps/api/src/database/adapters/nestjs-order-items.repository.ts`

**Files to modify:**

- `packages/shared/src/database/repositories/index.ts` — export new repos
- `apps/api/src/database/adapters/index.ts` — export new adapters
- `apps/api/src/database/database.module.ts` — provide and export new repositories

**Validation Commands:**

```bash
pnpm turbo lint --filter=@apps/api --fix
pnpm turbo build --filter=@repo/shared
pnpm turbo build --filter=@apps/api
pnpm turbo type-check
```

**Acceptance Criteria:**

- [ ] 5 base repositories created, each extending `BaseRepository<TTable>`
- [ ] 5 NestJS adapters created with DI wiring
- [ ] All repositories provided + exported in `DatabaseModule`
- [ ] Type-safe query methods implemented
- [ ] Error handling via `handleError()`
- [ ] Build passes

---

### Task 2.6: Create Orders Module

- **Priority:** P0 (BLOCKING — blocks Task 11)
- **Risk:** medium
- **Status:** passing
- **Depends on:** Task 2.1, Task 2.5
- **Complexity:** 7
- **Spec reference:** REQ-6

**Description:**  
Create full orders module with service, controller, DTOs, and event emission. This module emits the `order.created` event that triggers the order→ERP sync flow (Task 11).

**Implementation Details:**

1. **OrdersService:**
   - `createOrder(dto)` → create order + order items + emit `order.created` event
   - `findById(id)` → get order with items
   - `findByVendor(vendorId, page, limit)` → paginated list
   - `updateErpReference(orderId, erpReference, erpDocumentId)` → update ERP fields

2. **OrdersController:**
   - `POST /api/orders` — create order (emits event → triggers sync)
   - `GET /api/orders/:id` — get order details
   - `GET /api/orders` — list orders (paginated, filtered by vendorId)

3. **DTOs:** `CreateOrderDto`, `OrderItemDto`, `AddressDto` with class-validator decorators

4. **Event:** `OrderCreatedEvent` with `orderId`, `vendorId`, `orderData`

5. **Module wiring:** Import `DatabaseModule`, `EventEmitterModule`. Register in `AppModule`.

**Files to create:**

- `apps/api/src/modules/orders/orders.module.ts`
- `apps/api/src/modules/orders/orders.service.ts`
- `apps/api/src/modules/orders/orders.controller.ts`
- `apps/api/src/modules/orders/dto/create-order.dto.ts`
- `apps/api/src/modules/orders/dto/order-item.dto.ts`
- `apps/api/src/modules/orders/dto/address.dto.ts`
- `apps/api/src/modules/orders/events/order-created.event.ts`
- `apps/api/src/modules/orders/__tests__/orders.service.spec.ts`

**Files to modify:**

- `apps/api/src/app.module.ts` — add `OrdersModule` to imports

**Validation Commands:**

```bash
pnpm turbo lint --filter=@apps/api --fix
pnpm turbo build --filter=@apps/api
pnpm turbo test --filter=@apps/api -- --testPathPattern=orders
pnpm turbo type-check
```

**Acceptance Criteria:**

- [ ] `OrdersModule` created and registered in `AppModule`
- [ ] `OrdersService` with `createOrder` + event emission
- [ ] `OrdersController` with 3 endpoints + Swagger decorators
- [ ] DTOs with class-validator validation
- [ ] `OrderCreatedEvent` defined
- [ ] Unit tests passing
- [ ] Build passes

---

### Task 2.7: Refactor SyncIngestService to Use Repositories

- **Priority:** P1 (tech debt cleanup, not blocking)
- **Risk:** low
- **Status:** not started
- **Depends on:** Task 2.5, Task 9
- **Complexity:** 5

**Description:**  
Replace raw Drizzle queries in `SyncIngestService` with repository calls for cleaner architecture.

**Current (tech debt):**

```typescript
const existingItems = await this.db
  .select()
  .from(items)
  .where(and(eq(items.vendorId, vendorId), eq(items.sku, itemPayload.sku)))
  .limit(1);
```

**Target:**

```typescript
const existingItem = await this.itemsRepository.findByVendorAndSku(vendorId, itemPayload.sku);
```

**Also refactor:**

- `handleStockChanges()` → use `stockRepository.findByVendorWarehouseItem()`
- `handleWarehouseChanges()` → use `warehousesRepository.findByVendorAndErpId()`
- Batch upserts → use `*.upsertBatch()`

**Files to modify:**

- `apps/api/src/modules/sync/services/sync-ingest.service.ts`
- `apps/api/src/modules/sync/services/__tests__/sync-ingest.service.spec.ts`
- `apps/api/src/modules/sync/sync.module.ts` (inject repos)

**Validation Commands:**

```bash
pnpm turbo lint --filter=@apps/api --fix
pnpm turbo build --filter=@apps/api
pnpm turbo test --filter=@apps/api -- --testPathPattern=sync-ingest
pnpm turbo type-check
```

**Acceptance Criteria:**

- [ ] All raw Drizzle queries replaced with repository calls
- [ ] Repository DI injected into `SyncIngestService`
- [ ] Tests updated and passing
- [ ] Build passes

---

## Phase 2: Repositories (Task 3)

### Task 3: Create Sync Repositories

- **Priority:** P0
- **Risk:** low
- **Status:** passing
- **Depends on:** Task 2
- **Complexity:** 4
- **Spec reference:** REQ-2

**Description:**
Create 5 sync repository classes following the existing two-layer pattern (base in `packages/shared/`, adapter in `apps/api/`).

**Repositories:**

1. **`SyncJobsRepository`**: create, findById, findByOrderId, updateStatus, findPending, findExpired, countByStatus, getMetrics, deleteExpired
2. **`AgentRegistryRepository`**: upsert, findByVendorId, findAll, findActive, updateHeartbeat, findStale, deleteByVendorId
3. **`ErpCodeMappingsRepository`**: findByVendorTypeCode, findByVendorAndType, upsert, bulkInsert, deactivate, findAll, countByVendor
4. **`DeadLetterQueueRepository`**: create, findById, findUnresolved, markResolved, deleteOldResolved, countUnresolved
5. **`ReconciliationEventsRepository`**: create, findByVendor, findRecent, deleteOlderThan, getMetrics

**Validation Commands:**

```bash
pnpm turbo lint --filter=@apps/api --fix
pnpm turbo build --filter=@repo/shared
pnpm turbo build --filter=@apps/api
pnpm turbo type-check
```

---

## Phase 3: Module Scaffold (Task 4)

### Task 4: Create SyncModule Skeleton + Guards

- **Priority:** P0
- **Risk:** low
- **Status:** passing
- **Depends on:** Task 3
- **Complexity:** 4
- **Spec reference:** REQ-1, REQ-13

**Description:**
Create `src/modules/sync/` directory structure, module definition, guards (`AgentAuthGuard`, `ApiKeyGuard`), and placeholder controllers. Wire into `AppModule`.

**Validation Commands:**

```bash
pnpm turbo lint --filter=@apps/api --fix
pnpm turbo build --filter=@apps/api
pnpm turbo type-check
```

---

## Phase 4: Core Services (Tasks 5-8, 6.1)

### Task 5: Agent Registry Service

- **Priority:** P0
- **Risk:** low
- **Status:** passing
- **Depends on:** Task 4
- **Complexity:** 5
- **Spec reference:** REQ-3

**Description:**  
Full agent lifecycle — registration (bcrypt hash), heartbeat, health monitoring, status transitions (online→degraded→offline).

**Validation Commands:**

```bash
pnpm turbo lint --filter=@apps/api --fix
pnpm turbo build --filter=@apps/api
pnpm turbo test --filter=@apps/api -- --testPathPattern=agent-registry
pnpm turbo type-check
```

---

### Task 6: ERP Code Mapping Service

- **Priority:** P0
- **Risk:** low
- **Status:** passing
- **Depends on:** Task 4
- **Complexity:** 5
- **Spec reference:** REQ-4

**Description:**  
ERP code mapping resolution with in-memory LRU cache (10K entries, 5min TTL). Required before item ingest works.

**Validation Commands:**

```bash
pnpm turbo lint --filter=@apps/api --fix
pnpm turbo build --filter=@apps/api
pnpm turbo test --filter=@apps/api -- --testPathPattern=erp-mapping
pnpm turbo type-check
```

---

### Task 6.1: Seed ERP Code Mappings from Convex Export

- **Priority:** P0 (BLOCKING Task 9 validation — ingest fails without mappings)
- **Risk:** medium
- **Status:** not started
- **Depends on:** Task 6, Pre-Implementation Checklist
- **Complexity:** 3
- **Spec reference:** REQ-4

**Description:**  
Import the 103 production ERP code mappings exported from Convex (`item-mapping.json`) into PostgreSQL via the seed endpoint. Without these mappings, the item ingest pipeline (Task 9) will reject every item with "unmapped unit" / "unmapped vat" errors.

**Data source:** `item-mapping.json` (repo root) — 103 mappings for vendor `971a1d7b-8cd4-41d9-925f-f658deb6efa5`

**Implementation Details:**

1. **Create transformation script** (`scripts/transform-convex-mappings.js`):

   ```javascript
   #!/usr/bin/env node
   /**
    * Transform Convex item_mapping export → SeedErpMappingsDto format
    *
    * Usage: node scripts/transform-convex-mappings.js item-mapping.json > mappings-seed.json
    */
   const fs = require('fs');
   const input = JSON.parse(fs.readFileSync(process.argv[2], 'utf-8'));

   // Group by vendorId
   const byVendor = {};
   for (const m of input) {
     // Skip entries with empty erpCode (default fallback)
     if (!m.erpCode || m.erpCode.trim() === '') continue;
     if (!byVendor[m.vendorId]) byVendor[m.vendorId] = [];
     byVendor[m.vendorId].push({
       mappingType: m.mappingType,
       erpCode: m.erpCode,
       restoCode: m.restoCode,
       restoLabel: m.restoLabel,
     });
   }

   // Output one seed payload per vendor
   const vendors = Object.keys(byVendor);
   if (vendors.length === 1) {
     // Single vendor — output directly as SeedErpMappingsDto
     console.log(
       JSON.stringify(
         {
           vendorId: vendors[0],
           mappings: byVendor[vendors[0]],
         },
         null,
         2,
       ),
     );
   } else {
     // Multiple vendors — output array
     console.log(
       JSON.stringify(
         vendors.map(v => ({ vendorId: v, mappings: byVendor[v] })),
         null,
         2,
       ),
     );
   }
   ```

2. **Run transformation:**

   ```bash
   node scripts/transform-convex-mappings.js item-mapping.json > mappings-seed.json
   # Verify: cat mappings-seed.json | jq '.mappings | length'  # Should be 102 (103 minus 1 empty erpCode)
   ```

3. **Seed via API:**

   ```bash
   # Ensure API is running with the seed endpoint available
   curl -X POST http://localhost:3000/api/admin/mappings/seed \
     -H "X-API-Key: $API_SECRET" \
     -H "Content-Type: application/json" \
     -d @mappings-seed.json
   ```

4. **Validate completeness with SQL queries:**

   ```sql
   -- Count by mapping type (expected: unit=38+, vat=22, family=7, subfamily=35)
   SELECT mapping_type, COUNT(*)
   FROM erp_code_mappings
   GROUP BY mapping_type
   ORDER BY mapping_type;

   -- Verify no inactive mappings were imported
   SELECT COUNT(*) FROM erp_code_mappings WHERE is_active = false;
   -- Expected: 0

   -- Verify vendor coverage
   SELECT DISTINCT vendor_id FROM erp_code_mappings ORDER BY vendor_id;
   -- Expected: 971a1d7b-8cd4-41d9-925f-f658deb6efa5

   -- Spot-check critical unit mappings
   SELECT erp_code, resto_code, resto_label
   FROM erp_code_mappings
   WHERE vendor_id = '971a1d7b-8cd4-41d9-925f-f658deb6efa5'
     AND mapping_type = 'unit'
   ORDER BY erp_code;

   -- Spot-check critical VAT mappings
   SELECT erp_code, resto_code, resto_label
   FROM erp_code_mappings
   WHERE vendor_id = '971a1d7b-8cd4-41d9-925f-f658deb6efa5'
     AND mapping_type = 'vat'
   ORDER BY erp_code;
   ```

5. **Validate via ERP mapping cache (optional):**

   ```bash
   # Test that the mapping service can resolve a known code
   # This verifies the full flow: DB → cache → resolution
   curl http://localhost:3000/api/admin/mappings?vendorId=971a1d7b-8cd4-41d9-925f-f658deb6efa5&type=unit \
     -H "X-API-Key: $API_SECRET"
   ```

**Files to create:**

- `scripts/transform-convex-mappings.js`

**Files used (input):**

- `item-mapping.json` (Convex export — already exists in repo root)

**Files generated (output):**

- `mappings-seed.json` (generated, add to `.gitignore`)

**Validation Commands:**

```bash
# Transform
node scripts/transform-convex-mappings.js item-mapping.json > mappings-seed.json

# Seed (requires API running)
curl -s -X POST http://localhost:3000/api/admin/mappings/seed \
  -H "X-API-Key: $API_SECRET" \
  -H "Content-Type: application/json" \
  -d @mappings-seed.json | jq .

# Verify count via Drizzle Studio
pnpm --filter @apps/api db:studio
# Or via direct SQL query
```

**Acceptance Criteria:**

- [ ] Transformation script created and working
- [ ] 102+ mappings imported into `erp_code_mappings` table (103 minus empty erpCode entry)
- [ ] All 4 mapping types present: unit (38+), vat (22), family (7), subfamily (35)
- [ ] All mappings active (`is_active = true`)
- [ ] Vendor `971a1d7b-8cd4-41d9-925f-f658deb6efa5` covered
- [ ] `ErpMappingService.resolve()` successfully resolves known codes (e.g., `resolve(vendorId, 'unit', 'KG')` returns `unit_kg_rm`)
- [ ] `mappings-seed.json` added to `.gitignore`

---

### Task 7: Circuit Breaker Service

- **Priority:** P0
- **Risk:** low
- **Status:** passing
- **Depends on:** Task 4
- **Complexity:** 4
- **Spec reference:** REQ-7

**Description:**  
Per-vendor circuit breaker using `opossum`. Wraps all outbound HTTP calls to agents.

**Validation Commands:**

```bash
pnpm turbo lint --filter=@apps/api --fix
pnpm turbo build --filter=@apps/api
pnpm turbo test --filter=@apps/api -- --testPathPattern=circuit-breaker
pnpm turbo type-check
```

---

### Task 8: Agent Communication Service

- **Priority:** P0
- **Risk:** medium
- **Status:** passing
- **Depends on:** Task 5, Task 7
- **Complexity:** 5
- **Spec reference:** REQ-6, REQ-7

**Description:**  
HTTP client for calling vendor agents, wrapped in circuit breaker. Used by order sync processor and reconciliation.

**Validation Commands:**

```bash
pnpm turbo lint --filter=@apps/api --fix
pnpm turbo build --filter=@apps/api
pnpm turbo test --filter=@apps/api -- --testPathPattern=agent-communication
pnpm turbo type-check
```

---

## Phase 5: Direct Ingest (Task 9)

### Task 9: Sync Ingest Service + Controller (Direct Pipeline)

- **Priority:** P0
- **Risk:** high (core architectural change)
- **Status:** passing
- **Depends on:** Task 6, Task 3
- **Complexity:** 8
- **Spec reference:** REQ-5

> **Note:** Currently uses raw Drizzle queries (tech debt). Task 2.7 will refactor to use repositories.

**Description:**  
**This is the most important task.** Agents POST directly to NestJS → validate → deduplicate → map → upsert to PostgreSQL. One hop, direct to database.

**Endpoints:**

- `POST /api/sync/items` + `POST /api/sync/items/batch` (items sync)
- `POST /api/sync/stock` + `POST /api/sync/stock/batch` (stock sync)
- `POST /api/sync/warehouses` + `POST /api/sync/warehouses/batch` (warehouse sync)

**Pipeline:** validate → check content_hash → compare timestamp → resolve ERP mappings → batch upsert → return per-item status

**Validation Commands:**

```bash
pnpm turbo lint --filter=@apps/api --fix
pnpm turbo build --filter=@apps/api
pnpm turbo test --filter=@apps/api -- --testPathPattern=sync-ingest
pnpm turbo type-check
```

---

## Phase 6: Outbound Sync — Order→ERP (Tasks 10-12)

### Task 10: Sync Job Service

- **Priority:** P0
- **Risk:** high
- **Status:** passing
- **Depends on:** Task 3
- **Complexity:** 6
- **Spec reference:** REQ-6

**Description:**  
Manage sync job lifecycle in PostgreSQL + enqueue BullMQ jobs. createOrderJob, markProcessing, markCompleted, markFailed, getJob, getPendingJobs.

**Validation Commands:**

```bash
pnpm turbo lint --filter=@apps/api --fix
pnpm turbo build --filter=@apps/api
pnpm turbo test --filter=@apps/api -- --testPathPattern=sync-job
pnpm turbo type-check
```

---

### Task 11: Order Sync Processor + Agent Callback Controller

- **Priority:** P0
- **Risk:** high
- **Status:** **BLOCKED** — depends on Task 2.1, Task 2.5, Task 2.6
- **Depends on:** Task 2.1, Task 2.5, Task 2.6, Task 8, Task 10
- **Complexity:** 7
- **Spec reference:** REQ-6

> **WARNING (2026-02-12):** This task was previously marked "passing" but is a **false positive**. The `OrderSyncProcessor` and callback controller exist as code, but they cannot function because:
>
> 1. No `orders` table exists — `sync_jobs.postgres_order_id` FK is orphaned
> 2. No `OrdersModule` exists — no service emits `order.created` events
> 3. No `OrdersRepository` exists — callback cannot update `orders.erp_reference`
> 4. No `ItemsRepository`, `WarehousesRepository`, `StockRepository` exist

**Description:**  
BullMQ processor that sends orders to ERP agents, and controller that receives callbacks.

**Unblock requirements (critical path):**

1. Complete Task 2.1 (orders schema)
2. Complete Task 2.5 (business entity repositories)
3. Complete Task 2.6 (orders module with event emission)

**Implementation changes needed after unblock:**

1. **`order-erp-sync.listener.ts`** — Create in `src/modules/sync/listeners/`:
   - Listen for `order.created` event (from `OrdersService`)
   - Call `SyncJobService.createOrderJob(event.vendorId, event.orderId, event.orderData)`

2. **`agent-callback.controller.ts`** — Update to use `OrdersService`:
   - On `completed` callback: `ordersService.updateErpReference(orderId, erpReference, erpDocumentId)`

3. **`order-sync.processor.ts`** — Already exists, verify integration with orders schema

**Validation Commands:**

```bash
pnpm turbo lint --filter=@apps/api --fix
pnpm turbo build --filter=@apps/api
pnpm turbo test --filter=@apps/api -- --testPathPattern=order-sync|agent-callback
pnpm turbo type-check
```

**Acceptance Criteria:**

- [ ] `OrderErpSyncListener` listens to `order.created` event
- [ ] `OrderSyncProcessor` sends order to agent via circuit breaker
- [ ] `AgentCallbackController` updates `orders` table on success
- [ ] Full flow tested: order created → job → agent called → callback → order updated
- [ ] All tests pass
- [ ] Build passes

---

### Task 11.5: Full Codebase Validation + Fix All Issues

- **Priority:** P0 (BLOCKING — must pass before any new feature work)
- **Risk:** medium
- **Status:** passing
- **Depends on:** Task 11
- **Complexity:** 5

**Description:**
Run the full validation suite across the entire monorepo — lint, build, type-check, unit tests. Fix every error before continuing with Task 12+.

**Validation Commands:**

```bash
pnpm turbo lint --filter=@apps/api --fix
pnpm turbo lint --filter=@repo/shared --fix
pnpm turbo build --filter=@repo/shared
pnpm turbo build --filter=@apps/api
pnpm turbo type-check
pnpm turbo test --filter=@apps/api
pnpm turbo test:e2e --filter=@apps/api
```

---

### Task 12: Dead Letter Queue Service

- **Priority:** P0
- **Risk:** low
- **Status:** passing
- **Depends on:** Task 11.5
- **Complexity:** 4
- **Spec reference:** REQ-8

**Description:**  
Manage permanently failed jobs — add, list, retry, resolve with audit trail.

**Validation Commands:**

```bash
pnpm turbo lint --filter=@apps/api --fix
pnpm turbo build --filter=@apps/api
pnpm turbo test --filter=@apps/api -- --testPathPattern=dead-letter
pnpm turbo type-check
```

---

## Phase 7: Background Services (Tasks 13-16)

### Task 13: Reconciliation Service

- **Priority:** P1
- **Risk:** medium
- **Status:** passing
- **Depends on:** Task 8
- **Complexity:** 7
- **Spec reference:** REQ-9

**Description:**  
Drift detection via checksum comparison, binary search resolution. ERP always wins for physical stock.

**Validation Commands:**

```bash
pnpm turbo lint --filter=@apps/api --fix
pnpm turbo build --filter=@apps/api
pnpm turbo test --filter=@apps/api -- --testPathPattern=reconciliation
pnpm turbo type-check
```

---

### Task 14: Sync Scheduler + Cleanup + Alert Services

- **Priority:** P1
- **Risk:** low
- **Status:** passing
- **Depends on:** Task 5, Task 12, Task 13
- **Complexity:** 5
- **Spec reference:** REQ-10

**Description:**  
Scheduled background tasks via `@nestjs/schedule`: hourly drift detection, 5min agent health, 15min DLQ check, daily cleanup, weekly archive/cleanup.

**Validation Commands:**

```bash
pnpm turbo lint --filter=@apps/api --fix
pnpm turbo build --filter=@apps/api
pnpm turbo test --filter=@apps/api -- --testPathPattern=sync-scheduler|alert|sync-cleanup
pnpm turbo type-check
```

---

### Task 15: Sync Metrics Service

- **Priority:** P1
- **Risk:** low
- **Status:** passing
- **Depends on:** Task 10
- **Complexity:** 4
- **Spec reference:** REQ-11

**Description:**  
PostgreSQL aggregation queries for sync job metrics, reconciliation metrics, and agent health dashboard.

**Validation Commands:**

```bash
pnpm turbo lint --filter=@apps/api --fix
pnpm turbo build --filter=@apps/api
pnpm turbo test --filter=@apps/api -- --testPathPattern=sync-metrics
pnpm turbo type-check
```

---

### Task 16: Enhanced Health Checks

- **Priority:** P1
- **Risk:** low
- **Status:** passing
- **Depends on:** Task 4
- **Complexity:** 3
- **Spec reference:** REQ-11

**Description:**  
Custom health indicators for Redis, BullMQ, database, and agent health integrated into `/health` endpoint.

**Validation Commands:**

```bash
pnpm turbo lint --filter=@apps/api --fix
pnpm turbo build --filter=@apps/api
pnpm turbo test --filter=@apps/api -- --testPathPattern=health
pnpm turbo type-check
```

---

## Phase 8: DevOps & Hardening (Tasks 17-22)

### Task 17: Secrets Management + .env Hardening

- **Priority:** P0
- **Risk:** medium
- **Status:** passing
- **Depends on:** Task 1
- **Complexity:** 3

**Description:**  
Ensure no secrets in code, complete `.env.example`, add gitignore rules, create secrets check script.

**Validation Commands:**

```bash
pnpm turbo lint --filter=@apps/api --fix
pnpm turbo build --filter=@apps/api
pnpm turbo type-check
bash scripts/check-secrets.sh
```

---

### Task 18: Docker Image Tagging + Rollback Script

- **Priority:** P1
- **Risk:** low
- **Status:** passing
- **Depends on:** Task 16
- **Complexity:** 4

**Description:**  
Tag Docker images with Git SHA, create rollback script and runbook.

**What exists:**

- `apps/api/Dockerfile` — production Docker image
- `infrastructure/scripts/rollback.sh` — rollback to previous Docker image by Git SHA (365 lines)
- `infrastructure/scripts/cleanup-images.sh` — prune old Docker images (365 lines)
- CI/CD pipeline handles image tagging with Git SHA via `.github/workflows/ci-cd.yml`

> **Note:** Implementation lives in `infrastructure/scripts/` rather than `scripts/` as originally planned. `docs/rollback-runbook.md` still missing (minor doc gap).

---

### Task 19: GitHub Actions CI/CD

- **Priority:** P1
- **Risk:** medium
- **Status:** passing
- **Depends on:** Task 18
- **Complexity:** 5

**Description:**  
CI/CD pipeline: lint → test → build → Docker → deploy. Security scanning with Trivy.

**What exists:**

- `.github/workflows/ci-cd.yml` — comprehensive pipeline (988 lines): lint → test → build → Docker build/push → deploy, includes Trivy security scanning
- `.github/workflows/cleanup-images.yml` — automated Docker image cleanup
- `infrastructure/scripts/setup-github-secrets.sh` — GitHub secrets setup helper

> **Note:** Security scanning is integrated into `ci-cd.yml` rather than a separate `security-scan.yml`. `.github/dependabot.yml` not present (minor gap).

---

### Task 20: Zero-Downtime Deployment Script

- **Priority:** P1
- **Risk:** medium
- **Status:** passing
- **Depends on:** Task 18
- **Complexity:** 6

**Description:**  
Blue-green deployment with health verification and automatic rollback.

**What exists:**

- `infrastructure/scripts/deploy.sh` — blue-green zero-downtime deployment script (327 lines) with health checks, automatic rollback, configurable timeouts

> **Note:** Implementation lives in `infrastructure/scripts/deploy.sh` rather than `scripts/deploy-blue-green.sh`. `docs/deployment-runbook.md` still missing (minor doc gap).

---

### Task 21: Verify Correlation ID Propagation in Sync Services

- **Priority:** P1
- **Risk:** low
- **Status:** passing
- **Depends on:** Task 4
- **Complexity:** 2

**Description:**
Verify that sync services properly propagate correlation ID through agent HTTP calls and BullMQ jobs. `CorrelationIdMiddleware` already exists and is globally applied.

**Verified:**

- `AgentCommunicationService` passes `X-Correlation-ID` header in all agent HTTP calls
- `SyncJobService` includes `correlationId` in BullMQ job payloads (7 references)
- All sync log entries include correlation context via Pino logger

---

### Task 22: Integration Tests

- **Priority:** P1
- **Risk:** low
- **Status:** not started
- **Depends on:** Tasks 9, 11, 13
- **Complexity:** 6

**Description:**  
End-to-end tests for all sync flows: agent registration, item/stock/warehouse sync, order sync, health checks, rate limiting.

**Validation Commands:**

```bash
pnpm turbo lint --filter=@apps/api --fix
pnpm turbo build --filter=@apps/api
pnpm turbo test --filter=@apps/api
pnpm turbo test:e2e --filter=@apps/api
pnpm turbo type-check
```

---

## Summary

| Phase              | Tasks    | Key Deliverable                                           |
| ------------------ | -------- | --------------------------------------------------------- |
| Pre-Impl Checklist | —        | Export & verify Convex ERP mappings                       |
| 1: Foundation      | 1-2      | BullMQ, schedule, opossum deps, config, sync schemas      |
| 1b: Gap Closure    | 2.1-2.7  | Orders schema, field updates, business repos, module      |
| 2: Repositories    | 3        | 5 typed sync repositories                                 |
| 3: Module Scaffold | 4        | SyncModule, guards, directory structure                   |
| 4: Core Services   | 5-8, 6.1 | Agent registry, mappings + Convex seed, circuit breaker   |
| 5: Direct Ingest   | 9        | **Agent → NestJS → PG (direct pipeline)**                 |
| Gate: Validation   | 11.5     | **Lint, build, type-check, tests — zero failures**        |
| 6: Outbound Sync   | 10-12    | BullMQ order→ERP, callback, DLQ                           |
| 7: Background      | 13-16    | Reconciliation, scheduler, metrics, health                |
| 8: Hardening       | 17-22    | Secrets, CI/CD, deployment, correlation — **E2E pending** |
| **Total**          | **31**   | **Production-grade NestJS ERP sync**                      |

---

## Quick Status Dashboard

| #    | Task                               | Phase         | Priority | Status          | Notes                                |
| ---- | ---------------------------------- | ------------- | -------- | --------------- | ------------------------------------ |
| 1    | Dependencies + Redis + Config      | Foundation    | P0       | passing         |                                      |
| 2    | Sync Database Schemas (Drizzle)    | Foundation    | P0       | passing         | Sync tables only                     |
| 2.1  | Orders & Order Items Schemas       | Gap Closure   | P0       | passing         | orders + order_items tables created  |
| 2.2  | Items Schema — Missing Fields      | Gap Closure   | P0       | passing         | 7 ERP fields added                   |
| 2.3  | Warehouses Schema — Missing Fields | Gap Closure   | P1       | passing         | isDefault, isMain, type added        |
| 2.4  | Stock Schema — Missing Fields      | Gap Closure   | P1       | passing         | 5 cost/inventory fields added        |
| 2.5  | Business Entity Repositories       | Gap Closure   | P0       | passing         | 5 base repos + 5 adapters            |
| 2.6  | Orders Module                      | Gap Closure   | P0       | passing         | OrdersService + SyncJobService wired |
| 2.7  | Refactor SyncIngest → Repositories | Gap Closure   | P1       | not started     | Tech debt cleanup                    |
| 3    | Sync Repositories                  | Repositories  | P0       | passing         |                                      |
| 4    | SyncModule Skeleton + Guards       | Scaffold      | P0       | passing         |                                      |
| 5    | Agent Registry Service             | Core Services | P0       | passing         |                                      |
| 6    | ERP Code Mapping Service           | Core Services | P0       | passing         |                                      |
| 6.1  | Seed ERP Mappings from Convex      | Core Services | P0       | **not started** | **BLOCKING** Task 9 validation       |
| 7    | Circuit Breaker Service            | Core Services | P0       | passing         |                                      |
| 8    | Agent Communication Service        | Core Services | P0       | passing         |                                      |
| 9    | Sync Ingest Service + Controller   | Direct Ingest | P0       | passing         | Uses raw Drizzle (see Task 2.7)      |
| 10   | Sync Job Service                   | Outbound Sync | P0       | passing         |                                      |
| 11   | Order Sync Processor + Callback    | Outbound Sync | P0       | **UNBLOCKED**   | Ready to implement                   |
| 11.5 | Full Validation + Fix Issues       | Gate          | P0       | passing         |                                      |
| 12   | Dead Letter Queue Service          | Outbound Sync | P0       | passing         |                                      |
| 13   | Reconciliation Service             | Background    | P1       | passing         |                                      |
| 14   | Scheduler + Cleanup + Alerts       | Background    | P1       | passing         |                                      |
| 15   | Sync Metrics Service               | Background    | P1       | passing         |                                      |
| 16   | Enhanced Health Checks             | Background    | P1       | passing         |                                      |
| 17   | Secrets Management                 | Hardening     | P0       | passing         |                                      |
| 18   | Docker Image Tagging + Rollback    | Hardening     | P1       | passing         | In `infrastructure/scripts/`         |
| 19   | GitHub Actions CI/CD               | Hardening     | P1       | passing         | ci-cd.yml + cleanup-images.yml       |
| 20   | Zero-Downtime Deployment           | Hardening     | P1       | passing         | `infrastructure/scripts/deploy.sh`   |
| 21   | Verify Correlation ID Propagation  | Hardening     | P1       | passing         | Verified in agent-comm + sync-job    |
| 22   | Integration Tests                  | Hardening     | P1       | not started     |                                      |

---

## Dependency Graph

```
                                                                    Task 6.1 (Seed Mappings)
                                                                        │
Task 1 ──→ Task 2 ──→ Task 3 ──→ Task 4 ──→ Tasks 5-8 ──→ Task 9 ←────┘ ──→ Task 10 ──→ Task 12
              │                                                           │
              ├──→ Task 2.1 ──→ Task 2.5 ──→ Task 2.6 ──────────────────┤
              │                     │                                     │
              ├──→ Task 2.2 ────────┘                                     ▼
              │                                                       Task 11 ──→ Task 11.5
              ├──→ Task 2.3                                               │
              ├──→ Task 2.4                                               ▼
              │                                                       Tasks 13-16
              └──→ Task 2.7 (after Task 2.5 + Task 9)                    │
                                                                          ▼
                                                                      Tasks 17-22
```

**Critical path:** 2 → 2.1 → 2.2 → 2.5 → 2.6 → 11 → 11.5 → 18-22  
**Ingest validation path:** 6 → 6.1 (seed mappings) → 9 (ingest works end-to-end)

---

## Post-MVP Deferred Items

These were identified in the gap analysis but deferred:

- Frontend customer management module
- Oxatis e-commerce integration fields (`meta_title`, `meta_description`, `meta_keywords`)
- Web publishing flags (`publish_on_web` on items)
- GPS coordinates for warehouses (`latitude`, `longitude`)
- Physical dimensions for items (`weight`, `height`, `width`, `length`)
- Advanced stock management (`stockBookingAllowed`, `automaticStockBooking`, `trackingMode`)
- Denormalized stock totals on items (`totalRealStock`, `totalVirtualStock`)
- Min/max stock thresholds beyond basic `minStock`/`maxStock`
