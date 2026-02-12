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
