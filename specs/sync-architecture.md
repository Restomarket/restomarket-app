# Sync Architecture — Feature Specification

> **Version:** 2.0  
> **Last Updated:** 2026-02-12  
> **Status:** APPROVED

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

| Component         | Purpose                                                     | Status            |
| ----------------- | ----------------------------------------------------------- | ----------------- |
| PostgreSQL 16     | Primary data store                                          | Already running   |
| Redis 7+          | BullMQ backing, circuit breaker state, rate limiter backing | **NEW**           |
| BullMQ            | Job queues with retry, backoff, DLQ, concurrency            | **NEW**           |
| opossum           | Circuit breaker (in-process, per-vendor)                    | **NEW**           |
| @nestjs/schedule  | Cron and interval decorators                                | **NEW**           |
| @nestjs/throttler | Request rate limiting                                       | **NEW**           |
| helmet            | HTTP security headers                                       | **NEW**           |
| @nestjs/terminus  | Health checks (PG, Redis, BullMQ, agents)                   | **NEW** (install) |

### Module Dependency Graph

```
AppModule
├── ConfigModule (global)
├── LoggerModule (global, nestjs-pino)
├── EventEmitterModule (global)
├── ThrottlerModule (global)          ← NEW
├── ScheduleModule                    ← NEW
├── BullModule.forRoot()              ← NEW
├── DatabaseModule
│   ├── Existing schemas + 5 new schemas
│   └── Existing repos + 5 new repos
├── SyncModule (src/modules/sync/)     ← NEW
│   ├── AgentRegistryController
│   ├── AgentIngestController
│   ├── AgentCallbackController
│   ├── ErpMappingController
│   ├── SyncAdminController
│   ├── AgentRegistryService
│   ├── SyncIngestService
│   ├── SyncJobService
│   ├── AgentCommunicationService
│   ├── ErpMappingService
│   ├── CircuitBreakerService
│   ├── ReconciliationService
│   ├── DeadLetterQueueService
│   ├── SyncMetricsService
│   ├── SyncCleanupService
│   ├── AlertService
│   ├── SyncSchedulerService
│   ├── OrderSyncProcessor (BullMQ)
│   ├── AgentAuthGuard
│   └── ApiKeyGuard
├── OrdersModule (uses SyncJobService)
├── ItemsModule (unchanged)
├── StockModule (unchanged)
├── WarehousesModule (unchanged)
├── PaymentModule (unchanged)
└── HealthModule (enhanced: Redis, BullMQ, agent indicators)
```

---

## P0 Requirements (Must Have — Blocks Production)

### REQ-1: Sync Module Foundation

**Goal:** Create the `src/sync/` NestJS module for ERP synchronization.

**Requirements:**

- SyncModule registers all sync controllers, services, processors, schedulers
- BullMQ queues registered: `order-sync`, `reconciliation`, `image-sync`
- Redis connection via `REDIS_URL` env var with connection error handling
- All services injectable via NestJS DI container

**Acceptance Criteria:**

- [ ] `SyncModule` registered in `AppModule`
- [ ] BullMQ connected to Redis on startup (verified via health check)
- [ ] `ScheduleModule.forRoot()` registered
- [ ] `ThrottlerModule.forRoot()` registered with default 60 req/min
- [ ] `REDIS_URL`, `AGENT_SECRET`, `API_SECRET` added to config schema (Zod)
- [ ] All sync services resolvable via DI (build passes)

---

### REQ-2: Database Schema — 5 Sync Tables

**Goal:** PostgreSQL tables for sync coordination state.

**New tables (Drizzle ORM):**

| Table                   | Key Design                                                              |
| ----------------------- | ----------------------------------------------------------------------- |
| `sync_jobs`             | UUID PK, FK→orders, JSONB payload, status enum, retry tracking, 24h TTL |
| `agent_registry`        | UUID PK, unique vendor_id, agent_url, bcrypt auth_token_hash, heartbeat |
| `erp_code_mappings`     | Composite unique (vendor_id, mapping_type, erp_code), is_active flag    |
| `dead_letter_queue`     | FK→sync_jobs, JSONB payload, resolved/unresolved tracking               |
| `reconciliation_events` | JSONB summary, event_type enum, duration_ms                             |

**NOTE:** `items`, `stock`, `warehouses` tables do NOT exist yet. They must be created as part of the sync implementation (or as a prerequisite Task 2 sub-task). These tables need `content_hash` and `last_synced_at` columns for deduplication.

**Acceptance Criteria:**

- [ ] 5 Drizzle schema files in `packages/shared/src/database/schema/`
- [ ] All exported from `packages/shared/src/database/schema/index.ts`
- [ ] Relations in `packages/shared/src/database/schema/sync-relations.ts`
- [ ] 5 base repository classes in `packages/shared/` extending `BaseRepository`
- [ ] 5 NestJS adapter repositories in `apps/api/src/database/adapters/`
- [ ] New schemas added to explicit schema object in `apps/api/src/database/database.module.ts`
- [ ] Migration generated via `pnpm db:generate`
- [ ] Migration applied via `pnpm db:migrate`
- [ ] All columns use snake_case, all PKs are UUID

---

### REQ-3: Agent Registry

**Goal:** Full agent lifecycle with heartbeat health monitoring.

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

- [ ] `AgentRegistryService` with register/heartbeat/deregister/getAgent/getAllAgents/checkHealth
- [ ] `AgentRegistryController` with all 5 endpoints + Swagger decorators
- [ ] `AgentRegistryRepository` with Drizzle typed queries
- [ ] `AgentAuthGuard` validates Bearer token via bcrypt compare
- [ ] Heartbeat staleness detection: degraded >60s, offline >300s
- [ ] Unit tests for service logic (register, heartbeat, status transitions)

---

### REQ-4: ERP Code Mapping

**Goal:** Translate ERP codes to RestoMarket codes with in-memory cache.

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

**Endpoints:**

| Method | Path                       | Auth   | Purpose                                    |
| ------ | -------------------------- | ------ | ------------------------------------------ |
| GET    | `/api/admin/mappings`      | ApiKey | List mappings (filtered by vendorId, type) |
| POST   | `/api/admin/mappings`      | ApiKey | Create single mapping                      |
| PUT    | `/api/admin/mappings/:id`  | ApiKey | Update mapping                             |
| DELETE | `/api/admin/mappings/:id`  | ApiKey | Soft-delete (set is_active=false)          |
| POST   | `/api/admin/mappings/seed` | ApiKey | Bulk seed mappings                         |

**Acceptance Criteria:**

- [ ] `ErpMappingService.resolve(vendorId, type, erpCode)` returns `MappingResult | null`
- [ ] In-memory cache with 5min TTL
- [ ] Cache invalidation on write
- [ ] CRUD admin endpoints with Swagger
- [ ] Seed endpoint for bulk import
- [ ] Unit tests: cache hit, cache miss, cache expiry, not-found

---

### REQ-5: Sync Ingest — ERP→DB Direct Pipeline (THE CORE WIN)

**Goal:** Agents POST data directly to NestJS → validate → deduplicate → map → upsert to PostgreSQL.

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

- [ ] `AgentIngestController` with 6 endpoints (3 incremental + 3 batch)
- [ ] `SyncIngestService` with validate→deduplicate→map→upsert pipeline
- [ ] Content-hash dedup uses existing `content_hash` columns on entity tables
- [ ] Stale-data rejection by timestamp comparison
- [ ] Mapping resolution integrated for items (unit + vat required)
- [ ] Batch upsert via Drizzle `onConflictDoUpdate`
- [ ] DTOs with class-validator for all payloads
- [ ] Response: `{ processed, skipped, failed, results[] }`
- [ ] Payload size guard: 500/5000 item limits enforced
- [ ] Rate limit: 30 req/min per agent for incremental, 5 req/min for batch
- [ ] Unit tests per sync type
- [ ] Integration test: POST items → verify in items table

---

### REQ-6: Sync Job Service + BullMQ Order Processor (DB→ERP)

**Goal:** Orders flow through BullMQ for reliable delivery to ERP agents.

**Order sync lifecycle:**

```
OrderCreated event
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
          → OrdersRepository.updateErpReference(orderId, erpReference)  ← DIRECT DB, no webhook
      → status === 'failed':
          → SyncJobService.markFailed(jobId, error)
```

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

- [ ] `SyncJobService` creates sync_jobs row + BullMQ job
- [ ] `OrderSyncProcessor` (`@Processor('order-sync')`) calls agent via circuit breaker
- [ ] `AgentCallbackController` at `POST /api/agents/callback`
- [ ] Callback updates `sync_jobs` + `orders` directly
- [ ] `AgentCommunicationService` wraps HTTP via circuit breaker
- [ ] BullMQ exponential backoff: 5 attempts starting at 1min
- [ ] `@OnQueueFailed` moves exhausted jobs to dead_letter_queue
- [ ] `OrderErpSyncListener` uses `SyncJobService`
- [ ] Unit tests for job lifecycle

---

### REQ-7: Circuit Breaker

**Goal:** Per-vendor, per-API-type circuit breaker protection via `opossum`.

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

- [ ] `CircuitBreakerService.getBreaker(vendorId, apiType)` returns/creates breaker
- [ ] `CircuitBreakerService.reset(vendorId, apiType)` forces closed
- [ ] `CircuitBreakerService.getStatus()` returns all breaker states
- [ ] State transition events logged
- [ ] Unit tests for open/close/halfOpen transitions

---

### REQ-8: Dead Letter Queue

**Goal:** Persistent store for permanently failed jobs.

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

- [ ] `DeadLetterQueueService` with add/list/get/retry/resolve/cleanup
- [ ] Retry re-creates BullMQ job with original payload
- [ ] Admin endpoints with pagination and Swagger
- [ ] Audit log on retry and resolve actions
- [ ] Unit tests

---

### REQ-9: Reconciliation Engine

**Goal:** Detect and resolve drift between ERP and PostgreSQL.

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

**Admin endpoint:** `POST /api/admin/reconciliation/trigger` — manual drift detection

**Acceptance Criteria:**

- [ ] `ReconciliationService.detectDrift(vendorId)` — checksum comparison
- [ ] `ReconciliationService.binarySearchSync(vendorId, rangeStart, rangeEnd)` — recursive narrowing
- [ ] `ReconciliationService.resolveConflict(vendorId, items[])` — ERP-wins upsert
- [ ] Agent calls via `AgentCommunicationService` (circuit breaker wrapped)
- [ ] Results logged to `reconciliation_events`
- [ ] `@Cron('0 * * * *')` for hourly detection
- [ ] Manual trigger admin endpoint
- [ ] Unit tests for all reconciliation paths

---

### REQ-10: Scheduled Tasks & Cleanup

**Goal:** Scheduled background tasks via `@nestjs/schedule`.

| Task                   | Schedule                | Service Method                            |
| ---------------------- | ----------------------- | ----------------------------------------- |
| Drift detection        | `0 * * * *` (hourly)    | `ReconciliationService.detectDrift()`     |
| Agent health check     | Every 5 min             | `AgentRegistryService.checkHealth()`      |
| DLQ alert check        | Every 15 min            | `DeadLetterQueueService.alertIfNeeded()`  |
| Expired jobs cleanup   | `0 2 * * *` (daily 2AM) | `SyncCleanupService.cleanupExpiredJobs()` |
| Reconciliation archive | `0 3 * * 0` (Sun 3AM)   | `SyncCleanupService.archiveEvents()`      |
| Resolved DLQ cleanup   | `0 4 * * 6` (Sat 4AM)   | `SyncCleanupService.cleanupDLQ()`         |

**Alert service:** Sends to Slack webhook (if `SLACK_WEBHOOK_URL` configured). Always logs.

**Acceptance Criteria:**

- [ ] `SyncSchedulerService` with `@Cron` and `@Interval` decorators
- [ ] `SyncCleanupService` for data lifecycle management
- [ ] `AlertService` for Slack/log notifications
- [ ] All 6 cron tasks implemented
- [ ] Alert types: `agent_offline`, `dlq_entries_found`, `circuit_breaker_open`, `reconciliation_drift`
- [ ] Unit tests with mocked timers

---

### REQ-11: Monitoring & Metrics

**Goal:** Health and metrics endpoints for sync operations.

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

**Correlation IDs:**

- Every sync operation gets a UUID correlation ID
- Passed in HTTP header `X-Correlation-ID` through agent communication
- Logged in all related log entries

**Acceptance Criteria:**

- [ ] Health controller with database, Redis, BullMQ, agent indicators
- [ ] `SyncMetricsService` with PostgreSQL aggregation queries
- [ ] Admin metrics endpoints with Swagger
- [ ] Correlation ID middleware on `/api/sync/*` routes
- [ ] Unit tests for metrics aggregation

---

## P1 Requirements (Should Have — Production Hardening)

### REQ-13: Security Hardening

**Goal:** Production-grade security posture.

**Requirements:**

1. **helmet** middleware in `main.ts`:

   ```typescript
   app.use(
     helmet({
       contentSecurityPolicy: { directives: { defaultSrc: ["'self'"] } },
       crossOriginEmbedderPolicy: true,
     }),
   );
   ```

2. **CORS tightening:**

   ```typescript
   app.enableCors({
     origin: [configService.get('FRONTEND_URL'), configService.get('BASE_URL')],
     methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
     allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Correlation-ID'],
     credentials: true,
     maxAge: 86400,
   });
   ```

3. **Rate limiting:**
   - Global: 120 req/min per IP
   - Agent sync endpoints: 60 req/min per agent
   - Batch sync endpoints: 10 req/min per agent
   - Admin endpoints: 30 req/min per API key
   - Agent registration: 10 req/min per IP

4. **Swagger gating:**

   ```typescript
   if (configService.get('SWAGGER_ENABLED') === 'true') {
     SwaggerModule.setup('api', app, document);
   }
   ```

5. **Request ID middleware:** Generate UUID `X-Request-ID` header on every request, include in logs

6. **Payload validation:**
   - `ValidationPipe` with `whitelist: true, forbidNonWhitelisted: true, transform: true`
   - Remove duplicate registration (currently in both `main.ts` AND `AppModule`)

7. **Constant-time comparison** for API key validation (prevent timing attacks):
   ```typescript
   import { timingSafeEqual } from 'crypto';
   ```

**Acceptance Criteria:**

- [ ] helmet enabled in main.ts
- [ ] CORS restricted to known origins
- [ ] ThrottlerModule with per-route overrides
- [ ] Swagger disabled by default in production
- [ ] Request ID on all requests
- [ ] Timing-safe API key comparison
- [ ] ValidationPipe registered in ONE place only

---

### REQ-14: Performance Optimization

**Goal:** Ensure the sync pipeline handles production load without degradation.

**Requirements:**

1. **Database connection pooling:**

   ```typescript
   // postgres.js driver config
   {
     max: parseInt(process.env.DB_POOL_SIZE || '20');
   }
   ```

2. **Batch processing limits:**
   - Incremental ingest: max 500 items per request
   - Batch ingest: max 5,000 items, processed in chunks of 50
   - BullMQ concurrency: 5 for order-sync, 2 for reconciliation

3. **Graceful shutdown:**

   ```typescript
   app.enableShutdownHooks();
   // In SyncModule: @OnApplicationShutdown to drain BullMQ queues
   ```

4. **Response pagination:**
   - All list endpoints accept `?page=1&limit=50`
   - Max limit: 100
   - Response includes `{ data, meta: { page, limit, total, totalPages } }`

5. **Database indexes:** Every FK, every status column, composite indexes for common filter patterns

6. **Efficient upserts:**
   - Use Drizzle `onConflictDoUpdate` for batch operations
   - Single SQL statement per batch (not N individual inserts)

**Acceptance Criteria:**

- [ ] Configurable DB pool size via `DB_POOL_SIZE`
- [ ] Batch size limits enforced on ingest endpoints
- [ ] `app.enableShutdownHooks()` in main.ts
- [ ] Pagination on all list endpoints
- [ ] Proper indexes on all new tables

---

### REQ-15: Admin Dashboard API

**Goal:** Complete admin API for managing sync operations.

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

**Test scenarios:**

1. Agent registers → sends items → items upserted in DB
2. Agent sends stock → stock upserted in DB
3. Agent sends warehouses → warehouses upserted in DB
4. Content-hash dedup: same data sent twice → second request returns all skipped
5. Stale data rejection: old timestamp → rejected
6. Unmapped ERP code → item fails, others succeed
7. Order created → BullMQ job → mock agent callback → order updated
8. Agent down → circuit breaker opens → DLQ entry created
9. DLQ retry → new BullMQ job → succeeds
10. Reconciliation detects drift → binary search → conflict resolved
11. Health endpoint shows all subsystems
12. Rate limiting kicks in after threshold

---

### REQ-17: DevOps & CI/CD

**Goal:** Production deployment pipeline.

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
