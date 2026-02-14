# Sync Architecture — Feature Specification

> **Version:** 2.1  
> **Last Updated:** 2026-02-12  
> **Status:** APPROVED — REVISED after gap analysis  
> **Revision:** Fixed REQ-2 NOTE, added REQ-2.5 (Business Repos), added REQ-2.6 (Orders Module)

---

## Revision History

| Date       | Version | Change                                                                            |
| ---------- | ------- | --------------------------------------------------------------------------------- |
| 2026-02-12 | 2.1     | Fixed REQ-2 NOTE (business tables exist), added REQ-2.5/2.6, updated module graph |
| 2026-02-12 | 2.0     | Initial NestJS spec                                                               |

---

## Overview

ERP synchronization architecture for the NestJS RestoMarket application.

**One sentence:** `Agent → NestJS → PostgreSQL` — one hop, full control.

This spec defines native NestJS sync modules using BullMQ, Redis, `@nestjs/schedule`, `opossum`, and production-grade security/performance hardening.

## Business Context

| Dimension      | Target           |
| -------------- | ---------------- |
| ERP→DB latency | 50-150ms (1 hop) |
| Order→ERP hops | 2                |
| Deployments    | 1                |
| Databases      | 1 (PG + Redis)   |
| Vendor lock-in | None             |
| Log streams    | 1 (unified)      |

---

## Architecture

```
Agent ↔ NestJS (validate → map → deduplicate → upsert) ↔ PG + Redis
```

### Infrastructure

| Component         | Purpose                                                     | Status          |
| ----------------- | ----------------------------------------------------------- | --------------- |
| PostgreSQL 16     | Primary data store                                          | Already running |
| Redis 7+          | BullMQ backing, circuit breaker state, rate limiter backing | Configured      |
| BullMQ            | Job queues with retry, backoff, DLQ, concurrency            | Configured      |
| opossum           | Circuit breaker (in-process, per-vendor)                    | Configured      |
| @nestjs/schedule  | Cron and interval decorators                                | Configured      |
| @nestjs/throttler | Request rate limiting                                       | Already existed |
| helmet            | HTTP security headers                                       | Already existed |
| @nestjs/terminus  | Health checks (PG, Redis, BullMQ, agents)                   | Configured      |

### Module Dependency Graph

```
AppModule
├── ConfigModule (global)
├── LoggerModule (global, nestjs-pino)
├── EventEmitterModule (global)
├── ThrottlerModule (global)
├── ScheduleModule
├── BullModule.forRoot()
├── DatabaseModule
│   ├── Business schemas: items, warehouses, stock, orders*, order_items*
│   ├── Sync schemas: sync_jobs, agent_registry, erp_code_mappings, dead_letter_queue, reconciliation_events
│   ├── Auth/Org schemas: auth_users, organizations, etc.
│   ├── Sync repos: SyncJobs, AgentRegistry, ErpCodeMappings, DeadLetterQueue, ReconciliationEvents
│   └── Business repos*: Items, Warehouses, Stock, Orders, OrderItems
├── SyncModule (src/modules/sync/)
│   ├── Controllers: AgentIngest, AgentRegistry, AgentCallback, ErpMapping, SyncAdmin
│   ├── Services: AgentRegistry, SyncIngest, SyncJob, AgentCommunication, ErpMapping,
│   │             CircuitBreaker, Reconciliation, DeadLetterQueue, SyncMetrics, SyncCleanup, Alert
│   ├── Processors: OrderSyncProcessor (BullMQ)
│   ├── Schedulers: SyncSchedulerService
│   ├── Listeners: OrderErpSyncListener*
│   └── Guards: AgentAuthGuard, ApiKeyGuard
├── OrdersModule* (src/modules/orders/) — emits order.created events
├── HealthModule (enhanced: Redis, BullMQ, agent indicators)
├── UsersModule
└── UploadModule

* = NOT YET IMPLEMENTED (see Tasks 2.1-2.6 in IMPLEMENTATION_PLAN.md)
```

### Database Schema Map

```
┌─────────────────── BUSINESS TABLES ───────────────────┐
│                                                         │
│  items (EXISTS)              orders* (MISSING)          │
│  ├── content_hash ✓          ├── erp_reference          │
│  ├── last_synced_at ✓        ├── vendor_id              │
│  ├── erp_id* (MISSING)       ├── customer_id            │
│  ├── price_excl_vat*         └── content_hash           │
│  └── manage_stock*                                      │
│                              order_items* (MISSING)     │
│  warehouses (EXISTS)         ├── order_id FK→orders     │
│  ├── content_hash ✓          ├── item_id FK→items       │
│  ├── last_synced_at ✓        └── reservation tracking   │
│  ├── is_default* (MISSING)                              │
│  └── type* (MISSING)        stock (EXISTS)              │
│                              ├── content_hash ✓          │
│                              ├── last_synced_at ✓        │
│                              ├── pump* (MISSING)         │
│                              └── stock_value* (MISSING)  │
└─────────────────────────────────────────────────────────┘

┌─────────────────── SYNC TABLES (ALL EXIST) ───────────┐
│                                                         │
│  sync_jobs              agent_registry                  │
│  ├── postgres_order_id  ├── vendor_id (unique)          │
│  ├── status             ├── auth_token_hash             │
│  └── retry tracking     └── last_heartbeat              │
│                                                         │
│  erp_code_mappings      dead_letter_queue               │
│  ├── vendor+type+code   ├── original_job_id FK          │
│  └── resto_code         └── resolved tracking           │
│                                                         │
│  reconciliation_events                                  │
│  ├── event_type                                         │
│  └── summary (JSONB)                                    │
└─────────────────────────────────────────────────────────┘

* = Field/table needs to be created (see Tasks 2.1-2.4)
```

---

## P0 Requirements (Must Have — Blocks Production)

### REQ-1: Sync Module Foundation

**Goal:** Create the `src/modules/sync/` NestJS module for ERP synchronization.

**Status:** IMPLEMENTED

**Requirements:**

- SyncModule registers all sync controllers, services, processors, schedulers
- BullMQ queues registered: `order-sync`, `reconciliation`, `image-sync`
- Redis connection via `REDIS_URL` env var with connection error handling
- All services injectable via NestJS DI container

**Acceptance Criteria:**

- [x] `SyncModule` registered in `AppModule`
- [x] BullMQ connected to Redis on startup (verified via health check)
- [x] `ScheduleModule.forRoot()` registered
- [x] `ThrottlerModule.forRoot()` registered with default 60 req/min
- [x] `REDIS_URL`, `AGENT_SECRET`, `API_SECRET` added to config schema (Zod)
- [x] All sync services resolvable via DI (build passes)

---

### REQ-2: Database Schema — Sync Coordination Tables

**Goal:** PostgreSQL tables for sync coordination state.

**Status:** IMPLEMENTED (sync tables), PARTIALLY IMPLEMENTED (business tables)

**Sync tables (all exist):**

| Table                   | Key Design                                                              | Status |
| ----------------------- | ----------------------------------------------------------------------- | ------ |
| `sync_jobs`             | UUID PK, FK→orders, JSONB payload, status enum, retry tracking, 24h TTL | EXISTS |
| `agent_registry`        | UUID PK, unique vendor_id, agent_url, bcrypt auth_token_hash, heartbeat | EXISTS |
| `erp_code_mappings`     | Composite unique (vendor_id, mapping_type, erp_code), is_active flag    | EXISTS |
| `dead_letter_queue`     | FK→sync_jobs, JSONB payload, resolved/unresolved tracking               | EXISTS |
| `reconciliation_events` | JSONB summary, event_type enum, duration_ms                             | EXISTS |

**Business entity tables:**

| Table         | Status  | Notes                                                                                                                       |
| ------------- | ------- | --------------------------------------------------------------------------------------------------------------------------- |
| `items`       | EXISTS  | Has `content_hash` + `last_synced_at`. Missing: `erp_id`, `price_excl_vat`, `price_incl_vat`, `manage_stock` (see Task 2.2) |
| `warehouses`  | EXISTS  | Has `content_hash` + `last_synced_at`. Missing: `is_default`, `is_main`, `type` (see Task 2.3)                              |
| `stock`       | EXISTS  | Has `content_hash` + `last_synced_at`. Missing: `pump`, `stock_value`, `ordered_quantity` (see Task 2.4)                    |
| `orders`      | MISSING | Must be created — ~40 fields with full ERP integration (see Task 2.1)                                                       |
| `order_items` | MISSING | Must be created — ~30 fields with reservation tracking (see Task 2.1)                                                       |

> **NOTE (CORRECTED 2026-02-12):** `items`, `stock`, `warehouses` tables ALREADY EXIST with `content_hash` and `last_synced_at` columns for deduplication. However, additional ERP-specific fields are needed (see Tasks 2.2-2.4 in `IMPLEMENTATION_PLAN.md`). The `orders` and `order_items` tables do NOT exist yet and must be created as a prerequisite (see Task 2.1).

**Acceptance Criteria:**

- [x] 5 Drizzle sync schema files in `packages/shared/src/database/schema/`
- [x] All exported from `packages/shared/src/database/schema/index.ts`
- [x] Relations in `packages/shared/src/database/schema/sync-relations.ts`
- [x] 5 base sync repository classes in `packages/shared/` extending `BaseRepository`
- [x] 5 NestJS adapter sync repositories in `apps/api/src/database/adapters/`
- [x] New schemas added to explicit schema object in `apps/api/src/database/database.module.ts`
- [x] Migration generated and applied
- [x] All columns use snake_case, all PKs are UUID
- [ ] `orders` schema created (Task 2.1 — **NOT YET DONE**)
- [ ] `order_items` schema created (Task 2.1 — **NOT YET DONE**)
- [ ] Missing business fields added (Tasks 2.2-2.4 — **NOT YET DONE**)

---

### REQ-2.5: Business Entity Repositories (NEW)

**Goal:** Create repository abstractions for business entity tables following the two-layer pattern.

**Status:** NOT IMPLEMENTED

**Context:** Sync repositories (SyncJobs, AgentRegistry, ErpCodeMappings, DeadLetterQueue, ReconciliationEvents) already exist and follow the two-layer pattern. Business entity repositories do not exist yet. `SyncIngestService` currently uses raw Drizzle queries as a workaround.

**Pattern:**

1. Base repository in `packages/shared/src/database/repositories/<entity>/<entity>.repository.base.ts`
2. NestJS adapter in `apps/api/src/database/adapters/nestjs-<entity>.repository.ts`

**Repositories to create:**

| Repository           | Key Methods                                                                 |
| -------------------- | --------------------------------------------------------------------------- |
| ItemsRepository      | `findByVendorAndSku`, `findByVendorAndErpId`, `upsertBatch`, `findByVendor` |
| WarehousesRepository | `findByVendorAndErpId`, `upsertBatch`, `findByVendor`                       |
| StockRepository      | `findByVendorWarehouseItem`, `upsertBatch`, `updateQuantity`                |
| OrdersRepository     | `create`, `findById`, `updateErpReference`, `findByVendor`                  |
| OrderItemsRepository | `createBatch`, `findByOrderId`, `updateDeliveryStatus`                      |

**Benefits over raw Drizzle:**

- Type-safe query methods
- Centralized query logic (reusable across services)
- Transaction support via `BaseRepository.transaction()`
- Error handling via `handleError()`
- Testability via mocking repositories instead of database
- Consistent logging via `ILogger` interface

**Acceptance Criteria:**

- [ ] 5 base repositories in `packages/shared/` extending `BaseRepository<TTable>`
- [ ] 5 NestJS adapters in `apps/api/` wrapping base + PinoLogger
- [ ] All repositories provided and exported in `DatabaseModule`
- [ ] All query methods type-safe
- [ ] Transaction support working
- [ ] Build passes

---

### REQ-2.6: Orders Module (NEW)

**Goal:** Create the `OrdersModule` with service, controller, DTOs, and event emission for the order→ERP sync flow.

**Status:** NOT IMPLEMENTED

**Context:** The order sync flow (REQ-6) requires an `order.created` event to trigger sync job creation. No orders module currently exists — there is no service, controller, or DTO for order management.

**Module structure:**

```
apps/api/src/modules/orders/
├── orders.module.ts
├── orders.service.ts
├── orders.controller.ts
├── dto/
│   ├── create-order.dto.ts
│   ├── order-item.dto.ts
│   └── address.dto.ts
├── events/
│   └── order-created.event.ts
└── __tests__/
    └── orders.service.spec.ts
```

**Endpoints:**

| Method | Path              | Auth       | Purpose                   |
| ------ | ----------------- | ---------- | ------------------------- |
| POST   | `/api/orders`     | Bearer/TBD | Create order + emit event |
| GET    | `/api/orders/:id` | Bearer/TBD | Get order details         |
| GET    | `/api/orders`     | Bearer/TBD | List orders (paginated)   |

**Event flow:**

```
OrdersService.createOrder()
  → INSERT into orders + order_items
  → EventEmitter.emit('order.created', OrderCreatedEvent)
  → OrderErpSyncListener catches event (in SyncModule)
  → SyncJobService.createOrderJob()
  → BullMQ queue
```

**Acceptance Criteria:**

- [ ] `OrdersModule` registered in `AppModule`
- [ ] `OrdersService.createOrder()` emits `order.created` event
- [ ] `OrdersController` with 3 endpoints + Swagger decorators
- [ ] DTOs with class-validator validation
- [ ] Unit tests passing
- [ ] Build passes

---

### REQ-3: Agent Registry

**Goal:** Full agent lifecycle with heartbeat health monitoring.

**Status:** IMPLEMENTED

**Endpoints:**

| Method | Path                    | Auth   | Purpose                            |
| ------ | ----------------------- | ------ | ---------------------------------- |
| POST   | `/api/agents/register`  | Bearer | Agent self-registration (upsert)   |
| POST   | `/api/agents/heartbeat` | Bearer | Agent heartbeat (every 30s)        |
| DELETE | `/api/agents/:vendorId` | ApiKey | Admin: deregister agent            |
| GET    | `/api/agents`           | ApiKey | Admin: list all agents with health |
| GET    | `/api/agents/:vendorId` | ApiKey | Admin: get agent detail            |

**Status transitions:**

```
online ──(no heartbeat 60s)──→ degraded ──(no heartbeat 300s)──→ offline
   ↑                                                                 │
   └──────────────(heartbeat received)───────────────────────────────┘
```

**Security:**

- Agent registration sends plaintext token; service hashes with bcrypt (10 rounds) and stores hash
- Subsequent requests verify Bearer token against stored hash
- Rate limit: 10 registrations/min per IP, 120 heartbeats/min per agent

**Acceptance Criteria:**

- [x] `AgentRegistryService` with register/heartbeat/deregister/getAgent/getAllAgents/checkHealth
- [x] `AgentRegistryController` with all 5 endpoints + Swagger decorators
- [x] `AgentRegistryRepository` with Drizzle typed queries
- [x] `AgentAuthGuard` validates Bearer token via bcrypt compare
- [x] Heartbeat staleness detection: degraded >60s, offline >300s
- [x] Unit tests for service logic

---

### REQ-4: ERP Code Mapping

**Goal:** Translate ERP codes to RestoMarket codes with in-memory cache.

**Status:** IMPLEMENTED

**Mapping types:** `unit`, `vat`, `family`, `subfamily`

**Resolution flow:**

```
resolve(vendorId, 'unit', 'KG')
  → cache hit? return { restoCode: 'kilogram', restoLabel: 'Kilogramme' }
  → cache miss? query DB → cache result for 5min → return
  → not found? return null (caller decides: fail item or skip mapping)
```

**Cache design:**

- Key: `${vendorId}:${type}:${erpCode}`
- TTL: 5 minutes
- Max entries: 10,000 (LRU eviction)
- Invalidated on any CRUD write operation

**Acceptance Criteria:**

- [x] `ErpMappingService.resolve(vendorId, type, erpCode)` returns `MappingResult | null`
- [x] In-memory cache with 5min TTL
- [x] Cache invalidation on write
- [x] CRUD admin endpoints with Swagger
- [x] Seed endpoint for bulk import
- [x] Unit tests

---

### REQ-5: Sync Ingest — ERP→DB Direct Pipeline (THE CORE WIN)

**Goal:** Agents POST data directly to NestJS → validate → deduplicate → map → upsert to PostgreSQL.

**Status:** IMPLEMENTED (uses raw Drizzle — repository refactor pending as Task 2.7)

#### Item Sync (`POST /api/sync/items`)

Pipeline per item:

```
1. Validate payload (class-validator DTO)
2. Check content_hash in items table → skip if identical
3. Compare timestamp vs last_synced_at → reject if stale
4. Resolve ERP code mappings:
   - unit (REQUIRED — fail item if unmapped)
   - vat (REQUIRED — fail item if unmapped)
   - family (optional — default null)
   - subfamily (optional — default null)
5. Build upsert record
6. Batch upsert via ON CONFLICT (vendor_id, sku) DO UPDATE
7. Return per-item status: { sku, status: 'processed'|'skipped'|'failed', reason? }
```

#### Stock Sync (`POST /api/sync/stock`)

```
1. Validate payload
2. Check content_hash in stock table → skip if identical
3. Compare timestamp → reject stale
4. Batch upsert via ON CONFLICT (vendor_id, warehouse_id, item_id) DO UPDATE
5. Return per-item status
```

#### Warehouse Sync (`POST /api/sync/warehouses`)

```
1. Validate payload
2. Check content_hash in warehouses table → skip if identical
3. Batch upsert via ON CONFLICT (vendor_id, erp_warehouse_id) DO UPDATE
4. Return per-item status
```

**Batch variants for full reconciliation:**

- `POST /api/sync/items/batch` — full catalog push (batches of 50, max 5000 items)
- `POST /api/sync/stock/batch` — full stock push
- `POST /api/sync/warehouses/batch` — full warehouse push

**Request limits:**

- Incremental endpoints: max 500 items, max 5MB payload
- Batch endpoints: max 5000 items, max 10MB payload
- Exceeding limits → HTTP 413 with clear error message

**Acceptance Criteria:**

- [x] `AgentIngestController` with 6 endpoints (3 incremental + 3 batch)
- [x] `SyncIngestService` with validate→deduplicate→map→upsert pipeline
- [x] Content-hash dedup uses existing `content_hash` columns on entity tables
- [x] Stale-data rejection by timestamp comparison
- [x] Mapping resolution integrated for items (unit + vat required)
- [x] Batch upsert via Drizzle `onConflictDoUpdate`
- [x] DTOs with class-validator for all payloads
- [x] Response: `{ processed, skipped, failed, results[] }`
- [x] Payload size guard: 500/5000 item limits enforced
- [x] Rate limit: 30 req/min per agent for incremental, 5 req/min for batch
- [x] Unit tests per sync type
- [ ] Repository pattern (Task 2.7 — P1 tech debt cleanup)

---

### REQ-6: Sync Job Service + BullMQ Order Processor (DB→ERP)

**Goal:** Orders flow through BullMQ for reliable delivery to ERP agents.

**Status:** PARTIALLY IMPLEMENTED — SyncJobService and OrderSyncProcessor exist, but **BLOCKED** because OrdersModule does not exist yet (see REQ-2.6)

**Order sync lifecycle:**

```
OrderCreated event (from OrdersModule — NOT YET IMPLEMENTED)
  → OrderErpSyncListener catches event
  → SyncJobService.createOrderJob(vendorId, orderData)
      → INSERT sync_jobs (status=pending)
      → BullMQ.add('order-sync', 'create-order', payload)
  → OrderSyncProcessor.process(job)
      → AgentCommunicationService.callAgent(vendorId, 'orders', '/sync/create-order', data)
      → Agent processes → HTTP POST to /api/agents/callback
  → AgentCallbackController.handleCallback()
      → status === 'completed':
          → SyncJobService.markCompleted(jobId, erpReference)
          → OrdersRepository.updateErpReference(orderId, erpReference)  ← REQUIRES OrdersRepository
      → status === 'failed':
          → SyncJobService.markFailed(jobId, error)
```

**Dependencies to resolve:**

- Task 2.1: Orders schema (for `orders` table)
- Task 2.5: OrdersRepository (for `updateErpReference`)
- Task 2.6: OrdersModule (for `order.created` event emission)

**BullMQ config:**

```typescript
{
  attempts: 5,
  backoff: { type: 'exponential', delay: 60_000 }, // 1m → 2m → 4m → 8m → 16m
  removeOnComplete: { age: 86_400 },  // 24h retention
  removeOnFail: false,                 // Keep for DLQ
}
```

**Acceptance Criteria:**

- [x] `SyncJobService` creates sync_jobs row + BullMQ job
- [x] `OrderSyncProcessor` (`@Processor('order-sync')`) calls agent via circuit breaker
- [x] `AgentCallbackController` at `POST /api/agents/callback`
- [ ] Callback updates `sync_jobs` + `orders` directly (**BLOCKED** — needs OrdersRepository)
- [x] `AgentCommunicationService` wraps HTTP via circuit breaker
- [x] BullMQ exponential backoff: 5 attempts starting at 1min
- [x] `@OnQueueFailed` moves exhausted jobs to dead_letter_queue
- [ ] `OrderErpSyncListener` uses `SyncJobService` (**BLOCKED** — needs OrdersModule)
- [x] Unit tests for job lifecycle

---

### REQ-7: Circuit Breaker

**Goal:** Per-vendor, per-API-type circuit breaker protection via `opossum`.

**Status:** IMPLEMENTED

**Configuration:**

```typescript
{
  timeout: 30_000,                 // 30s request timeout
  errorThresholdPercentage: 50,    // Open after 50% failures
  resetTimeout: 60_000,            // Try half-open after 1min
  volumeThreshold: 5,              // Min 5 calls before evaluating
}
```

**Granularity:** Per `vendorId` + `apiType` (e.g., `vendor123:items`, `vendor123:orders`)

**State transitions logged:** `open`, `halfOpen`, `close` via nestjs-pino

**Admin endpoint:** `POST /api/admin/circuit-breaker/reset` — force reset to closed state

**Acceptance Criteria:**

- [x] `CircuitBreakerService.getBreaker(vendorId, apiType)` returns/creates breaker
- [x] `CircuitBreakerService.reset(vendorId, apiType)` forces closed
- [x] `CircuitBreakerService.getStatus()` returns all breaker states
- [x] State transition events logged
- [x] Unit tests for open/close/halfOpen transitions

---

### REQ-8: Dead Letter Queue

**Goal:** Persistent store for permanently failed jobs.

**Status:** IMPLEMENTED

**Lifecycle:**

```
BullMQ job exhausts retries → @OnQueueFailed → DLQ service → INSERT dead_letter_queue
Admin reviews → retry (re-enqueue to BullMQ) or resolve (mark resolved)
```

**Endpoints:**

| Method | Path                         | Auth   | Purpose                             |
| ------ | ---------------------------- | ------ | ----------------------------------- |
| GET    | `/api/admin/dlq`             | ApiKey | List unresolved entries (paginated) |
| GET    | `/api/admin/dlq/:id`         | ApiKey | Entry details with original payload |
| POST   | `/api/admin/dlq/:id/retry`   | ApiKey | Re-enqueue to BullMQ                |
| POST   | `/api/admin/dlq/:id/resolve` | ApiKey | Mark manually resolved              |

**Acceptance Criteria:**

- [x] `DeadLetterQueueService` with add/list/get/retry/resolve/cleanup
- [x] Retry re-creates BullMQ job with original payload
- [x] Admin endpoints with pagination and Swagger
- [x] Audit log on retry and resolve actions
- [x] Unit tests

---

### REQ-9: Reconciliation Engine

**Goal:** Detect and resolve drift between ERP and PostgreSQL.

**Status:** IMPLEMENTED

**Detection flow (hourly cron):**

```
1. For each active vendor agent:
2. GET agent /sync/checksum → ERP-side hash
3. Compute PostgreSQL hash (items, stock)
4. Compare → if different → drift detected
5. Binary search: split SKU range in half, checksum each half
6. Recurse until range ≤ 10 items
7. Item-by-item comparison → resolve (ERP always wins for physical stock)
8. Log to reconciliation_events
```

**Conflict resolution rule:** ERP is always source of truth for physical stock quantities.

**Acceptance Criteria:**

- [x] `ReconciliationService.detectDrift(vendorId)` — checksum comparison
- [x] `ReconciliationService.binarySearchSync(vendorId, rangeStart, rangeEnd)` — recursive narrowing
- [x] `ReconciliationService.resolveConflict(vendorId, items[])` — ERP-wins upsert
- [x] Agent calls via `AgentCommunicationService` (circuit breaker wrapped)
- [x] Results logged to `reconciliation_events`
- [x] `@Cron('0 * * * *')` for hourly detection
- [x] Manual trigger admin endpoint
- [x] Unit tests

---

### REQ-10: Scheduled Tasks & Cleanup

**Goal:** Scheduled background tasks via `@nestjs/schedule`.

**Status:** IMPLEMENTED

| Task                   | Schedule                | Service Method                            |
| ---------------------- | ----------------------- | ----------------------------------------- |
| Drift detection        | `0 * * * *` (hourly)    | `ReconciliationService.detectDrift()`     |
| Agent health check     | Every 5 min             | `AgentRegistryService.checkHealth()`      |
| DLQ alert check        | Every 15 min            | `DeadLetterQueueService.alertIfNeeded()`  |
| Expired jobs cleanup   | `0 2 * * *` (daily 2AM) | `SyncCleanupService.cleanupExpiredJobs()` |
| Reconciliation archive | `0 3 * * 0` (Sun 3AM)   | `SyncCleanupService.archiveEvents()`      |
| Resolved DLQ cleanup   | `0 4 * * 6` (Sat 4AM)   | `SyncCleanupService.cleanupDLQ()`         |

**Acceptance Criteria:**

- [x] `SyncSchedulerService` with `@Cron` and `@Interval` decorators
- [x] `SyncCleanupService` for data lifecycle management
- [x] `AlertService` for Slack/log notifications
- [x] All 6 cron tasks implemented
- [x] Alert types: `agent_offline`, `dlq_entries_found`, `circuit_breaker_open`, `reconciliation_drift`
- [x] Unit tests with mocked timers

---

### REQ-11: Monitoring & Metrics

**Goal:** Health and metrics endpoints for sync operations.

**Status:** IMPLEMENTED

**Health endpoint enhancement (`GET /health`):**

```json
{
  "status": "ok",
  "info": {
    "database": { "status": "up" },
    "redis": { "status": "up" },
    "bullmq": {
      "status": "up",
      "queues": { "order-sync": 0, "reconciliation": 0 }
    },
    "agents": { "status": "up", "online": 2, "total": 3 },
    "memory_heap": { "status": "up" },
    "disk": { "status": "up" }
  }
}
```

**Metrics endpoints:**

| Method | Path                                          | Auth   | Response                                                        |
| ------ | --------------------------------------------- | ------ | --------------------------------------------------------------- |
| GET    | `/api/admin/metrics/:vendorId`                | ApiKey | total/pending/completed/failed/successRate/avgLatency/retryRate |
| GET    | `/api/admin/metrics/reconciliation/:vendorId` | ApiKey | eventCount/lastRun/driftFrequency                               |
| GET    | `/api/admin/sync-status/:jobId`               | ApiKey | Full job details                                                |

**Acceptance Criteria:**

- [x] Health controller with database, Redis, BullMQ, agent indicators
- [x] `SyncMetricsService` with PostgreSQL aggregation queries
- [x] Admin metrics endpoints with Swagger
- [x] Correlation ID middleware on `/api/sync/*` routes
- [x] Unit tests for metrics aggregation

---

## P1 Requirements (Should Have — Production Hardening)

### REQ-13: Security Hardening

**Goal:** Production-grade security posture.

**Status:** PARTIALLY IMPLEMENTED (helmet, CORS, throttler already exist)

**Requirements:**

1. **helmet** middleware in `main.ts` — ALREADY EXISTS
2. **CORS tightening** — ALREADY EXISTS (restricted to config origins)
3. **Rate limiting** — ALREADY EXISTS (ThrottlerModule configured)
4. **Swagger gating** — ALREADY EXISTS (SWAGGER_ENABLED env var)
5. **Request ID middleware** — ALREADY EXISTS (CorrelationIdMiddleware)
6. **Payload validation** — ALREADY EXISTS (ValidationPipe in main.ts)
7. **Constant-time comparison** for API key validation — IMPLEMENTED (ApiKeyGuard)

**Acceptance Criteria:**

- [x] helmet enabled in main.ts
- [x] CORS restricted to known origins
- [x] ThrottlerModule with per-route overrides
- [x] Swagger disabled by default in production
- [x] Request ID on all requests
- [x] Timing-safe API key comparison
- [x] ValidationPipe registered in ONE place only

---

### REQ-14: Performance Optimization

**Goal:** Ensure the sync pipeline handles production load without degradation.

**Requirements:**

1. **Database connection pooling** — configurable via `DB_POOL_SIZE`
2. **Batch processing limits** — 500 incremental / 5000 batch, chunked by 50
3. **Graceful shutdown** — `app.enableShutdownHooks()` already in main.ts
4. **Response pagination** — all list endpoints accept `?page=1&limit=50`
5. **Database indexes** — every FK, every status column, composite indexes
6. **Efficient upserts** — Drizzle `onConflictDoUpdate` for batch operations

**Acceptance Criteria:**

- [x] Configurable DB pool size via `DB_POOL_SIZE`
- [x] Batch size limits enforced on ingest endpoints
- [x] `app.enableShutdownHooks()` in main.ts
- [x] Pagination on all list endpoints
- [x] Proper indexes on all new tables

---

### REQ-15: Admin Dashboard API

**Goal:** Complete admin API for managing sync operations.

**Status:** IMPLEMENTED

**Endpoints (all protected by ApiKeyGuard):**

| Method | Path                                          | Purpose                           |
| ------ | --------------------------------------------- | --------------------------------- |
| GET    | `/api/admin/agents`                           | List all agents with health       |
| GET    | `/api/admin/agents/:vendorId`                 | Agent details                     |
| PUT    | `/api/admin/agents/:vendorId`                 | Update agent URL/config           |
| DELETE | `/api/admin/agents/:vendorId`                 | Deregister agent                  |
| GET    | `/api/admin/sync-jobs`                        | List recent sync jobs (paginated) |
| GET    | `/api/admin/sync-jobs/:id`                    | Job details                       |
| GET    | `/api/admin/dlq`                              | List unresolved DLQ entries       |
| GET    | `/api/admin/dlq/:id`                          | DLQ entry details                 |
| POST   | `/api/admin/dlq/:id/retry`                    | Retry DLQ entry                   |
| POST   | `/api/admin/dlq/:id/resolve`                  | Resolve DLQ entry                 |
| POST   | `/api/admin/reconciliation/trigger`           | Manual reconciliation             |
| GET    | `/api/admin/reconciliation/events`            | Reconciliation event log          |
| POST   | `/api/admin/circuit-breaker/reset`            | Reset circuit breaker             |
| GET    | `/api/admin/circuit-breaker/status`           | All breaker states                |
| GET    | `/api/admin/metrics/:vendorId`                | Sync metrics                      |
| GET    | `/api/admin/metrics/reconciliation/:vendorId` | Reconciliation metrics            |
| GET    | `/api/admin/mappings`                         | List ERP mappings                 |
| POST   | `/api/admin/mappings`                         | Create mapping                    |
| PUT    | `/api/admin/mappings/:id`                     | Update mapping                    |
| DELETE | `/api/admin/mappings/:id`                     | Delete mapping                    |
| POST   | `/api/admin/mappings/seed`                    | Bulk seed mappings                |

---

### REQ-16: Comprehensive Tests

**Goal:** Full sync flow coverage.

**Status:** PARTIALLY IMPLEMENTED — unit tests exist, integration/E2E tests pending (Task 22)

**Unit tests implemented:**

- [x] Agent registry service
- [x] ERP mapping service
- [x] Circuit breaker service
- [x] Agent communication service
- [x] Sync ingest service
- [x] Sync job service
- [x] Order sync processor
- [x] DLQ service
- [x] Reconciliation service
- [x] Scheduler service
- [x] Metrics service
- [x] Alert service
- [x] Agent callback controller
- [x] Health indicators

**Test scenarios still needed (Task 22 — integration/E2E):**

1. Agent registers → sends items → items upserted in DB
2. Content-hash dedup: same data sent twice → second request returns all skipped
3. Stale data rejection: old timestamp → rejected
4. Unmapped ERP code → item fails, others succeed
5. Order created → BullMQ job → mock agent callback → order updated
6. Agent down → circuit breaker opens → DLQ entry created
7. DLQ retry → new BullMQ job → succeeds
8. Reconciliation detects drift → binary search → conflict resolved
9. Health endpoint shows all subsystems
10. Rate limiting kicks in after threshold

---

### REQ-17: DevOps & CI/CD

**Goal:** Production deployment pipeline.

**Status:** LARGELY IMPLEMENTED (Tasks 18-21 done, Task 22 E2E tests pending)

**Requirements:**

1. Docker image tagged with Git SHA
2. GitHub Actions CI/CD: lint → test → build → Docker → deploy
3. Blue-green deployment script
4. Rollback via tagged Docker images
5. Secrets management (no secrets in repo)
6. `.env.example` with all variables documented

---

## Security Requirements (Cross-Cutting)

### Authentication Matrix

| Flow           | Method                                          | Guard            | Validation                                   |
| -------------- | ----------------------------------------------- | ---------------- | -------------------------------------------- |
| Agent → NestJS | Bearer token in `Authorization` header          | `AgentAuthGuard` | bcrypt compare against stored hash           |
| Admin → NestJS | `X-API-Key` header                              | `ApiKeyGuard`    | Timing-safe compare against `API_SECRET` env |
| NestJS → Agent | Bearer token in outbound `Authorization` header | N/A              | Token from config                            |

### Environment Variables

```env
# Redis (REQUIRED)
REDIS_URL=redis://localhost:6379

# Authentication (REQUIRED)
AGENT_SECRET=your-agent-auth-secret          # Shared secret for agent registration
API_SECRET=your-admin-api-key-minimum-32-chars

# Alerts (OPTIONAL)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...

# Performance (OPTIONAL)
DB_POOL_SIZE=20
BULLMQ_CONCURRENCY=5

# Feature Flags (OPTIONAL)
SWAGGER_ENABLED=true
```

### Data Retention Policy

| Data                           | Retention  | Cleanup               |
| ------------------------------ | ---------- | --------------------- |
| sync_jobs (completed)          | 24 hours   | Daily 2AM cron        |
| sync_jobs (failed/pending)     | 7 days     | Daily 2AM cron        |
| dead_letter_queue (resolved)   | 30 days    | Weekly Sat 4AM cron   |
| dead_letter_queue (unresolved) | Indefinite | Manual resolution     |
| reconciliation_events          | 30 days    | Weekly Sun 3AM cron   |
| agent_registry                 | Permanent  | Manual deregistration |
| erp_code_mappings              | Permanent  | Manual deletion       |

---

## Success Metrics

| Metric                      | Target                        | Measurement          |
| --------------------------- | ----------------------------- | -------------------- |
| ERP→DB sync latency         | < 200ms                       | Pino request logging |
| Order→ERP hops              | ≤ 2                           | Trace correlation    |
| Deployments                 | 1                             | Infra count          |
| Databases                   | 1 + Redis                     | Infra count          |
| Health check subsystems     | 7 (PG, Redis, BullMQ, agents) | `/health` response   |
| Build passes                | 100%                          | CI pipeline          |
| Test coverage (sync module) | ≥ 70%                         | Jest coverage        |

---

## Blocking Issues & Gap Resolution

> **Reference:** See `GAP_ANALYSIS.md` and `IMPLEMENTATION_PLAN.md` for detailed analysis.

### Critical Gaps (Must resolve before production)

| Gap | Issue                            | Resolution                                                                                               | Task                           |
| --- | -------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------ |
| 1   | No `orders`/`order_items` tables | Create schemas with full ERP fields                                                                      | 2.1                            |
| 2   | No business entity repositories  | Create 5 repos (items, warehouses, stock, orders, order_items)                                           | 2.5                            |
| 3   | Missing fields in `items` schema | Add `erpId`, `priceExclVat`, `priceInclVat`, `vatAmount`, `manageStock`, `allowNegativeStock`, `barcode` | 2.2                            |
| 4   | No `OrdersModule`                | Create module with service, controller, DTOs, event emission                                             | 2.6                            |
| 5   | Task 11 false positive           | Mark BLOCKED until deps met                                                                              | Done in IMPLEMENTATION_PLAN.md |

### P1 Gaps (Should resolve before production)

| Gap | Issue                         | Resolution                                                          | Task |
| --- | ----------------------------- | ------------------------------------------------------------------- | ---- |
| 6   | Missing warehouse fields      | Add `isDefault`, `isMain`, `type`                                   | 2.3  |
| 7   | Missing stock fields          | Add `orderedQuantity`, `pump`, `stockValue`, `minStock`, `maxStock` | 2.4  |
| 8   | SyncIngestService raw Drizzle | Refactor to use repositories                                        | 2.7  |
| 9   | No E2E tests                  | Create integration tests                                            | 22   |

### Post-MVP (Deferred)

- Frontend customer management
- Oxatis e-commerce integration
- Web publishing flags
- GPS coordinates for warehouses
- Physical dimensions for items
- Advanced stock management features
