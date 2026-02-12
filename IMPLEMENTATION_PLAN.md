# Implementation Plan — ERP Sync Architecture

> **Spec:** `specs/sync-architecture.md`  
> **Last Updated:** 2026-02-12  
> **Total Tasks:** 23 across 8 phases + 1 validation gate

---

## Task Ordering Rationale

```
Phase 1: Foundation       ─── Infrastructure, deps, config, Redis, Docker
Phase 2: Database         ─── Schemas, repositories (everything else depends on tables)
Phase 3: Module Scaffold  ─── SyncModule skeleton, guards (everything else depends on DI)
Phase 4: Core Services    ─── Agent registry, mappings, circuit breaker (ingest depends on these)
Phase 5: Direct Ingest    ─── Direct ingest pipeline (Agent → NestJS → PG in one hop)
Phase 6: Outbound Sync    ─── BullMQ order→ERP processor, DLQ
Phase 7: Background       ─── Reconciliation, scheduler, cleanup, metrics
Phase 8: Hardening        ─── Security, performance, CI/CD, deployment
```

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
Create 5 new Drizzle schema files, update exports and relations, generate migration.

**Implementation Details:**

Schema files to create (in `packages/shared/src/database/schema/`):

1. **`packages/shared/src/database/schema/sync-jobs.schema.ts`**
   - `id`: UUID PK
   - `postgresOrderId`: UUID FK→orders, nullable
   - `vendorId`: varchar(100), NOT NULL
   - `operation`: varchar(50), NOT NULL (e.g. 'create_order', 'reserve_stock')
   - `status`: varchar(20), NOT NULL, default 'pending' — values: pending, processing, completed, failed, cancelled
   - `payload`: jsonb, NOT NULL
   - `retryCount`: integer, default 0
   - `maxRetries`: integer, default 5
   - `nextRetryAt`: timestamp(tz), nullable
   - `errorMessage`: text, nullable
   - `errorStack`: text, nullable
   - `erpReference`: varchar(100), nullable
   - `createdAt`, `startedAt`, `completedAt`, `expiresAt`: timestamp(tz)
   - Indexes: vendor_status, status, next_retry, expires

2. **`packages/shared/src/database/schema/agent-registry.schema.ts`**
   - `id`: UUID PK
   - `vendorId`: varchar(100), UNIQUE NOT NULL
   - `agentUrl`: varchar(500), NOT NULL
   - `erpType`: varchar(20), NOT NULL — 'ebp', 'sage', 'odoo', 'custom'
   - `status`: varchar(20), NOT NULL, default 'offline' — 'online', 'offline', 'degraded'
   - `lastHeartbeat`: timestamp(tz), nullable
   - `version`: varchar(50), nullable
   - `authTokenHash`: varchar(256), NOT NULL
   - `createdAt`, `updatedAt`: timestamp(tz)
   - Indexes: status, heartbeat

3. **`packages/shared/src/database/schema/erp-code-mappings.schema.ts`**
   - `id`: UUID PK
   - `vendorId`: varchar(100), NOT NULL
   - `mappingType`: varchar(20), NOT NULL — 'unit', 'vat', 'family', 'subfamily'
   - `erpCode`: varchar(100), NOT NULL
   - `restoCode`: varchar(100), NOT NULL
   - `restoLabel`: varchar(255), NOT NULL
   - `isActive`: boolean, default true
   - `createdAt`, `updatedAt`: timestamp(tz)
   - Unique constraint: (vendor_id, mapping_type, erp_code)
   - Indexes: vendor_type

4. **`packages/shared/src/database/schema/dead-letter-queue.schema.ts`**
   - `id`: UUID PK
   - `originalJobId`: UUID FK→sync_jobs, nullable
   - `vendorId`: varchar(100), NOT NULL
   - `operation`: varchar(50), NOT NULL
   - `payload`: jsonb, NOT NULL
   - `failureReason`: text, NOT NULL
   - `failureStack`: text, nullable
   - `attemptCount`: integer, default 0
   - `lastAttemptAt`: timestamp(tz)
   - `resolved`: boolean, default false
   - `resolvedAt`: timestamp(tz), nullable
   - `resolvedBy`: varchar(100), nullable
   - `createdAt`: timestamp(tz)
   - Indexes: vendor, resolved, created

5. **`packages/shared/src/database/schema/reconciliation-events.schema.ts`**
   - `id`: UUID PK
   - `vendorId`: varchar(100), NOT NULL
   - `eventType`: varchar(30), NOT NULL — 'incremental_sync', 'full_checksum', 'drift_detected', 'drift_resolved'
   - `summary`: jsonb, NOT NULL
   - `details`: text, nullable
   - `timestamp`: timestamp(tz), NOT NULL, default NOW()
   - `durationMs`: integer, default 0
   - Indexes: vendor_timestamp, event_type

**Also modify:**

- `packages/shared/src/database/schema/index.ts` — export all new schemas
- Create `packages/shared/src/database/schema/sync-relations.ts` — add relations (syncJobs→orders, deadLetterQueue→syncJobs)
- `apps/api/src/database/database.module.ts` — add new schema tables to the explicit `schema` object (NO `import *`)

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

## Phase 2: Repositories (Task 3)

### Task 3: Create Sync Repositories

- **Priority:** P0
- **Risk:** low
- **Status:** passing
- **Depends on:** Task 2
- **Complexity:** 4
- **Spec reference:** REQ-2

**Description:**
Create 5 repository classes following the existing two-layer pattern:

1. Base repository in `packages/shared/` (framework-agnostic, extends `BaseRepository`)
2. NestJS adapter in `apps/api/src/database/adapters/` (wraps base with NestJS DI + PinoLogger)

See `packages/shared/src/database/repositories/user/user.repository.base.ts` and `apps/api/src/database/adapters/nestjs-user.repository.ts` for the exact pattern.

**Implementation Details:**

1. **`SyncJobsRepository`**: create, findById, findByOrderId, updateStatus, findPending, findExpired, countByStatus, getMetrics(vendorId), deleteExpired
2. **`AgentRegistryRepository`**: upsert, findByVendorId, findAll, findActive, updateHeartbeat, findStale(degradedThresholdMs, offlineThresholdMs), deleteByVendorId
3. **`ErpCodeMappingsRepository`**: findByVendorTypeCode, findByVendorAndType, upsert, bulkInsert, deactivate, findAll(paginated), countByVendor
4. **`DeadLetterQueueRepository`**: create, findById, findUnresolved(vendorId?, paginated), markResolved, deleteOldResolved(olderThanDays), countUnresolved
5. **`ReconciliationEventsRepository`**: create, findByVendor(paginated), findRecent(vendorId, limit), deleteOlderThan(days), getMetrics(vendorId)

**Files to create:**

Base repos in `packages/shared/`:

- `packages/shared/src/database/repositories/sync-jobs/sync-jobs.repository.base.ts`
- `packages/shared/src/database/repositories/agent-registry/agent-registry.repository.base.ts`
- `packages/shared/src/database/repositories/erp-code-mappings/erp-code-mappings.repository.base.ts`
- `packages/shared/src/database/repositories/dead-letter-queue/dead-letter-queue.repository.base.ts`
- `packages/shared/src/database/repositories/reconciliation-events/reconciliation-events.repository.base.ts`

NestJS adapters in `apps/api/`:

- `apps/api/src/database/adapters/nestjs-sync-jobs.repository.ts`
- `apps/api/src/database/adapters/nestjs-agent-registry.repository.ts`
- `apps/api/src/database/adapters/nestjs-erp-code-mappings.repository.ts`
- `apps/api/src/database/adapters/nestjs-dead-letter-queue.repository.ts`
- `apps/api/src/database/adapters/nestjs-reconciliation-events.repository.ts`

**Files to modify:**

- `packages/shared/src/database/repositories/index.ts` — export new repos
- `apps/api/src/database/adapters/index.ts` — export new adapters
- `apps/api/src/database/database.module.ts` — provide new adapter repositories

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
Create `src/modules/sync/` directory structure (matching existing `src/modules/health/`, `src/modules/users/` pattern), module definition, guards, and placeholder controllers. Wire into `AppModule`.

**Implementation Details:**

1. **`src/modules/sync/sync.module.ts`**:
   - `BullModule.registerQueue({ name: 'order-sync' }, { name: 'reconciliation' }, { name: 'image-sync' })`
   - Import `DatabaseModule`
   - Register all controllers, services (as they're created in later tasks)
   - Export key services for use by other modules

2. **Guards:**
   - `src/common/guards/agent-auth.guard.ts`:
     - `@Injectable() implements CanActivate`
     - Extracts `Authorization: Bearer <token>` header
     - Extracts `vendorId` from request body or params
     - Loads agent from `AgentRegistryRepository.findByVendorId()`
     - Compares token with `authTokenHash` via `bcrypt.compare()`
     - Rejects with 401 if invalid, 404 if agent not found
   - `src/common/guards/api-key.guard.ts`:
     - `@Injectable() implements CanActivate`
     - Extracts `X-API-Key` header
     - Constant-time compare with `API_SECRET` via `timingSafeEqual`
     - Rejects with 401 if invalid

3. **Placeholder controllers** (empty, populated in later tasks):
   - `src/modules/sync/controllers/agent-ingest.controller.ts`
   - `src/modules/sync/controllers/agent-registry.controller.ts`
   - `src/modules/sync/controllers/agent-callback.controller.ts`
   - `src/modules/sync/controllers/sync-admin.controller.ts`
   - `src/modules/sync/controllers/erp-mapping.controller.ts`

4. **Directory stubs:**
   - `src/modules/sync/services/`
   - `src/modules/sync/processors/`
   - `src/modules/sync/schedulers/`
   - `src/modules/sync/dto/`
   - `src/modules/sync/interfaces/`

5. Register `SyncModule` in `AppModule`

**Files to create:**

- `src/modules/sync/sync.module.ts`
- `src/modules/sync/controllers/` (5 files)
- `src/common/guards/agent-auth.guard.ts`
- `src/common/guards/api-key.guard.ts`

**Files to modify:**

- `src/app.module.ts` — add `SyncModule` to imports

**Validation Commands:**

```bash
pnpm turbo lint --filter=@apps/api --fix
pnpm turbo build --filter=@apps/api
pnpm turbo type-check
```

---

## Phase 4: Core Services (Tasks 5-8)

### Task 5: Agent Registry Service

- **Priority:** P0
- **Risk:** low
- **Status:** passing
- **Depends on:** Task 4
- **Complexity:** 5
- **Spec reference:** REQ-3

**Description:**  
Full agent lifecycle — registration, heartbeat, health monitoring, status transitions.

**Implementation Details:**

1. **`src/modules/sync/services/agent-registry.service.ts`:**
   - `register(dto: RegisterAgentDto)`:
     - Hash token with `bcrypt.hash(token, 10)`
     - Upsert to agent_registry (by vendorId)
     - Return agent info (without hash)
   - `heartbeat(vendorId: string)`:
     - Update `lastHeartbeat = NOW()`, `status = 'online'`
   - `deregister(vendorId: string)`:
     - Set `status = 'offline'`
   - `getAgent(vendorId: string)`:
     - Return from DB
   - `getAllAgents()`:
     - Return all with computed health status
   - `checkHealth()`:
     - Query all agents
     - If `lastHeartbeat` > 60s ago → mark `degraded`
     - If `lastHeartbeat` > 300s ago → mark `offline`
     - Return agents that changed status (for alerting)

2. **DTOs:**
   - `src/modules/sync/dto/agent-register.dto.ts`:
     ```typescript
     class RegisterAgentDto {
       @IsString() @IsNotEmpty() vendorId: string;
       @IsUrl() agentUrl: string;
       @IsIn(['ebp', 'sage', 'odoo', 'custom']) erpType: string;
       @IsString() @MinLength(16) authToken: string;
       @IsOptional() @IsString() version?: string;
     }
     ```
   - `src/modules/sync/dto/agent-heartbeat.dto.ts`:
     ```typescript
     class AgentHeartbeatDto {
       @IsString() @IsNotEmpty() vendorId: string;
       @IsOptional() @IsString() version?: string;
     }
     ```

3. **Populate `agent-registry.controller.ts`:**
   - `POST /api/agents/register` — `@UseGuards(ThrottlerGuard)` with `@Throttle({ default: { limit: 10, ttl: 60000 } })`
   - `POST /api/agents/heartbeat` — `@UseGuards(AgentAuthGuard)`
   - `DELETE /api/agents/:vendorId` — `@UseGuards(ApiKeyGuard)`
   - `GET /api/agents` — `@UseGuards(ApiKeyGuard)`
   - `GET /api/agents/:vendorId` — `@UseGuards(ApiKeyGuard)`
   - All with `@ApiTags('agents')`, `@ApiOperation`, `@ApiResponse`

4. **Wire `AgentAuthGuard`** to use `AgentRegistryRepository`

5. **Unit tests:** `src/modules/sync/services/__tests__/agent-registry.service.spec.ts`

**Files to create:**

- `src/modules/sync/services/agent-registry.service.ts`
- `src/modules/sync/dto/agent-register.dto.ts`
- `src/modules/sync/dto/agent-heartbeat.dto.ts`
- `src/modules/sync/services/__tests__/agent-registry.service.spec.ts`

**Files to modify:**

- `src/modules/sync/controllers/agent-registry.controller.ts`
- `src/common/guards/agent-auth.guard.ts` — wire repository
- `src/modules/sync/sync.module.ts`

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
ERP code mapping resolution with in-memory LRU cache. Required before item ingest works.

**Implementation Details:**

1. **`src/modules/sync/services/erp-mapping.service.ts`:**
   - Private `cache: Map<string, { result: MappingResult; expiresAt: number }>`
   - Private `MAX_CACHE_SIZE = 10_000`
   - `resolve(vendorId, type, erpCode)`:
     - Check cache → if hit and not expired → return
     - If cache miss or expired → query DB → cache result for 5min → return
     - If not found in DB → return `null`
     - LRU eviction when cache exceeds max size
   - `seed(vendorId, mappings[])` → bulk insert → invalidate cache
   - `clearCache()` → clear entire cache
   - `createMapping(dto)` → insert → invalidate cache for key
   - `updateMapping(id, dto)` → update → invalidate cache
   - `deleteMapping(id)` → set is_active=false → invalidate cache
   - `listMappings(vendorId?, type?, page, limit)` → paginated query

2. **DTOs:** `src/modules/sync/dto/erp-mapping.dto.ts`
   - `CreateErpMappingDto`, `UpdateErpMappingDto`, `SeedErpMappingsDto`

3. **Populate `erp-mapping.controller.ts`:**
   - All under `@ApiTags('mappings')`, `@UseGuards(ApiKeyGuard)`
   - `GET /api/admin/mappings` (paginated, filtered by vendorId, type)
   - `POST /api/admin/mappings`
   - `PUT /api/admin/mappings/:id`
   - `DELETE /api/admin/mappings/:id`
   - `POST /api/admin/mappings/seed`

4. **Seed script:** `src/database/seeds/erp-mappings.seed.ts`

5. **Unit tests:** cache hit, cache miss, cache expiry, LRU eviction, not-found

**Files to create:**

- `src/modules/sync/services/erp-mapping.service.ts`
- `src/modules/sync/dto/erp-mapping.dto.ts`
- `src/modules/sync/interfaces/erp-mapping.interface.ts`
- `src/database/seeds/erp-mappings.seed.ts`
- `src/modules/sync/services/__tests__/erp-mapping.service.spec.ts`

**Files to modify:**

- `src/modules/sync/controllers/erp-mapping.controller.ts`
- `src/modules/sync/sync.module.ts`

**Validation Commands:**

```bash
pnpm turbo lint --filter=@apps/api --fix
pnpm turbo build --filter=@apps/api
pnpm turbo test --filter=@apps/api -- --testPathPattern=erp-mapping
pnpm turbo type-check
```

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

**Implementation Details:**

1. **`src/modules/sync/services/circuit-breaker.service.ts`:**
   - Private `breakers: Map<string, CircuitBreaker>` keyed by `vendorId:apiType`
   - `getBreaker(vendorId, apiType)`:
     - If not exists → create with config:
       ```typescript
       { timeout: 30_000, errorThresholdPercentage: 50, resetTimeout: 60_000, volumeThreshold: 5 }
       ```
     - Attach event listeners: `open`, `halfOpen`, `close` → log via Logger
   - `execute<T>(vendorId, apiType, fn: () => Promise<T>)`:
     - Get breaker → `breaker.fire(fn)`
   - `reset(vendorId, apiType)`:
     - Force state to closed
   - `getStatus()`:
     - Return all breaker states as `{ key, state, stats }`

2. **Interface:** `src/modules/sync/interfaces/circuit-breaker.interface.ts`

3. **Unit tests:** create breaker, open on failures, half-open on timeout, close on success

**Files to create:**

- `src/modules/sync/services/circuit-breaker.service.ts`
- `src/modules/sync/interfaces/circuit-breaker.interface.ts`
- `src/modules/sync/services/__tests__/circuit-breaker.service.spec.ts`

**Files to modify:**

- `src/modules/sync/sync.module.ts`

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
HTTP client for calling vendor agents, wrapped in circuit breaker. Used by order sync processor AND reconciliation.

**Implementation Details:**

1. **`src/modules/sync/services/agent-communication.service.ts`:**
   - `callAgent<T>(vendorId, apiType, endpoint, payload)`:
     - Get agent from `AgentRegistryService.getAgent(vendorId)`
     - Validate agent is online or degraded (not offline)
     - Build URL: `${agent.agentUrl}${endpoint}`
     - Execute through `CircuitBreakerService.execute()`:
       ```typescript
       await this.circuitBreaker.execute(vendorId, apiType, async () => {
         const response = await axios.post(url, payload, {
           headers: {
             Authorization: `Bearer ${this.configService.get('AGENT_SECRET')}`,
             'X-Correlation-ID': correlationId,
           },
           timeout: 30_000,
         });
         return response.data;
       });
       ```
     - Log request/response at debug level
     - On failure: log at error level with context

2. **Unit tests:** mock axios, mock circuit breaker, verify headers, verify timeout, verify offline rejection

**Files to create:**

- `src/modules/sync/services/agent-communication.service.ts`
- `src/modules/sync/services/__tests__/agent-communication.service.spec.ts`

**Files to modify:**

- `src/modules/sync/sync.module.ts`

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

**Description:**  
**This is the most important task.** Agents POST directly to NestJS → validate → deduplicate → map → upsert to PostgreSQL. One hop, direct to database.

**Thinking:**  
This task represents the core architectural win of the sync system. The direct pipeline eliminates middleware layers and reduces latency from ERP to database. The complexity lies in handling deduplication (content_hash), staleness detection (timestamp comparison), and mapping resolution (ERP codes → Resto codes) all in a single transactional flow. Batch processing must be efficient to handle full catalog syncs without overwhelming the database.

**Planning:**

1. Start with the single-item ingest flow to establish the validation → deduplicate → map → upsert pattern
2. Add batch variants that chunk large payloads into manageable sizes
3. Implement comprehensive error handling that provides per-item status feedback
4. Test with realistic payloads to validate performance and error scenarios

**Implementation Details:**

1. **`src/modules/sync/services/sync-ingest.service.ts`:**
   - `handleItemChanges(vendorId: string, items: ItemSyncPayload[])`:

     ```typescript
     // 1. Enforce batch limit (max 500)
     // 2. For each item:
     //    a. Load existing by vendorId + sku → compare content_hash → skip if same
     //    b. Compare timestamp → reject if stale
     //    c. Resolve unit mapping (REQUIRED) → fail item if unmapped
     //    d. Resolve vat mapping (REQUIRED) → fail item if unmapped
     //    e. Resolve family/subfamily (OPTIONAL) → null if unmapped
     //    f. Add to validatedBatch
     // 3. Batch upsert validatedBatch (Drizzle onConflictDoUpdate)
     // 4. Return { processed, skipped, failed, results[] }
     ```

   - `handleStockChanges(vendorId: string, warehouseId: string, stockItems: StockSyncPayload[])`:

     ```typescript
     // 1. Enforce batch limit (max 500)
     // 2. For each stock row:
     //    a. Compare content_hash → skip if same
     //    b. Compare timestamp → reject if stale
     //    c. Add to validatedBatch
     // 3. Batch upsert via ON CONFLICT (vendor_id, warehouse_id, item_id) DO UPDATE
     // 4. Return results
     ```

   - `handleWarehouseChanges(vendorId: string, warehouses: WarehouseSyncPayload[])`:

     ```typescript
     // 1. Enforce batch limit
     // 2. Deduplicate, validate
     // 3. Batch upsert via ON CONFLICT (vendor_id, erp_warehouse_id) DO UPDATE
     // 4. Return results
     ```

   - Batch variants (`*BatchSync`) — process in chunks of 50, max 5000 total

2. **DTOs:**
   - `src/modules/sync/dto/item-sync-ingest.dto.ts` — validate item fields, content_hash, timestamp
   - `src/modules/sync/dto/stock-sync-ingest.dto.ts` — validate stock fields
   - `src/modules/sync/dto/warehouse-sync-ingest.dto.ts` — validate warehouse fields

3. **Populate `agent-ingest.controller.ts`:**
   - All under `@ApiTags('sync')`, `@UseGuards(AgentAuthGuard)`
   - Rate limits: `@Throttle({ default: { limit: 30, ttl: 60000 } })` incremental, `@Throttle({ default: { limit: 5, ttl: 60000 } })` batch
   - `POST /api/sync/items` + `POST /api/sync/items/batch`
   - `POST /api/sync/stock` + `POST /api/sync/stock/batch`
   - `POST /api/sync/warehouses` + `POST /api/sync/warehouses/batch`

4. **Upsert pattern (Drizzle):**

   ```typescript
   await this.db
     .insert(items)
     .values(batch)
     .onConflictDoUpdate({
       target: [items.vendorId, items.sku],
       set: {
         name: sql`excluded.name`,
         // ...all sync fields
         contentHash: sql`excluded.content_hash`,
         lastSyncedAt: sql`excluded.last_synced_at`,
         updatedAt: sql`NOW()`,
       },
     });
   ```

5. **Response format:**

   ```typescript
   {
     processed: 45,
     skipped: 3,      // content_hash match
     failed: 2,       // unmapped codes or validation errors
     results: [
       { sku: 'ABC001', status: 'processed' },
       { sku: 'ABC002', status: 'skipped', reason: 'no_changes' },
       { sku: 'ABC003', status: 'failed', reason: 'unmapped_unit: PIÈCE' },
     ]
   }
   ```

6. **Unit + integration tests**

**Files to create:**

- `src/modules/sync/services/sync-ingest.service.ts`
- `src/modules/sync/dto/item-sync-ingest.dto.ts`
- `src/modules/sync/dto/stock-sync-ingest.dto.ts`
- `src/modules/sync/dto/warehouse-sync-ingest.dto.ts`
- `src/modules/sync/services/__tests__/sync-ingest.service.spec.ts`

**Files to modify:**

- `src/modules/sync/controllers/agent-ingest.controller.ts`
- `src/modules/sync/sync.module.ts`

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
Manage sync job lifecycle in PostgreSQL + enqueue BullMQ jobs.

**Implementation Details:**

1. **`src/modules/sync/services/sync-job.service.ts`:**
   - `createOrderJob(vendorId, orderId, orderData)`:
     - Check for existing pending/processing job for same orderId (idempotency)
     - INSERT into sync_jobs (status=pending)
     - Add to BullMQ `order-sync` queue with job name `create-order`
     - Return jobId
   - `markProcessing(jobId)` — update status + startedAt
   - `markCompleted(jobId, erpReference, metadata?)` — update status + completedAt + erpReference
   - `markFailed(jobId, error)` — update status + errorMessage + errorStack
   - `getJob(jobId)` — full job details
   - `getPendingJobs(vendorId?)` — paginated pending jobs
   - `getRecentJobs(vendorId?, page, limit)` — paginated all jobs

2. **Unit tests**

**Files to create:**

- `src/modules/sync/services/sync-job.service.ts`
- `src/modules/sync/services/__tests__/sync-job.service.spec.ts`

**Files to modify:**

- `src/modules/sync/sync.module.ts`

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
- **Status:** passing
- **Depends on:** Task 8, Task 10
- **Complexity:** 7
- **Spec reference:** REQ-6

**Description:**  
BullMQ processor that sends orders to ERP agents, and controller that receives callbacks.

**Thinking:**  
This task closes the outbound sync loop (NestJS → Agent → ERP). The complexity is in coordinating three components: the BullMQ processor (async job execution), the agent communication layer (HTTP with circuit breaker), and the callback controller (status updates). The retry logic must be resilient but not infinite, with failed jobs moving to DLQ after exhaustion. The callback mechanism allows agents to process asynchronously and report back when complete.

**Planning:**

1. Implement the BullMQ processor first with retry configuration
2. Wire the agent communication service with circuit breaker protection
3. Create the callback controller to handle success/failure responses
4. Add the event listener to trigger sync jobs on order creation
5. Test the full flow: order created → job enqueued → agent called → callback received → order updated

**Implementation Details:**

1. **`src/modules/sync/processors/order-sync.processor.ts`:**

   ```typescript
   @Processor('order-sync')
   export class OrderSyncProcessor {
     @Process('create-order')
     async handleCreateOrder(job: Job<OrderSyncPayload>) {
       // 1. SyncJobService.markProcessing(job.data.syncJobId)
       // 2. AgentCommunicationService.callAgent(vendorId, 'orders', '/sync/create-order', payload)
       // 3. Agent processes async → calls back POST /api/agents/callback
       // Note: BullMQ handles retry automatically on exception
     }
   }
   ```

   - BullMQ config: `attempts: 5, backoff: { type: 'exponential', delay: 60_000 }`
   - `@OnQueueFailed`: if `job.attemptsMade >= job.opts.attempts` → DeadLetterQueueService.add()

2. **`src/modules/sync/dto/agent-callback.dto.ts`:**

   ```typescript
   class AgentCallbackDto {
     @IsUUID() jobId: string;
     @IsIn(['completed', 'failed']) status: string;
     @IsOptional() @IsString() erpReference?: string;
     @IsOptional() @IsString() error?: string;
     @IsOptional() metadata?: Record<string, any>;
   }
   ```

3. **Populate `agent-callback.controller.ts`:**
   - `POST /api/agents/callback` — `@UseGuards(AgentAuthGuard)`
   - On `completed`: `SyncJobService.markCompleted()` + update order erpReference directly
   - On `failed`: `SyncJobService.markFailed()`

4. **Create `src/modules/sync/listeners/order-erp-sync.listener.ts`:**
   - Listen for order creation events (EventEmitter2 if available, or inject via module)
   - Use `SyncJobService.createOrderJob()` for order sync
   - Note: No existing listener file — this is a NEW file

5. **Unit tests**

**Files to create:**

- `src/modules/sync/processors/order-sync.processor.ts`
- `src/modules/sync/dto/agent-callback.dto.ts`
- `src/modules/sync/processors/__tests__/order-sync.processor.spec.ts`

**Files to modify:**

- `src/modules/sync/controllers/agent-callback.controller.ts`
- `src/modules/sync/listeners/order-erp-sync.listener.ts` — NEW (listen for order events)
- `src/modules/sync/sync.module.ts`

**Validation Commands:**

```bash
pnpm turbo lint --filter=@apps/api --fix
pnpm turbo build --filter=@apps/api
pnpm turbo test --filter=@apps/api -- --testPathPattern=order-sync|agent-callback
pnpm turbo type-check
```

---

### Task 11.5: Full Codebase Validation + Fix All Issues

- **Priority:** P0 (BLOCKING — must pass before any new feature work)
- **Risk:** medium
- **Status:** passing
- **Depends on:** Task 11
- **Complexity:** 5

**Description:**
Run the full validation suite across the entire monorepo — lint, build, type-check, unit tests, and e2e tests. Fix every error, warning, and failure before continuing with Task 12+. This ensures the foundation (Tasks 1-11) is solid and nothing is silently broken.

**Implementation Details:**

1. **Lint + auto-fix** — fix all lint errors and warnings:

   ```bash
   pnpm turbo lint --filter=@apps/api --fix
   pnpm turbo lint --filter=@repo/shared --fix
   ```

   - Fix any remaining lint errors that `--fix` cannot auto-resolve
   - Ensure zero warnings

2. **Build** — both shared and API must compile cleanly:

   ```bash
   pnpm turbo build --filter=@repo/shared
   pnpm turbo build --filter=@apps/api
   ```

   - Fix all TypeScript compilation errors

3. **Type check** — workspace-wide cross-package type safety:

   ```bash
   pnpm turbo type-check
   ```

   - Fix any cross-package type mismatches

4. **Unit tests** — all existing tests must pass:

   ```bash
   pnpm turbo test --filter=@apps/api
   ```

   - Fix any failing tests
   - Ensure all test suites for Tasks 1-11 pass (agent-registry, erp-mapping, circuit-breaker, agent-communication, sync-ingest, sync-job, order-sync)

5. **E2E tests** — run if they exist:

   ```bash
   pnpm turbo test:e2e --filter=@apps/api
   ```

   - Fix any failing e2e tests

**Acceptance criteria:**

- `pnpm turbo lint --filter=@apps/api` exits 0
- `pnpm turbo build --filter=@repo/shared` exits 0
- `pnpm turbo build --filter=@apps/api` exits 0
- `pnpm turbo type-check` exits 0
- `pnpm turbo test --filter=@apps/api` exits 0 (all suites pass)
- Zero lint warnings, zero type errors, zero test failures

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

**Implementation Details:**

1. **`src/modules/sync/services/dead-letter-queue.service.ts`:**
   - `add(data: AddToDLQDto)` → INSERT dead_letter_queue
   - `getUnresolved(vendorId?, page, limit)` → paginated unresolved entries
   - `getDetails(id)` → single entry with full payload
   - `retry(id)`:
     - Load DLQ entry
     - Create new BullMQ job from original payload
     - Log audit: "DLQ entry {id} retried"
     - Return new job ID
   - `resolve(id, resolvedBy)`:
     - Mark `resolved=true`, `resolvedAt=NOW()`, `resolvedBy`
     - Log audit: "DLQ entry {id} resolved by {resolvedBy}"
   - `cleanup(olderThanDays)` → DELETE old resolved entries
   - `alertIfNeeded()` → return count of unresolved entries (for scheduler alerts)

2. **Populate DLQ endpoints in `sync-admin.controller.ts`:**
   - All under `@UseGuards(ApiKeyGuard)`, `@ApiTags('admin')`

3. **Wire `@OnQueueFailed` in processor** (Task 11) to call `DeadLetterQueueService.add()`

4. **Unit tests**

**Files to create:**

- `src/modules/sync/services/dead-letter-queue.service.ts`
- `src/modules/sync/services/__tests__/dead-letter-queue.service.spec.ts`

**Files to modify:**

- `src/modules/sync/controllers/sync-admin.controller.ts`
- `src/modules/sync/processors/order-sync.processor.ts` — wire DLQ
- `src/modules/sync/sync.module.ts`

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
- **Status:** not started
- **Depends on:** Task 8
- **Complexity:** 7
- **Spec reference:** REQ-9

**Description:**  
Drift detection via checksum comparison, binary search resolution.

**Thinking:**  
Reconciliation is critical for maintaining data integrity between ERP and PostgreSQL. The binary search approach minimizes the number of API calls needed to identify specific items that have drifted. The complexity lies in implementing the recursive narrowing algorithm efficiently and handling edge cases (empty ranges, all items drifted, network failures during search). ERP is always the source of truth for physical inventory.

**Planning:**

1. Implement checksum comparison at the vendor level first
2. Add binary search logic with proper recursion termination (≤10 items)
3. Implement conflict resolution with ERP-wins upsert strategy
4. Add comprehensive logging to reconciliation_events for audit trail
5. Test with mock agent responses to validate the binary search narrows correctly

**Implementation Details:**

1. **`src/modules/sync/services/reconciliation.service.ts`:**
   - `detectDrift(vendorId)`:
     - Call agent `GET /sync/checksum` → ERP hash
     - Compute PostgreSQL hash from items table
     - If match → log "no drift" → return
     - If mismatch → `binarySearchSync(vendorId, minSku, maxSku)`
   - `binarySearchSync(vendorId, rangeStart, rangeEnd)`:
     - If range ≤ 10 items → item-by-item comparison
     - Split range midpoint → checksum each half → recurse on mismatched half
   - `resolveConflict(vendorId, erpItems[])`:
     - ERP always wins → upsert to PostgreSQL
     - Log to reconciliation_events
   - `triggerFullSync(vendorId)` → public method for admin endpoint

2. **Admin endpoints:**
   - `POST /api/admin/reconciliation/trigger` — `@UseGuards(ApiKeyGuard)`
   - `GET /api/admin/reconciliation/events` — paginated event log

3. **Unit tests**

**Files to create:**

- `src/modules/sync/services/reconciliation.service.ts`
- `src/modules/sync/dto/reconciliation.dto.ts`
- `src/modules/sync/services/__tests__/reconciliation.service.spec.ts`

**Files to modify:**

- `src/modules/sync/controllers/sync-admin.controller.ts`
- `src/modules/sync/sync.module.ts`

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
- **Status:** not started
- **Depends on:** Task 5, Task 12, Task 13
- **Complexity:** 5
- **Spec reference:** REQ-10

**Description:**  
Replace all cron jobs with `@nestjs/schedule` decorators.

**Implementation Details:**

1. **`src/modules/sync/schedulers/sync-scheduler.service.ts`:**

   ```typescript
   @Cron('0 * * * *') async detectDrift()         // hourly
   @Interval(300_000)  async checkAgentHealth()    // every 5 min
   @Interval(900_000)  async checkDLQ()            // every 15 min
   @Cron('0 2 * * *')  async cleanupExpiredJobs()  // daily 2AM
   @Cron('0 3 * * 0')  async archiveReconEvents()  // Sun 3AM
   @Cron('0 4 * * 6')  async cleanupResolvedDLQ()  // Sat 4AM
   ```

2. **`src/modules/sync/services/sync-cleanup.service.ts`:**
   - `cleanupExpiredJobs()` → delete sync_jobs where expiresAt < NOW()
   - `archiveReconciliationEvents(olderThanDays: 30)` → delete old events
   - `cleanupResolvedDLQ(olderThanDays: 30)` → delete resolved DLQ entries

3. **`src/modules/sync/services/alert.service.ts`:**
   - `sendAlert(type, message, context)`:
     - Always log via Logger (warn level)
     - If `SLACK_WEBHOOK_URL` configured → POST to Slack
   - Alert types: `agent_offline`, `dlq_entries_found`, `circuit_breaker_open`, `reconciliation_drift`

4. **Unit tests**

**Files to create:**

- `src/modules/sync/schedulers/sync-scheduler.service.ts`
- `src/modules/sync/services/sync-cleanup.service.ts`
- `src/modules/sync/services/alert.service.ts`
- `src/modules/sync/services/__tests__/sync-scheduler.service.spec.ts`
- `src/modules/sync/services/__tests__/alert.service.spec.ts`

**Files to modify:**

- `src/modules/sync/sync.module.ts`

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
- **Status:** not started
- **Depends on:** Task 10
- **Complexity:** 4
- **Spec reference:** REQ-11

**Description:**  
PostgreSQL aggregation queries for sync job metrics, reconciliation metrics, and agent health dashboard.

**Implementation Details:**

1. **`src/modules/sync/services/sync-metrics.service.ts`:**
   - `getSyncMetrics(vendorId)`:
     ```typescript
     // Query sync_jobs: COUNT by status, AVG(completedAt-createdAt) for latency,
     // SUM(retryCount > 0) / COUNT(*) for retry rate
     return {
       total,
       pending,
       processing,
       completed,
       failed,
       successRate: ((completed / total) * 100).toFixed(1),
       avgLatencyMs: number,
       p95LatencyMs: number,
       retryRate: ((retried / total) * 100).toFixed(1),
     };
     ```
   - `getReconciliationMetrics(vendorId)`:
     - Event counts by type, last run timestamp, drift frequency (drifts/total checks)
   - `getAgentHealth()`:
     - All agents with status, last heartbeat, uptime percentage
   - `getJobDetails(jobId)`:
     - Full job record

2. **Admin endpoints in `sync-admin.controller.ts`:**
   - `GET /api/admin/metrics/:vendorId`
   - `GET /api/admin/metrics/reconciliation/:vendorId`
   - `GET /api/admin/sync-status/:jobId`

3. **Unit tests**

**Files to create:**

- `src/modules/sync/services/sync-metrics.service.ts`
- `src/modules/sync/services/__tests__/sync-metrics.service.spec.ts`

**Files to modify:**

- `src/modules/sync/controllers/sync-admin.controller.ts`
- `src/modules/sync/sync.module.ts`

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
- **Status:** not started
- **Depends on:** Task 4
- **Complexity:** 3
- **Spec reference:** REQ-11

**Description:**  
Add Redis, BullMQ, database, and agent health indicators to the existing `/health` endpoint.

**Implementation Details:**

1. **Custom health indicators:**
   - `src/modules/health/indicators/redis.health.ts` — `PING` redis → up/down
   - `src/modules/health/indicators/bullmq.health.ts` — check queue sizes → warning if > 100 waiting
   - `src/modules/health/indicators/agent.health.ts` — count online agents vs total
   - `src/modules/health/indicators/database.health.ts` — `SELECT 1` → up/down

2. **Update `health.controller.ts`:**
   - Add all 4 new indicators to `health.check([...])`

3. **Update `health.module.ts`:**
   - Import indicators, provide them

4. **Unit tests**

**Files to create:**

- `src/modules/health/indicators/redis.health.ts`
- `src/modules/health/indicators/bullmq.health.ts`
- `src/modules/health/indicators/agent.health.ts`
- `src/modules/health/indicators/database.health.ts`

**Files to modify:**

- `src/modules/health/health.controller.ts`
- `src/modules/health/health.module.ts`

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
- **Status:** not started
- **Depends on:** Task 1
- **Complexity:** 3

**Description:**  
Ensure no secrets in code, complete `.env.example`, add gitignore rules.

**Files to create:**

- `scripts/check-secrets.sh` — grep for potential leaked secrets
- `docs/secrets-guide.md` — document all env vars

**Files to modify:**

- `.gitignore` — ensure `*.env`, `!.env.example`, `!.env.prod.example`
- `.env.example` — all variables with dummy values + comments
- `.env.prod.example` — production variable template

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
- **Status:** not started
- **Depends on:** Task 16
- **Complexity:** 4

**Description:**  
Tag Docker images with Git SHA, create rollback script.

**Files to create:**

- `scripts/build-and-tag.sh`
- `scripts/rollback.sh`
- `docs/rollback-runbook.md`

**Validation Commands:**

```bash
pnpm turbo lint --filter=@apps/api --fix
pnpm turbo build --filter=@apps/api
pnpm turbo type-check
bash scripts/build-and-tag.sh
docker images | grep restomarket-api
```

---

### Task 19: GitHub Actions CI/CD

- **Priority:** P1
- **Risk:** medium
- **Status:** not started
- **Depends on:** Task 18
- **Complexity:** 5

**Description:**  
CI/CD pipeline: lint → test → build → Docker → deploy.

**Files to create:**

- `.github/workflows/ci-cd.yml` — main pipeline
- `.github/workflows/security-scan.yml` — Trivy + npm audit
- `.github/dependabot.yml`

**Validation Commands:**

```bash
pnpm turbo lint --filter=@apps/api --fix
pnpm turbo build --filter=@apps/api
pnpm turbo type-check
cat .github/workflows/ci-cd.yml | python3 -c "import sys,yaml; yaml.safe_load(sys.stdin)"
```

---

### Task 20: Zero-Downtime Deployment Script

- **Priority:** P1
- **Risk:** medium
- **Status:** not started
- **Depends on:** Task 18
- **Complexity:** 6

**Description:**  
Blue-green deployment with health verification and automatic rollback.

**Files to create:**

- `scripts/deploy-blue-green.sh`
- `docs/deployment-runbook.md`

**Files to modify:**

- Note: `apps/api/src/main.ts` already has `app.enableShutdownHooks()` — no changes needed there

**Validation Commands:**

```bash
pnpm turbo lint --filter=@apps/api --fix
pnpm turbo build --filter=@apps/api
pnpm turbo type-check
bash scripts/deploy-blue-green.sh --dry-run
```

---

### Task 21: Verify Correlation ID Propagation in Sync Services

- **Priority:** P1
- **Risk:** low
- **Status:** not started
- **Depends on:** Task 4
- **Complexity:** 2

**Description:**
`CorrelationIdMiddleware` ALREADY EXISTS at `apps/api/src/common/middleware/correlation-id.middleware.ts` and is already applied globally to all routes via `AppModule.configure()`. This task verifies that sync services properly propagate the correlation ID through agent HTTP calls and BullMQ jobs.

**Implementation Details:**

1. Verify `AgentCommunicationService` passes `req.correlationId` in the `X-Correlation-ID` header to agents
2. Verify BullMQ job payloads include `correlationId` for traceability
3. Verify pino logger context includes `correlationId` (already handled by `LoggerContextMiddleware`)

**Files to create:** none (middleware already exists)

**Files to modify (if needed):**

- `src/modules/sync/services/agent-communication.service.ts` — ensure correlation ID forwarded
- `src/modules/sync/services/sync-job.service.ts` — include correlation ID in BullMQ job data

**Validation Commands:**

```bash
pnpm turbo lint --filter=@apps/api --fix
pnpm turbo build --filter=@apps/api
pnpm turbo type-check
```

---

### Task 22: Integration Tests

- **Priority:** P1
- **Risk:** low
- **Status:** not started
- **Depends on:** Tasks 9, 11, 13
- **Complexity:** 6

**Description:**  
End-to-end tests for all sync flows.

**Test scenarios:**

1. Agent register → heartbeat → status check → show online
2. Seed mappings → POST items → verify items in DB with resolved codes
3. POST items with same content_hash → all skipped
4. POST items with old timestamp → rejected
5. POST items with unmapped unit code → item fails, others succeed
6. POST stock → verify stock in DB
7. POST warehouses → verify warehouses in DB
8. Order created → BullMQ job → mock agent callback → order updated
9. Health endpoint → all subsystems reported
10. Rate limiting: exceed limit → 429 response

**Files to create:**

- `test/sync-ingest.e2e-spec.ts`
- `test/order-sync.e2e-spec.ts`
- `test/agent-registry.e2e-spec.ts`

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

| Phase              | Tasks  | Key Deliverable                                       |
| ------------------ | ------ | ----------------------------------------------------- |
| 1: Foundation      | 1-2    | BullMQ, schedule, opossum deps, config, schemas       |
| 2: Repositories    | 3      | 5 typed Drizzle repositories                          |
| 3: Module Scaffold | 4      | SyncModule, guards, directory structure               |
| 4: Core Services   | 5-8    | Agent registry, mappings, circuit breaker, agent HTTP |
| 5: Direct Ingest   | 9      | **Agent → NestJS → PG (direct pipeline)**             |
| Gate: Validation   | 11.5   | **Lint, build, type-check, tests — zero failures**    |
| 6: Outbound Sync   | 10-12  | BullMQ order→ERP, callback, DLQ                       |
| 7: Background      | 13-16  | Reconciliation, scheduler, metrics, health            |
| 8: Hardening       | 17-22  | Secrets, CI/CD, deployment, verify correlation, E2E   |
| **Total**          | **23** | **Production-grade NestJS ERP sync**                  |

---

## Quick Status Dashboard

| #    | Task                              | Phase         | Status      |
| ---- | --------------------------------- | ------------- | ----------- |
| 1    | Dependencies + Redis + Config     | Foundation    | passing     |
| 2    | Database Schemas (Drizzle)        | Foundation    | passing     |
| 3    | Sync Repositories                 | Repositories  | passing     |
| 4    | SyncModule Skeleton + Guards      | Scaffold      | passing     |
| 5    | Agent Registry Service            | Core Services | passing     |
| 6    | ERP Code Mapping Service          | Core Services | passing     |
| 7    | Circuit Breaker Service           | Core Services | passing     |
| 8    | Agent Communication Service       | Core Services | passing     |
| 9    | Sync Ingest Service + Controller  | Direct Ingest | passing     |
| 10   | Sync Job Service                  | Outbound Sync | passing     |
| 11   | Order Sync Processor + Callback   | Outbound Sync | passing     |
| 11.5 | **Full Validation + Fix Issues**  | **Gate**      | passing     |
| 12   | Dead Letter Queue Service         | Outbound Sync | passing     |
| 13   | Reconciliation Service            | Background    | not started |
| 14   | Scheduler + Cleanup + Alerts      | Background    | not started |
| 15   | Sync Metrics Service              | Background    | not started |
| 16   | Enhanced Health Checks            | Background    | not started |
| 17   | Secrets Management                | Hardening     | not started |
| 18   | Docker Image Tagging + Rollback   | Hardening     | not started |
| 19   | GitHub Actions CI/CD              | Hardening     | not started |
| 20   | Zero-Downtime Deployment          | Hardening     | not started |
| 21   | Verify Correlation ID Propagation | Hardening     | not started |
| 22   | Integration Tests                 | Hardening     | not started |
