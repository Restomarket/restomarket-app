# Activity Log

> Append-only. Each entry is a timestamped record of what was done.

---

## 2025-02-12

- **Documents refactored**: All 6 RALPH loop documents rewritten from scratch with production-grade security, performance, and NestJS best practices.
- **Gap analysis completed**: 30+ gaps identified across security (no helmet, CORS wide open, no rate limiting, no Swagger gating), performance (no DB pool config, no batch limits, duplicate ValidationPipe), and NestJS best practices (no global exception filter, no correlation IDs).
- **RALPH_PROMPT.md**: Now includes mandatory security rules (10 items), performance rules (8 items), existing pattern code references, and "What NOT to Do" section.
- **specs/sync-architecture.md**: Expanded to 16 requirements. Includes REQ-13 (Security Hardening) and REQ-14 (Performance Optimization). Added authentication matrix, data retention policy, per-endpoint rate limiting specs, measurable success metrics.
- **IMPLEMENTATION_PLAN.md**: 22 tasks across 8 phases. Includes security hardening, correlation ID task, integration tests task, secrets management task. Every task now includes spec reference, risk level, effort estimate, and validation commands.
- **constitution.md**: Completely rewritten. Added API response format standard, HTTP status code table, error handling conventions (service/BullMQ/repository layers), logging standards with required context fields, BullMQ conventions, performance rules, and Docker standards.
- **AGENTS.md**: Enhanced with security validation commands and performance validation commands.
- **Status**: Ready for Phase 1, Task 1 implementation.

## 2026-02-12 — Monorepo Alignment Audit

All 6 Ralph Wiggum loop documents audited against actual codebase and corrected:

### Critical fixes applied:

**loop.sh:**

- Fixed completion signal: `DEVOPS_COMPLETE` -> `SYNC_MIGRATION_COMPLETE` (matches RALPH_PROMPT.md)
- Fixed grep patterns: `Status:.*passing` -> `^\|.*\| passing \|` (matches markdown table format in Quick Status Dashboard)
- Updated default max_iterations from 10 to 30
- Added `count_tasks()` helper function for reliable table parsing

**RALPH_PROMPT.md (complete rewrite):**

- Added Monorepo Context section with correct file locations
- Fixed ALL file path references (was `src/database/schema/items.schema.ts` -> now `packages/shared/src/database/schema/auth.schema.ts`)
- Fixed pattern references: schema, base repo, NestJS adapter, DB module, feature module, controller, config validation, middleware, main.ts, app.module.ts
- Added "Already existing (DO NOT re-add)" section listing 12+ features already present
- Fixed validation commands: `pnpm build` -> `pnpm turbo build --filter=@apps/api`
- Removed false references to EventEmitterModule, non-existent files

**IMPLEMENTATION_PLAN.md:**

- Task 1: Removed duplicate instructions to add helmet, ThrottlerModule, enableShutdownHooks, Swagger gating, CORS, Redis (all already exist). Kept only NEW work: BullMQ, schedule, opossum, bcrypt, config vars
- Task 2: Fixed all 5 schema paths from `src/database/schema/` to `packages/shared/src/database/schema/`
- Task 3: Rewrote to follow two-layer pattern (base repo in shared + NestJS adapter in api)
- Task 4: Fixed module path from `src/sync/` to `src/modules/sync/`
- Task 11: Fixed non-existent `src/orders/listeners/order-erp-sync.listener.ts` -> new file
- Task 16: Fixed `src/health/` to `src/modules/health/`
- Task 21: Changed from "create CorrelationIdMiddleware" to "verify propagation" (middleware already exists)
- ALL validation commands: `pnpm build` -> `pnpm turbo build --filter=@apps/api`
- ALL test commands: `pnpm test` -> `pnpm turbo test --filter=@apps/api`
- Bulk replaced 89 occurrences of `src/sync/` -> `src/modules/sync/`

**specs/sync-architecture.md:**

- Fixed false claim: "items, stock, warehouses already have content_hash" -> noted these tables don't exist yet
- Fixed `@nestjs/terminus` from "Already installed" to "NEW (install)"
- Fixed acceptance criteria paths to `packages/shared/` and `apps/api/`

**constitution.md (complete rewrite):**

- Added actual monorepo directory structure
- Added NestJS conventions: module pattern, two-layer DB pattern, logging, error handling, API response format
- Added concrete turbo build commands with correct filter names
- Added database commands section

**AGENTS.md (rewrite):**

- Added package name table (@apps/api, @repo/shared, web)
- Added Quick Reference section for ERP sync work with three scenarios
- Added database migration commands

**Status**: All documents now accurately reflect the codebase. Ready for Phase 1, Task 1.

## 2026-02-12 — Task 1: Dependencies + Redis + Config (COMPLETED)

**What was done:**

- Installed NEW sync dependencies:
  - Production: `@nestjs/bullmq`, `bullmq`, `ioredis`, `@nestjs/schedule`, `@nestjs/terminus`, `opossum`, `bcrypt`
  - Development: `@types/opossum`, `@types/bcrypt`
- Added sync-specific env vars to `apps/api/src/config/validation.schema.ts`:
  - `REDIS_URL` (default: redis://localhost:6379)
  - `AGENT_SECRET` (min 16 chars, optional in dev)
  - `API_SECRET` (min 32 chars, optional in dev)
  - `SLACK_WEBHOOK_URL` (optional)
  - `BULLMQ_CONCURRENCY` (1-20, default 5)
- Created `apps/api/src/config/redis.config.ts` (registerAs factory)
- Created `apps/api/src/config/sync.config.ts` (registerAs factory)
- Updated `apps/api/src/config/config.types.ts` with `RedisConfig` and `SyncConfig` interfaces
- Updated `apps/api/src/app.module.ts`:
  - Added `ScheduleModule.forRoot()` import
  - Added `BullModule.forRootAsync()` with Redis URL from config
  - Loaded `redisConfig` and `syncConfig` in ConfigModule
- Updated `apps/api/.env.example` with comprehensive sync configuration section

**Files created:**

- `apps/api/src/config/redis.config.ts`
- `apps/api/src/config/sync.config.ts`

**Files modified:**

- `apps/api/package.json`
- `apps/api/src/config/validation.schema.ts`
- `apps/api/src/config/config.types.ts`
- `apps/api/src/app.module.ts`
- `apps/api/.env.example`

**Validation results:**

- ✅ `pnpm turbo build --filter=@apps/api` — PASSED
- ✅ `docker compose config` — VALID
- ✅ `pnpm turbo lint --filter=@apps/api` — PASSED (6 warnings about turbo env vars, expected)

**Key decisions:**

- Did NOT re-add existing features (helmet, ThrottlerModule, ValidationPipe, Redis in docker-compose)
- Followed existing config pattern (registerAs factories with typed interfaces)
- Made AGENT_SECRET and API_SECRET optional in dev, required in prod (validation enforces min length when present)

**Status:** Task 1 PASSING — ready for Task 2

## 2026-02-12 — Task 2: Database Schemas (COMPLETED)

**What was done:**

- Created 5 new Drizzle schema files in `packages/shared/src/database/schema/`:
  1. `sync-jobs.schema.ts` — Job lifecycle tracking (16 columns, 5 indexes)
  2. `agent-registry.schema.ts` — Agent registration and health (10 columns, 3 indexes)
  3. `erp-code-mappings.schema.ts` — ERP→Resto code translation (9 columns, 2 indexes + unique constraint)
  4. `dead-letter-queue.schema.ts` — Failed job persistence (13 columns, 4 indexes)
  5. `reconciliation-events.schema.ts` — Audit log for drift detection (7 columns, 3 indexes)
- Created `sync-relations.ts` with Drizzle relations:
  - syncJobs → deadLetterQueue (one-to-many)
  - deadLetterQueue → syncJobs (many-to-one)
  - Empty relations for agent_registry, erp_code_mappings, reconciliation_events (for future expansion)
- Updated `packages/shared/src/database/schema/index.ts` to export all 6 new files
- Updated `apps/api/src/database/database.module.ts`:
  - Added 10 new imports (5 tables + 5 relations)
  - Registered all in explicit schema object (avoiding CJS/ESM interop issues)
- Generated migration `0008_nervous_iron_fist.sql` with all 5 new tables
- Applied migration successfully to PostgreSQL

**Files created:**

- `packages/shared/src/database/schema/sync-jobs.schema.ts`
- `packages/shared/src/database/schema/agent-registry.schema.ts`
- `packages/shared/src/database/schema/erp-code-mappings.schema.ts`
- `packages/shared/src/database/schema/dead-letter-queue.schema.ts`
- `packages/shared/src/database/schema/reconciliation-events.schema.ts`
- `packages/shared/src/database/schema/sync-relations.ts`
- `packages/shared/drizzle/migrations/0008_nervous_iron_fist.sql`

**Files modified:**

- `packages/shared/src/database/schema/index.ts`
- `apps/api/src/database/database.module.ts`

**Key decisions:**

- Used UUID primary keys with `defaultRandom()` for all sync tables (consistent with auth pattern)
- All SQL column names use snake_case, TypeScript keys use camelCase
- Relations separated into sync-relations.ts to avoid circular dependencies
- Foreign keys are soft (no ON DELETE CASCADE) — business logic handles cleanup
- All timestamps use `{ withTimezone: true, mode: 'date' }` for timezone support
- Indexes designed for common query patterns:
  - Composite indexes for vendor+status, vendor+timestamp
  - Individual indexes for status, heartbeat staleness, expiry cleanup
  - Unique constraint on (vendor_id, mapping_type, erp_code) for mappings

**Validation results:**

- ✅ `pnpm turbo build --filter=@repo/shared` — PASSED
- ✅ `pnpm turbo build --filter=@apps/api` — PASSED
- ✅ `pnpm db:generate` — Migration generated (16 tables recognized)
- ✅ `pnpm db:migrate` — Migration applied successfully
- ✅ `pnpm turbo lint --filter=@apps/api` — PASSED (6 warnings about turbo env vars, expected)

**Status:** Task 2 PASSING — ready for Task 3

## 2026-02-12 — Task 3: Sync Repositories (COMPLETED)

**What was done:**

- Created 5 base repository classes in `packages/shared/src/database/repositories/`:
  1. `SyncJobsRepositoryBase` — Job lifecycle, metrics, cleanup (10 methods)
  2. `AgentRegistryRepositoryBase` — Agent registration, heartbeat, health monitoring (9 methods)
  3. `ErpCodeMappingsRepositoryBase` — ERP code resolution, CRUD, bulk seeding (9 methods)
  4. `DeadLetterQueueRepositoryBase` — DLQ management, retry, resolution (8 methods)
  5. `ReconciliationEventsRepositoryBase` — Event logging, metrics, cleanup (7 methods)
- Created 5 NestJS adapter repositories in `apps/api/src/database/adapters/`:
  1. `SyncJobsRepository`
  2. `AgentRegistryRepository`
  3. `ErpCodeMappingsRepository`
  4. `DeadLetterQueueRepository`
  5. `ReconciliationEventsRepository`
- Created index files for each repository directory
- Updated `packages/shared/src/database/repositories/index.ts` to export all new repos
- Updated `packages/shared/src/types/database.types.ts` to re-export sync types (avoiding duplication)
- Updated `apps/api/src/database/adapters/index.ts` to export all new adapters
- Registered all 5 new repositories in `apps/api/src/database/database.module.ts` (providers + exports)

**Files created:**

Base repositories (packages/shared):

- `packages/shared/src/database/repositories/sync-jobs/sync-jobs.repository.base.ts`
- `packages/shared/src/database/repositories/sync-jobs/index.ts`
- `packages/shared/src/database/repositories/agent-registry/agent-registry.repository.base.ts`
- `packages/shared/src/database/repositories/agent-registry/index.ts`
- `packages/shared/src/database/repositories/erp-code-mappings/erp-code-mappings.repository.base.ts`
- `packages/shared/src/database/repositories/erp-code-mappings/index.ts`
- `packages/shared/src/database/repositories/dead-letter-queue/dead-letter-queue.repository.base.ts`
- `packages/shared/src/database/repositories/dead-letter-queue/index.ts`
- `packages/shared/src/database/repositories/reconciliation-events/reconciliation-events.repository.base.ts`
- `packages/shared/src/database/repositories/reconciliation-events/index.ts`

NestJS adapters (apps/api):

- `apps/api/src/database/adapters/nestjs-sync-jobs.repository.ts`
- `apps/api/src/database/adapters/nestjs-agent-registry.repository.ts`
- `apps/api/src/database/adapters/nestjs-erp-code-mappings.repository.ts`
- `apps/api/src/database/adapters/nestjs-dead-letter-queue.repository.ts`
- `apps/api/src/database/adapters/nestjs-reconciliation-events.repository.ts`

**Files modified:**

- `packages/shared/src/database/repositories/index.ts`
- `packages/shared/src/types/database.types.ts`
- `apps/api/src/database/adapters/index.ts`
- `apps/api/src/database/database.module.ts`

**Key decisions:**

- Followed existing two-layer pattern: base repo (framework-agnostic) + NestJS adapter
- All methods return `null` or empty arrays on error (base repos) — adapters can override to throw NestJS exceptions
- Used Drizzle `onConflictDoUpdate` for upserts (agent registry, ERP mappings)
- Metrics methods use PostgreSQL `filter` clauses for efficient aggregation
- Pagination implemented consistently across all `findAll` methods
- Re-exported sync types from schemas to avoid duplication
- PinoLogger adapted to ILogger interface in all adapters

**Validation results:**

- ✅ `pnpm turbo build --filter=@repo/shared` — PASSED
- ✅ `pnpm turbo build --filter=@apps/api` — PASSED
- ✅ `pnpm turbo lint --filter=@apps/api` — PASSED (6 warnings about turbo env vars, expected)
- ✅ `pnpm turbo type-check` — PASSED (all packages)

**Status:** Task 3 PASSING — ready for Task 4

## 2026-02-12 — Task 4: SyncModule Skeleton + Guards (COMPLETED)

**What was done:**

- Created 2 authentication guards in `apps/api/src/common/guards/`:
  1. `AgentAuthGuard` — Bearer token authentication for ERP agents
     - Validates token against bcrypt hash stored in agent_registry
     - Extracts vendorId from body or params
     - Uses `AgentRegistryRepository.findByVendorId()`
  2. `ApiKeyGuard` — X-API-Key authentication for admin endpoints
     - Constant-time comparison via `crypto.timingSafeEqual`
     - Validates against `API_SECRET` from ConfigService
- Created 5 placeholder controllers in `apps/api/src/modules/sync/controllers/`:
  1. `AgentIngestController` — Direct ingest endpoints (Task 9)
  2. `AgentRegistryController` — Agent registration/lifecycle (Task 5)
  3. `AgentCallbackController` — Agent async callbacks (Task 11)
  4. `SyncAdminController` — Admin management endpoints (Tasks 12-15)
  5. `ErpMappingController` — ERP code mapping CRUD (Task 6)
- Created directory structure for SyncModule:
  - `services/` — Service implementations (Tasks 5-15)
  - `processors/` — BullMQ processors (Task 11)
  - `schedulers/` — Cron jobs (Task 14)
  - `dto/` — Data transfer objects (Tasks 5-15)
  - `interfaces/` — TypeScript interfaces (Tasks 5-15)
- Created `SyncModule` with:
  - BullMQ queue registration (order-sync, reconciliation, image-sync)
  - DatabaseModule import
  - All 5 controllers registered
  - AgentAuthGuard and ApiKeyGuard providers
  - Export placeholders for future services
- Registered `SyncModule` in `AppModule` imports
- Created `apps/api/src/common/guards/index.ts` for guard exports

**Files created:**

Guards:

- `apps/api/src/common/guards/agent-auth.guard.ts`
- `apps/api/src/common/guards/api-key.guard.ts`
- `apps/api/src/common/guards/index.ts`

Controllers:

- `apps/api/src/modules/sync/controllers/agent-ingest.controller.ts`
- `apps/api/src/modules/sync/controllers/agent-registry.controller.ts`
- `apps/api/src/modules/sync/controllers/agent-callback.controller.ts`
- `apps/api/src/modules/sync/controllers/sync-admin.controller.ts`
- `apps/api/src/modules/sync/controllers/erp-mapping.controller.ts`

Module and structure:

- `apps/api/src/modules/sync/sync.module.ts`
- `apps/api/src/modules/sync/services/.gitkeep`
- `apps/api/src/modules/sync/processors/.gitkeep`
- `apps/api/src/modules/sync/schedulers/.gitkeep`
- `apps/api/src/modules/sync/dto/.gitkeep`
- `apps/api/src/modules/sync/interfaces/.gitkeep`

**Files modified:**

- `apps/api/src/app.module.ts` — Added SyncModule import and registration

**Key decisions:**

- Guards follow existing pattern: `CanActivate` interface, constructor injection
- AgentAuthGuard uses bcrypt.compare for secure token validation
- ApiKeyGuard uses timingSafeEqual to prevent timing attacks
- Controllers are placeholder stubs with ApiTags and documentation comments
- Module structure follows existing pattern (UsersModule, HealthModule)
- BullMQ queues registered at module level (not globally)
- Guards provided at module level (not global APP_GUARD)

**Validation results:**

- ✅ `pnpm turbo build --filter=@apps/api` — PASSED
- ✅ `pnpm turbo lint --filter=@apps/api` — PASSED (6 warnings about turbo env vars, expected)

**Status:** Task 4 PASSING — ready for Task 5

## 2026-02-12 — Task 5: Agent Registry Service (COMPLETED)

**What was done:**

- Created `AgentRegistryService` with full agent lifecycle management:
  - `register()` — Registers agents with bcrypt-hashed token storage (10 rounds)
  - `heartbeat()` — Updates agent heartbeat and sets status to 'online'
  - `deregister()` — Sets agent status to 'offline' (soft delete for audit)
  - `getAgent()` — Retrieves single agent without sensitive hash
  - `getAllAgents()` — Retrieves all agents without sensitive hashes
  - `checkHealth()` — Monitors heartbeat staleness and updates status (online → degraded @ 60s, degraded → offline @ 300s)
  - `getAgentStats()` — Returns agent count by status
- Created DTOs with validation:
  - `RegisterAgentDto` — Validates vendorId, agentUrl, erpType, authToken (min 16 chars), optional version
  - `AgentHeartbeatDto` — Validates vendorId and optional version
- Populated `AgentRegistryController` with 5 endpoints:
  - `POST /api/agents/register` — Agent self-registration with 10 req/min rate limit
  - `POST /api/agents/heartbeat` — Agent heartbeat with AgentAuthGuard
  - `DELETE /api/agents/:vendorId` — Admin deregistration with ApiKeyGuard
  - `GET /api/agents` — Admin list all agents with stats
  - `GET /api/agents/:vendorId` — Admin get agent details
- All endpoints have Swagger decorators (`@ApiOperation`, `@ApiResponse`, `@ApiTags`, `@ApiBearerAuth`, `@ApiSecurity`)
- Updated `SyncModule` to register `AgentRegistryService` and export it
- Created comprehensive unit tests (18 test cases):
  - Registration: success, bcrypt hashing, null on failure, error handling
  - Heartbeat: success, not found, without version parameter
  - Deregister: success, not found
  - GetAgent: success with hash removal, not found
  - GetAllAgents: success with hash removal, empty array
  - CheckHealth: degraded detection, offline detection, healthy state, multiple changes
  - GetAgentStats: statistics retrieval

**Files created:**

- `apps/api/src/modules/sync/dto/agent-register.dto.ts`
- `apps/api/src/modules/sync/dto/agent-heartbeat.dto.ts`
- `apps/api/src/modules/sync/services/agent-registry.service.ts`
- `apps/api/src/modules/sync/services/__tests__/agent-registry.service.spec.ts`

**Files modified:**

- `apps/api/src/modules/sync/controllers/agent-registry.controller.ts` — Populated with 5 endpoints
- `apps/api/src/modules/sync/sync.module.ts` — Added AgentRegistryService to providers and exports

**Key decisions:**

- DTOs use `!` operator for required properties (class-validator handles initialization)
- Service always removes `authTokenHash` from returned agents (security best practice)
- Deregister uses soft delete (status → 'offline') rather than hard delete for audit trail
- Health check uses 60s threshold for degraded, 300s for offline (per spec)
- Test uses bcrypt hash structure verification instead of spying (bcrypt.hash is read-only)
- Rate limiting on registration endpoint: 10 per minute per IP (prevents abuse)
- All admin endpoints require X-API-Key header (ApiKeyGuard)
- Heartbeat endpoint requires Bearer token (AgentAuthGuard validates against stored hash)

**Validation results:**

- ✅ `pnpm turbo build --filter=@apps/api` — PASSED
- ✅ `pnpm turbo test --filter=@apps/api -- --testPathPattern=agent-registry` — PASSED (18/18 tests)
- ✅ `pnpm turbo lint --filter=@apps/api` — PASSED (7 warnings: 6 turbo env vars expected, 1 pre-existing)

**Status:** Task 5 PASSING — ready for Task 6

## 2026-02-12 — Task 6: ERP Code Mapping Service (COMPLETED)

**What was done:**

- Created `ErpMappingService` with in-memory LRU cache implementation:
  - `resolve()` — Resolve ERP codes with 5-minute TTL cache, max 10,000 entries
  - `createMapping()` — Upsert single mapping and invalidate cache
  - `updateMapping()` — Update mapping by ID and invalidate cache
  - `deleteMapping()` — Soft-delete (deactivate) mapping and invalidate cache
  - `listMappings()` — Paginated list with filtering by vendorId/type
  - `seed()` — Bulk insert mappings and clear entire cache
  - `clearCache()` — Manual cache invalidation
  - `getCacheStats()` — Cache hit/miss metrics for monitoring
- Cache design:
  - Key format: `vendorId:type:erpCode`
  - TTL: 5 minutes (300,000ms)
  - Max size: 10,000 entries with LRU eviction
  - Cache invalidation on write operations (create, update, delete, seed)
  - Hit/miss tracking for performance monitoring
- Created DTOs with comprehensive validation:
  - `CreateErpMappingDto` — Validates all required fields (vendorId, mappingType, erpCode, restoCode, restoLabel)
  - `UpdateErpMappingDto` — Partial update DTO
  - `SeedErpMappingsDto` — Bulk seed with array validation
  - All use class-validator decorators with length constraints
- Populated `ErpMappingController` with 7 endpoints:
  - `GET /api/admin/mappings` — List with pagination, filtering (vendorId, type, includeInactive)
  - `POST /api/admin/mappings` — Create single mapping
  - `PUT /api/admin/mappings/:id` — Update mapping
  - `DELETE /api/admin/mappings/:id` — Soft-delete mapping
  - `POST /api/admin/mappings/seed` — Bulk seed mappings
  - `GET /api/admin/mappings/cache/stats` — Cache statistics
  - `POST /api/admin/mappings/cache/clear` — Clear cache
- All endpoints protected with `ApiKeyGuard`
- All endpoints have comprehensive Swagger decorators
- Created interface file defining `MappingResult`, `CacheEntry`, `MappingType`, `CacheStats`
- Created seed script with example mappings for common ERP systems (EBP, Sage)
- Registered `ErpMappingService` in `SyncModule` providers and exports
- Created comprehensive unit tests (16 test cases):
  - Cache hit, cache miss, cache expiry (time-based)
  - LRU eviction on max size exceeded
  - Mapping CRUD operations (create, update, delete, list)
  - Bulk seed with cache invalidation
  - Cache statistics tracking (hit rate, miss rate)
  - Not-found scenarios

**Files created:**

- `apps/api/src/modules/sync/interfaces/erp-mapping.interface.ts`
- `apps/api/src/modules/sync/dto/erp-mapping.dto.ts`
- `apps/api/src/modules/sync/services/erp-mapping.service.ts`
- `apps/api/src/database/seeds/erp-mappings.seed.ts`
- `apps/api/src/modules/sync/services/__tests__/erp-mapping.service.spec.ts`

**Files modified:**

- `apps/api/src/modules/sync/controllers/erp-mapping.controller.ts` — Populated with 7 endpoints
- `apps/api/src/modules/sync/sync.module.ts` — Added ErpMappingService to providers and exports

**Key decisions:**

- LRU eviction: Simple Map iteration order (first key is oldest inserted)
- Cache invalidation strategy: Per-key on update/delete, full clear on seed
- Time-based expiry: Each cache entry has `expiresAt` timestamp checked on every access
- Cache stats tracking: Separate `cacheHits` and `cacheMisses` counters for monitoring
- Test isolation: `jest.restoreAllMocks()` in afterEach to prevent Date.now() spy leaking between tests
- Controller response format: Consistent with existing API patterns (success/data/message)
- Seed script: Provides examples for common French ERP systems (units, VAT codes, families)

**Validation results:**

- ✅ `pnpm turbo test --filter=@apps/api -- --testPathPattern=erp-mapping` — PASSED (16/16 tests)
- ✅ `pnpm turbo build --filter=@apps/api` — PASSED
- ✅ `pnpm turbo lint --filter=@apps/api` — PASSED (7 warnings: 6 turbo env vars expected, 1 pre-existing)

**Status:** Task 6 PASSING — ready for Task 7

## 2026-02-12 — Task 7: Circuit Breaker Service (COMPLETED)

**What was done:**

- Created `CircuitBreakerService` using `opossum` for per-vendor, per-API-type circuit breaker protection:
  - `getBreaker(vendorId, apiType)` — Creates or retrieves breaker with default config (30s timeout, 50% error threshold, 60s reset)
  - `execute<T>(vendorId, apiType, fn)` — Executes function through circuit breaker with automatic failure tracking
  - `reset(vendorId, apiType)` — Force resets circuit to closed state for manual intervention
  - `getStatus()` — Returns status of all circuit breakers with state and statistics
  - `getState(vendorId, apiType)` — Returns state of specific breaker (open/halfOpen/closed)
- Breaker granularity: Per `vendorId:apiType` (e.g., `vendor123:items`, `vendor123:orders`)
- Event listeners attached to all state transitions:
  - `open` → logs warning with vendor and API type context
  - `halfOpen` → logs info when circuit enters testing state
  - `close` → logs info when circuit recovers
  - `fallback` → logs warning when fallback triggered
  - `timeout` → logs warning on request timeout
- Circuit breaker configuration per spec:
  - `timeout: 30_000` — 30s request timeout
  - `errorThresholdPercentage: 50` — Open after 50% failures
  - `resetTimeout: 60_000` — Try half-open after 1min
  - `volumeThreshold: 5` — Min 5 calls before evaluating
- Created interface definitions for `CircuitBreakerState`, `CircuitBreakerStats`, `CircuitBreakerStatus`, `CircuitBreakerConfig`
- Registered `CircuitBreakerService` in `SyncModule` providers and exports
- Created comprehensive unit tests (19 test cases):
  - Breaker creation: new breaker, existing breaker, separate vendors, separate API types
  - Execution: success, error propagation, success tracking, failure tracking
  - State transitions: circuit opening, healthy circuit, state logging
  - Reset: manual reset, non-existent breaker warning
  - Status: empty status, all breakers, state and stats
  - State retrieval: null for non-existent, closed for healthy, open for tripped

**Files created:**

- `apps/api/src/modules/sync/interfaces/circuit-breaker.interface.ts`
- `apps/api/src/modules/sync/services/circuit-breaker.service.ts`
- `apps/api/src/modules/sync/services/__tests__/circuit-breaker.service.spec.ts`

**Files modified:**

- `apps/api/src/modules/sync/sync.module.ts` — Added CircuitBreakerService to providers and exports

**Key decisions:**

- Used Map to store breakers keyed by `${vendorId}:${apiType}` for O(1) lookup
- Event listeners log all state transitions via PinoLogger for observability
- Service exposes both aggregate status (all breakers) and individual state queries
- Manual reset capability allows admin intervention when circuits are stuck
- TypeScript type assertion `as Promise<T>` needed due to opossum's return type
- Statistics include comprehensive metrics: successes, failures, rejects, fires, timeouts, latency percentiles

**Validation results:**

- ✅ `pnpm turbo test --filter=@apps/api -- --testPathPattern=circuit-breaker` — PASSED (19/19 tests)
- ✅ `pnpm turbo build --filter=@apps/api` — PASSED
- ✅ `pnpm turbo lint --filter=@apps/api` — PASSED (6 warnings about turbo env vars, expected)

**Status:** Task 7 PASSING — ready for Task 8

## 2026-02-12 — Task 8: Agent Communication Service (COMPLETED)

**What was done:**

- Created `AgentCommunicationService` for HTTP communication with vendor ERP agents:
  - `callAgent<T>(vendorId, apiType, endpoint, payload, correlationId?)` — Main method for calling agents
  - Gets agent from `AgentRegistryService` and validates status (online/degraded, not offline)
  - Wraps all HTTP calls through `CircuitBreakerService.execute()` for fault tolerance
  - Uses `@nestjs/axios` HttpService with RxJS `firstValueFrom()` for promise conversion
  - 30s timeout on all requests (matches circuit breaker config)
  - Configurable AGENT_SECRET from ConfigService
  - Optional correlation ID propagated via `X-Correlation-ID` header
  - Comprehensive error logging with AxiosError detection
- Agent call validation:
  - Rejects if agent not found (BusinessException: AGENT_NOT_FOUND)
  - Rejects if agent is offline (BusinessException: AGENT_OFFLINE)
  - Allows calls to degraded agents (warning logged)
  - Validates AGENT_SECRET is configured (BusinessException: AGENT_SECRET_NOT_CONFIGURED)
- Registered HttpModule in SyncModule with 30s timeout and no redirects
- Registered AgentCommunicationService in SyncModule providers and exports
- Created comprehensive unit tests (13 test cases):
  - Successful agent call with data return
  - Correlation ID header inclusion/exclusion
  - Agent not found rejection
  - Offline agent rejection
  - Degraded agent acceptance
  - AGENT_SECRET not configured rejection
  - Circuit breaker error propagation
  - HTTP error propagation and logging (AxiosError)
  - Non-Axios error logging
  - Timeout verification (30s)
  - URL construction from agent base URL + endpoint
  - Debug logging on success

**Files created:**

- `apps/api/src/modules/sync/services/agent-communication.service.ts`
- `apps/api/src/modules/sync/services/__tests__/agent-communication.service.spec.ts`

**Files modified:**

- `apps/api/src/modules/sync/sync.module.ts` — Added HttpModule import, AgentCommunicationService provider and export

**Key decisions:**

- Used RxJS `firstValueFrom()` to convert Observable to Promise for cleaner async/await syntax
- BusinessException requires code + message (not just message) — used error codes: AGENT_NOT_FOUND, AGENT_OFFLINE, AGENT_SECRET_NOT_CONFIGURED
- HTTP timeout set to 30s to match circuit breaker timeout config (consistency)
- Correlation ID is optional parameter, only added to headers when provided
- Degraded agents are allowed (warning logged) — only offline agents are rejected
- All errors are logged with rich context before re-throwing (vendorId, apiType, endpoint, url, correlationId)
- AxiosError detection provides additional context (statusCode, errorCode)

**Validation results:**

- ✅ `pnpm turbo test --filter=@apps/api -- --testPathPattern=agent-communication` — PASSED (13/13 tests)
- ✅ `pnpm turbo build --filter=@apps/api` — PASSED
- ✅ `pnpm turbo lint --filter=@apps/api` — PASSED (6 warnings about turbo env vars, expected)

**Status:** Task 8 PASSING — ready for Task 9

## 2026-02-12 — Task 9: Sync Ingest Service + Controller (COMPLETED)

**What was done:**

- Created 3 new database schemas for sync entities:
  1. `items.schema.ts` — Product catalog (20 columns, 6 indexes)
  2. `warehouses.schema.ts` — Warehouse locations (14 columns, 4 indexes)
  3. `stock.schema.ts` — Inventory levels (11 columns, 5 indexes)
  - All schemas include `content_hash` and `last_synced_at` for deduplication
  - Composite unique constraints on vendor+sku, vendor+erpWarehouseId, vendor+warehouse+item
- Created `items-relations.ts` with Drizzle relations (items → stock, stock → warehouse)
- Updated schema barrel and database module to register new schemas
- Generated migration `0009_loud_clint_barton.sql` for 3 new tables
- Applied migration successfully to PostgreSQL
- Implemented `SyncIngestService` with direct pipeline (THE CORE ARCHITECTURAL WIN):
  - `handleItemChanges(vendorId, items, isBatch)`:
    - Enforces batch limits (500 incremental, 5000 batch)
    - Content-hash deduplication (skip if hash matches existing)
    - Timestamp staleness detection (reject old data)
    - ERP code mapping resolution via ErpMappingService
    - Unit + VAT mappings REQUIRED (fail item if unmapped)
    - Family + Subfamily mappings OPTIONAL (null if unmapped)
    - Batch upsert via Drizzle `onConflictDoUpdate` (vendor_id, sku)
    - Per-item status tracking (processed/skipped/failed with reasons)
    - Chunked processing for batch mode (50 items per chunk)
  - `handleStockChanges(vendorId, stock, isBatch)`:
    - Resolves item ID from SKU and warehouse ID from erpWarehouseId
    - Content-hash deduplication
    - Timestamp staleness detection
    - Batch upsert via ON CONFLICT (vendor_id, warehouse_id, item_id)
  - `handleWarehouseChanges(vendorId, warehouses, isBatch)`:
    - Content-hash deduplication
    - Timestamp staleness detection
    - Batch upsert via ON CONFLICT (vendor_id, erp_warehouse_id)
- Created comprehensive DTOs with class-validator:
  - `ItemSyncIngestDto` (max 500 items), `ItemSyncBatchIngestDto` (max 5000)
  - `StockSyncIngestDto` (max 500 stock), `StockSyncBatchIngestDto` (max 5000)
  - `WarehouseSyncIngestDto` (max 500), `WarehouseSyncBatchIngestDto` (max 5000)
  - All with nested validation via `@ValidateNested()` and `@Type()` transformers
- Populated `AgentIngestController` with 6 endpoints:
  - `POST /api/sync/items` — incremental item sync (30 req/min)
  - `POST /api/sync/items/batch` — batch item sync (5 req/min)
  - `POST /api/sync/stock` — incremental stock sync (30 req/min)
  - `POST /api/sync/stock/batch` — batch stock sync (5 req/min)
  - `POST /api/sync/warehouses` — incremental warehouse sync (30 req/min)
  - `POST /api/sync/warehouses/batch` — batch warehouse sync (5 req/min)
  - All protected with `@UseGuards(AgentAuthGuard)` + Bearer token
  - All with `@Throttle()` rate limiting per endpoint
  - All with comprehensive Swagger documentation (`@ApiOperation`, `@ApiResponse`)
- Registered `SyncIngestService` in SyncModule providers and exports
- Created DTO barrel export at `src/modules/sync/dto/index.ts`
- Unit tests: 7/7 passing (batch limits, content-hash dedup, unmapped unit codes, item-not-found, warehouse-not-found)

**Files created:**

Schemas (packages/shared):

- `packages/shared/src/database/schema/items.schema.ts`
- `packages/shared/src/database/schema/warehouses.schema.ts`
- `packages/shared/src/database/schema/stock.schema.ts`
- `packages/shared/src/database/schema/items-relations.ts`
- `packages/shared/drizzle/migrations/0009_loud_clint_barton.sql`

DTOs (apps/api):

- `apps/api/src/modules/sync/dto/item-sync-ingest.dto.ts`
- `apps/api/src/modules/sync/dto/stock-sync-ingest.dto.ts`
- `apps/api/src/modules/sync/dto/warehouse-sync-ingest.dto.ts`
- `apps/api/src/modules/sync/dto/index.ts`

Service and tests:

- `apps/api/src/modules/sync/services/sync-ingest.service.ts`
- `apps/api/src/modules/sync/services/__tests__/sync-ingest.service.spec.ts`

**Files modified:**

- `packages/shared/src/database/schema/index.ts` — added 4 new exports
- `apps/api/src/database/database.module.ts` — registered 4 new schema objects
- `apps/api/src/modules/sync/controllers/agent-ingest.controller.ts` — populated with 6 endpoints
- `apps/api/src/modules/sync/sync.module.ts` — added SyncIngestService provider + export
- `apps/api/src/modules/sync/services/__tests__/agent-registry.service.spec.ts` — fixed TypeScript strict null check

**Key decisions:**

- Direct pipeline implementation: Agent → NestJS → PostgreSQL (one hop, no middleware, full control)
- Content-hash deduplication at service level (not DB constraint) allows flexible hash algorithms
- Timestamp comparison uses `getTime()` for numeric comparison (avoids timezone issues)
- Non-null assertions (`!`) used after length checks (TypeScript strict mode requirement)
- Batch processing with chunking (50 items per chunk) prevents large transaction timeouts
- Per-item status tracking provides granular feedback to agents (which items succeeded/failed/skipped)
- ERP code mapping resolution integrated directly in item pipeline (unit + VAT required, family optional)
- Stock sync resolves item+warehouse IDs from SKU+erpWarehouseId (validates foreign keys exist)
- All upserts use Drizzle `onConflictDoUpdate` with `sql\`excluded.\*\`` pattern for type safety
- Rate limiting differentiated by endpoint type (30 req/min incremental, 5 req/min batch)

**Validation results:**

- ✅ `pnpm turbo build --filter=@repo/shared` — PASSED
- ✅ `pnpm turbo build --filter=@apps/api` — PASSED
- ✅ `pnpm db:generate` — Migration generated (19 tables recognized)
- ✅ `pnpm db:migrate` — Migration applied successfully
- ✅ `pnpm turbo test --filter=@apps/api -- --testPathPattern=sync-ingest` — PASSED (7/7 tests)
- ✅ `pnpm turbo type-check` — PASSED (all packages)
- ✅ `pnpm turbo lint --filter=@apps/api` — PASSED (6 warnings about turbo env vars, expected)

**Status:** Task 9 PASSING — ready for Task 10

## 2026-02-12 — Task 10: Sync Job Service (COMPLETED)

**What was done:**

- Created `SyncJobService` for managing sync job lifecycle in PostgreSQL + BullMQ queue management
- Implemented 7 core methods:
  1. `createOrderJob()` — Creates sync_jobs row + enqueues BullMQ job with exponential backoff config
     - Implements idempotency: skips if pending/processing job exists for same orderId
     - Returns existing job ID if duplicate detected
     - Sets 24h TTL (expiresAt) on all new jobs
  2. `markProcessing()` — Updates status to 'processing', sets startedAt timestamp
  3. `markCompleted()` — Updates status to 'completed', sets completedAt timestamp, stores erpReference
  4. `markFailed()` — Updates status to 'failed', stores errorMessage + errorStack, tracks retry count
  5. `getJob()` — Retrieves full job record by ID
  6. `getPendingJobs()` — Returns pending jobs (optionally filtered by vendor), paginated
  7. `getRecentJobs()` — Returns recent jobs ordered by createdAt, paginated
- BullMQ job configuration per spec:
  - 5 attempts with exponential backoff: 1m → 2m → 4m → 8m → 16m
  - 24h retention for completed jobs (`removeOnComplete: { age: 86_400 }`)
  - `removeOnFail: false` — keeps failed jobs for DLQ
- Correlation ID propagation: included in BullMQ payload for distributed tracing
- Idempotency protection: checks for existing pending/processing jobs before creating duplicates
- Comprehensive error handling: all methods return null on failure, log context
- Registered `SyncJobService` in `SyncModule` providers and exports
- Created comprehensive unit tests (19 test cases):
  - createOrderJob: success, idempotency (pending), idempotency (processing), create after completed, DB failure, correlationId
  - markProcessing: success, not found
  - markCompleted: success with ERP reference, not found
  - markFailed: Error object, string error message, not found
  - getJob: success, not found
  - getPendingJobs: without vendor filter, with vendor filter
  - getRecentJobs: with pagination, default values

**Files created:**

- `apps/api/src/modules/sync/services/sync-job.service.ts`
- `apps/api/src/modules/sync/services/__tests__/sync-job.service.spec.ts`

**Files modified:**

- `apps/api/src/modules/sync/sync.module.ts` — Added SyncJobService to providers and exports

**Key decisions:**

- Idempotency check uses `findByOrderId()` to prevent duplicate jobs for same order
- Only pending/processing jobs block creation — completed/failed jobs allow new attempts
- BullMQ job payload includes: syncJobId, vendorId, orderId, orderData, correlationId
- All status transitions logged with context (jobId, vendorId, status)
- Error handling: accepts both Error objects and string messages for flexibility
- Retry tracking: markFailed() accepts retryCount + nextRetryAt for BullMQ coordination
- Used `@InjectQueue('order-sync')` for type-safe BullMQ queue injection
- Test mocks use `jest.Mocked<T>` for type safety
- Fixed TypeScript errors: removed non-existent `updatedAt` field from test fixtures (schema only has createdAt)

**Validation results:**

- ✅ `pnpm --filter @apps/api lint --fix` — PASSED (6 warnings about turbo env vars, expected)
- ✅ `pnpm turbo build --filter=@apps/api` — PASSED
- ✅ `pnpm turbo test --filter=@apps/api -- --testPathPattern=sync-job` — PASSED (19/19 tests)
- ✅ `pnpm turbo type-check` — PASSED (all packages)

**Status:** Task 10 PASSING — ready for Task 11

## 2026-02-12 — Task 11: Order Sync Processor + Agent Callback Controller (COMPLETED)

**What was done:**

- Created `OrderSyncProcessor` for BullMQ processing:
  - `@Processor('order-sync')` with concurrency 5
  - `process()` method sends order to ERP agent via AgentCommunicationService
  - Marks job as processing, calls agent, waits for async callback (does NOT mark completed immediately)
  - `@OnWorkerEvent('failed')` handles retry exhaustion and logs warnings for retryable failures
  - `@OnWorkerEvent('completed')` logs successful agent call completion
  - Exports `OrderSyncPayload` interface for typed job data
- Created `AgentCallbackDto` with validation:
  - Required: jobId, status ('completed' | 'failed')
  - Optional: erpReference, error, metadata
  - Comprehensive Swagger decorators
- Populated `AgentCallbackController`:
  - `POST /api/agents/callback` endpoint with AgentAuthGuard
  - Handles completed status: calls `SyncJobService.markCompleted()` with optional erpReference
  - Handles failed status: calls `SyncJobService.markFailed()` with error message (defaults to 'Unknown error')
  - TODO note added for future order update (requires OrdersRepository from future task)
  - Returns consistent success response format
- Updated `SyncJobService.markCompleted()`:
  - Changed `erpReference` parameter from required to optional (string → string?)
  - Only includes erpReference in updateData if provided
  - Added test for completed job without ERP reference
- Updated SyncModule to register OrderSyncProcessor
- Created comprehensive unit tests (16 test cases total):
  - OrderSyncProcessor: 9 tests covering process(), onFailed(), onCompleted()
  - AgentCallbackController: 7 tests covering completed/failed callbacks with/without optional fields
  - Fixed guard dependency issue by overriding AgentAuthGuard in tests

**Files created:**

- `apps/api/src/modules/sync/dto/agent-callback.dto.ts`
- `apps/api/src/modules/sync/processors/order-sync.processor.ts`
- `apps/api/src/modules/sync/processors/__tests__/order-sync.processor.spec.ts`
- `apps/api/src/modules/sync/controllers/__tests__/agent-callback.controller.spec.ts`

**Files modified:**

- `apps/api/src/modules/sync/dto/index.ts` — added agent-callback export
- `apps/api/src/modules/sync/controllers/agent-callback.controller.ts` — populated with callback endpoint
- `apps/api/src/modules/sync/sync.module.ts` — added OrderSyncProcessor to providers
- `apps/api/src/modules/sync/services/sync-job.service.ts` — made erpReference optional in markCompleted()
- `apps/api/src/modules/sync/services/__tests__/sync-job.service.spec.ts` — added test for optional erpReference

**Key decisions:**

- Processor does NOT mark job as completed — agent callback handles final status update
- Correlation ID propagated through BullMQ payload and forwarded to agent
- On retry exhaustion, processor logs error with TODO for Task 12 DLQ integration
- AgentAuthGuard overridden in controller tests to avoid dependency injection issues
- Optional erpReference handled by conditionally including it in updateData object
- Test pattern: override guards with mock implementation that always returns true

**Validation results:**

- ✅ `pnpm turbo lint --filter=@apps/api -- --fix` — PASSED (6 warnings about turbo env vars, expected)
- ✅ `pnpm turbo build --filter=@apps/api` — PASSED
- ✅ `pnpm turbo test --filter=@apps/api -- --testPathPattern='order-sync|agent-callback'` — PASSED (16/16 tests)
- ✅ `pnpm turbo type-check` — PASSED (all packages)

**Status:** Task 11 PASSING — ready for Task 11.5

## 2026-02-12 — Task 11.5: Full Codebase Validation + Fix All Issues (COMPLETED)

**What was done:**

- Executed full validation pipeline across the entire monorepo to ensure foundation (Tasks 1-11) is solid
- All validation steps passed successfully on first attempt — no fixes required
- Verified that all previous implementations are stable and integrated correctly

**Validation results:**

1. **Lint + auto-fix:**
   - ✅ `pnpm --filter @apps/api lint --fix` — PASSED (0 errors, 0 warnings)

2. **Build:**
   - ✅ `pnpm turbo build --filter=@repo/shared` — PASSED (cache hit)
   - ✅ `pnpm turbo build --filter=@apps/api` — PASSED (compiled in 3.937s)

3. **Type check:**
   - ✅ `pnpm turbo type-check` — PASSED (all 7 packages: api, shared, ui, web, eslint-config, jest-config, typescript-config)

4. **Unit tests:**
   - ✅ `pnpm turbo test --filter=@apps/api` — PASSED (11 test suites, 167 tests passed)
   - All sync module tests passing:
     - agent-callback.controller.spec.ts (7 tests)
     - agent-registry.service.spec.ts (18 tests)
     - users.controller.spec.ts
     - order-sync.processor.spec.ts (9 tests)
     - erp-mapping.service.spec.ts (16 tests)
     - sync-ingest.service.spec.ts (7 tests)
     - dead-letter-queue.service.spec.ts
     - sync-job.service.spec.ts (19 tests)
     - users.service.spec.ts
     - agent-communication.service.spec.ts (13 tests)
     - circuit-breaker.service.spec.ts (19 tests)

5. **E2E tests:**
   - ✅ `pnpm turbo test:e2e --filter=@apps/api` — PASSED (2 test suites, 31 tests passed in 18.786s)
   - Tests: users.e2e-spec.ts, app.e2e-spec.ts

**Key observations:**

- Zero lint errors or warnings
- Zero TypeScript compilation errors
- Zero type-checking errors across all packages
- Zero unit test failures (167/167 passed)
- Zero e2e test failures (31/31 passed)
- All Turborepo cache hits working correctly
- Build times optimized with caching (shared: cache hit, api: 3.937s)

**Acceptance criteria met:**

- ✅ All lint checks pass with zero errors/warnings
- ✅ Shared package builds successfully
- ✅ API package builds successfully
- ✅ Cross-package type checking passes
- ✅ All unit tests pass (11 suites, 167 tests)
- ✅ All e2e tests pass (2 suites, 31 tests)
- ✅ No regression in existing functionality

**Status:** Task 11.5 PASSING — validation gate passed, ready for Task 12

## 2026-02-12 — Task 12: Dead Letter Queue Service (VERIFIED COMPLETE)

**What was discovered:**

Task 12 was already implemented and all components were in place. Performed comprehensive validation to confirm completion.

**Existing implementation includes:**

1. **DeadLetterQueueService** (`apps/api/src/modules/sync/services/dead-letter-queue.service.ts`):
   - `add()` — Adds failed jobs to DLQ with full audit context
   - `getUnresolved()` — Paginated list of unresolved entries (filterable by vendorId)
   - `getDetails()` — Single entry retrieval with full payload
   - `retry()` — Re-enqueues job to BullMQ with original payload and config
   - `resolve()` — Marks entry as resolved with audit trail (resolvedBy, resolvedAt)
   - `cleanup()` — Deletes old resolved entries (default 30 days)
   - `getUnresolvedCount()` — Count for alerting (used by Task 14 scheduler)

2. **SyncAdminController** populated with 4 DLQ endpoints:
   - `GET /api/admin/dlq` — List unresolved entries (paginated, vendor-filterable)
   - `GET /api/admin/dlq/:id` — Entry details with full payload
   - `POST /api/admin/dlq/:id/retry` — Re-enqueue to BullMQ
   - `POST /api/admin/dlq/:id/resolve` — Mark as manually resolved
   - All protected with `@UseGuards(ApiKeyGuard)` + `@ApiSecurity('api-key')`
   - Comprehensive Swagger decorators

3. **OrderSyncProcessor** wired to DLQ:
   - `@OnWorkerEvent('failed')` handler detects exhausted retries
   - Calls `dlqService.add()` when `attemptsMade >= job.opts.attempts`
   - Marks sync job as permanently failed
   - Logs full audit context (vendorId, operation, correlationId)

4. **SyncModule** registration:
   - DeadLetterQueueService in providers and exports
   - Injected into OrderSyncProcessor and SyncAdminController
   - BullMQ queue 'order-sync' properly registered

**Comprehensive unit tests** (21 test cases):

- add(): success, repository failure, exception handling
- getUnresolved(): without/with vendor filter, error handling
- getDetails(): success, not found, exception handling
- retry(): success, not found, BullMQ error
- resolve(): success, not found, exception handling
- cleanup(): success, default threshold, error handling
- getUnresolvedCount(): success, vendor filtering, error handling

**Files already implemented:**

- `apps/api/src/modules/sync/services/dead-letter-queue.service.ts`
- `apps/api/src/modules/sync/services/__tests__/dead-letter-queue.service.spec.ts`
- `apps/api/src/modules/sync/controllers/sync-admin.controller.ts` (DLQ endpoints)
- `apps/api/src/modules/sync/processors/order-sync.processor.ts` (DLQ integration)
- `apps/api/src/modules/sync/sync.module.ts` (service registration)

**Validation results:**

- ✅ `pnpm turbo lint --filter=@apps/api -- --fix` — PASSED (0 errors, 0 warnings)
- ✅ `pnpm turbo build --filter=@apps/api` — PASSED (cache hit, 122ms)
- ✅ `pnpm turbo test --filter=@apps/api -- --testPathPattern=dead-letter` — PASSED (21/21 tests)
- ✅ `pnpm turbo type-check` — PASSED (all 7 packages)

**Key implementation details:**

- DLQ entries store original payload for retry capability
- Retry creates new BullMQ job with same config (5 attempts, exponential backoff)
- Resolve operation requires `resolvedBy` identifier for audit trail
- Cleanup uses 30-day default retention per data retention policy (REQ-8)
- Unresolved count method supports scheduler alerts (Task 14)
- All operations log comprehensive audit context
- Error handling returns null/empty rather than throwing (consistent pattern)

**Status:** Task 12 PASSING — ready for Task 13
