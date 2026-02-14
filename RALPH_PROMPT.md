# Ralph Loop Instructions — ERP Sync Architecture

@specs/sync-architecture.md @IMPLEMENTATION_PLAN.md @activity.md @constitution.md @AGENTS.md

---

## Your Mission

You are working on the **RestoMarket NestJS API** (`apps/api/`). Your job is to implement the ERP sync architecture as specified in `specs/sync-architecture.md` and track progress in `IMPLEMENTATION_PLAN.md`.

**Architecture:** `Agent -> NestJS -> PostgreSQL` — one hop, full control, minimal latency.

## Monorepo Context (CRITICAL)

This is a **pnpm workspace monorepo** managed by **Turborepo**:

```
restomarket-app/
├── apps/
│   ├── api/          # NestJS backend — YOUR WORKSPACE
│   └── web/          # Next.js 16 frontend (DO NOT TOUCH)
└── packages/
    ├── shared/       # Drizzle schemas, base repos, types — SCHEMA CHANGES GO HERE
    ├── ui/           # Shared UI components (DO NOT TOUCH)
    ├── eslint-config/
    ├── jest-config/
    └── typescript-config/
```

**Key locations:**

| What                   | Where                                                               |
| ---------------------- | ------------------------------------------------------------------- |
| Drizzle schemas        | `packages/shared/src/database/schema/`                              |
| Schema barrel export   | `packages/shared/src/database/schema/index.ts`                      |
| Base repository        | `packages/shared/src/database/repositories/base/base.repository.ts` |
| DB types               | `packages/shared/src/types/database.types.ts`                       |
| NestJS DB adapters     | `apps/api/src/database/adapters/`                                   |
| NestJS DB module       | `apps/api/src/database/database.module.ts`                          |
| NestJS feature modules | `apps/api/src/modules/`                                             |
| Config validation      | `apps/api/src/config/validation.schema.ts`                          |
| Docker Compose         | `docker-compose.yml` (root — already has PG + Redis)                |
| Drizzle config         | `packages/shared/drizzle.config.ts`                                 |
| Migrations dir         | `packages/shared/drizzle/migrations/`                               |

## Context

This NestJS application is the single backend for RestoMarket. All sync logic (agent communication, retries, deduplication, code mapping, reconciliation, circuit breaking, dead letter queue, health monitoring) lives in this app.

**Technology choices (non-negotiable):**

| Concern         | Solution                               | Why                                                             |
| --------------- | -------------------------------------- | --------------------------------------------------------------- |
| Job queues      | **BullMQ** (Redis-backed)              | Reliable retry, DLQ, rate limiting, concurrency control         |
| Circuit breaker | **opossum**                            | In-process, no external state, per-vendor isolation             |
| Cron jobs       | **@nestjs/schedule**                   | NestJS-native, decorator-based, testable                        |
| Database        | **PostgreSQL 16 + Drizzle ORM**        | Existing stack, typed queries, migration tooling                |
| Validation      | **class-validator** + Zod              | DTOs validated at controller level, config validated at startup |
| Logging         | **nestjs-pino**                        | Structured JSON, async logging, request correlation             |
| HTTP security   | **helmet**                             | OWASP-recommended HTTP headers (ALREADY in main.ts)             |
| Rate limiting   | **@nestjs/throttler**                  | Per-endpoint protection (ALREADY in app.module.ts)              |
| Health          | **@nestjs/terminus**                   | Redis, BullMQ, PostgreSQL, agent health indicators              |
| HTTP client     | **axios** (existing via @nestjs/axios) | Agent communication, circuit breaker wrapping                   |

**Already existing (DO NOT re-add or recreate):**

- `helmet` middleware in `apps/api/src/main.ts`
- `ThrottlerModule` + `ThrottlerGuard` in `apps/api/src/app.module.ts`
- `app.enableShutdownHooks()` in `apps/api/src/main.ts`
- `SWAGGER_ENABLED` gating and Swagger setup
- CORS restricted to config origins
- `ValidationPipe` in `main.ts` only (NOT in AppModule — do not duplicate)
- `CorrelationIdMiddleware` at `apps/api/src/common/middleware/correlation-id.middleware.ts`
- `LoggerContextMiddleware` at `apps/api/src/common/middleware/logger-context.middleware.ts`
- Redis service in `docker-compose.yml`
- `compression` middleware in `main.ts`
- `HttpExceptionFilter`, `ResponseInterceptor`, `LoggingInterceptor`, `TimeoutInterceptor`

---

## Process for Each Iteration

### Phase 1: Orient

1. Read `specs/sync-architecture.md` — full feature spec with requirements + security + performance
2. Read `IMPLEMENTATION_PLAN.md` — tasks across phases with status
3. Read `activity.md` — what was recently completed
4. Read `constitution.md` — project standards and conventions (**MUST** follow)

### Phase 2: Select Task

Pick the **SINGLE** highest-priority task with Status: **"not started"**.

Priority rules:

1. Follow the task numbering order — tasks are dependency-sorted
2. Never skip a task unless explicitly blocked
3. If a task is "failing", fix it before moving to new tasks

### Phase 3: Implement

1. Implement the **SINGLE** task you selected
2. Follow **ALL** standards in `constitution.md`
3. Keep changes minimal and focused on the single task
4. **Before writing a new file**, read the existing equivalent pattern:
   - Schema -> read `packages/shared/src/database/schema/auth.schema.ts`
   - Schema barrel -> read `packages/shared/src/database/schema/index.ts`
   - Base repository -> read `packages/shared/src/database/repositories/base/base.repository.ts`
   - NestJS adapter -> read `apps/api/src/database/adapters/nestjs-user.repository.ts`
   - DB module -> read `apps/api/src/database/database.module.ts` (schema registration)
   - Feature module -> read `apps/api/src/modules/users/users.module.ts`
   - Controller -> read `apps/api/src/modules/health/health.controller.ts`
   - Config validation -> read `apps/api/src/config/validation.schema.ts`
   - Middleware -> read `apps/api/src/common/middleware/correlation-id.middleware.ts`
   - main.ts -> read `apps/api/src/main.ts`
   - app.module.ts -> read `apps/api/src/app.module.ts`

### Phase 4: Validate (CRITICAL — NEVER SKIP)

Run **ALL** validation commands using **turbo** (monorepo requirement). Every task MUST pass the full pipeline:

```bash
# 1. Auto-fix lint + formatting (ALWAYS)
pnpm turbo lint --filter=@apps/api --fix

# 2. Build shared (ALWAYS if packages/shared/ changed, otherwise skip)
pnpm turbo build --filter=@repo/shared

# 3. Build API (ALWAYS — catches TypeScript errors)
pnpm turbo build --filter=@apps/api

# 4. Run relevant tests (ALWAYS when tests exist for the task)
pnpm turbo test --filter=@apps/api -- --testPathPattern=<relevant>

# 5. Workspace-wide type check (ALWAYS — catches cross-package issues)
pnpm turbo type-check

# 6. DB migrations (ONLY if Drizzle schemas changed in packages/shared/)
pnpm db:generate && pnpm db:migrate
```

**DO NOT proceed if ANY validation fails.** Fix issues first, then re-run the FULL pipeline.

### Phase 5: Record Progress

1. Update `IMPLEMENTATION_PLAN.md`:
   - Change task Status to **"passing"** in the task detail section
   - Change status to **"passing"** in the **Quick Status Dashboard** table at the bottom
2. Append summary to `activity.md` with:
   - Task number and name
   - Files created/modified
   - Key implementation decisions
   - Validation results

### Phase 6: Commit

```bash
git add .
git commit -m "feat(<scope>): <brief description>

- Detail 1
- Detail 2

Completes Task N in IMPLEMENTATION_PLAN"
```

Scopes: `sync`, `database`, `orders`, `health`, `devops`, `config`, `security`

---

## Existing Patterns to Match (MANDATORY)

### Monorepo Schema Pattern (`packages/shared/src/database/schema/`)

```typescript
// File: packages/shared/src/database/schema/my-table.schema.ts
import {
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  index,
  jsonb,
  integer,
  boolean,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const myTable = pgTable(
  'my_table',
  {
    id: text('id').primaryKey(), // text PK like auth tables, or uuid('id').defaultRandom().primaryKey()
    // ...columns with snake_case SQL names, camelCase TS keys
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  table => [index('my_table_some_col_idx').on(table.someCol)],
);

export type MyTable = typeof myTable.$inferSelect;
export type NewMyTable = typeof myTable.$inferInsert;

// ALSO export from packages/shared/src/database/schema/index.ts
```

### Database Module Schema Registration (`apps/api/src/database/database.module.ts`)

```typescript
// CRITICAL: Use explicit named imports, NOT import * as schema
// The explicit schema object avoids CJS/ESM interop issues
import { myTable, myTableRelations } from '@repo/shared/database/schema';

const schema = {
  // ...existing entries...
  myTable,
  myTableRelations,
};
```

### NestJS Repository Adapter Pattern (`apps/api/src/database/adapters/`)

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { MyRepositoryBase, myTable, type DatabaseConnection, type ILogger } from '@repo/shared';
import { DATABASE_CONNECTION } from '../database.module';

@Injectable()
export class MyRepository extends MyRepositoryBase {
  constructor(@Inject(DATABASE_CONNECTION) db: DatabaseConnection, pinoLogger: PinoLogger) {
    const logger: ILogger = {
      info: (msg, ctx) => pinoLogger.info(ctx ?? {}, msg),
      error: (msg, ctx) => pinoLogger.error(ctx ?? {}, msg),
      warn: (msg, ctx) => pinoLogger.warn(ctx ?? {}, msg),
      debug: (msg, ctx) => pinoLogger.debug(ctx ?? {}, msg),
    };
    super(db, myTable, logger);
    pinoLogger.setContext(MyRepository.name);
  }
}
```

### AppModule Pattern (`apps/api/src/app.module.ts`)

```typescript
// DO NOT add any of these — they ALREADY exist:
// - ConfigModule.forRoot with Zod validate
// - LoggerModule.forRoot(getPinoConfig())
// - ThrottlerModule.forRootAsync + ThrottlerGuard as APP_GUARD
// - DatabaseModule (global)
// - HttpExceptionFilter as APP_FILTER
// - ResponseInterceptor, TimeoutInterceptor, LoggingInterceptor as APP_INTERCEPTOR
// - CorrelationIdMiddleware + LoggerContextMiddleware via NestModule.configure()

// To add SyncModule: just add it to the imports array
```

### main.ts Pattern (`apps/api/src/main.ts`)

```typescript
// DO NOT modify main.ts unless absolutely necessary. It already has:
// - NestFactory.create(AppModule, { bufferLogs: true, bodyParser: false })
// - helmet() middleware
// - CORS from config
// - compression middleware
// - ValidationPipe (whitelist + forbidNonWhitelisted + transform)
// - Swagger gated behind nodeEnv !== 'production'
// - app.enableShutdownHooks()
// - Process event listeners for graceful shutdown
```

### Config Validation Pattern (`apps/api/src/config/validation.schema.ts`)

```typescript
// Add new env vars to the existing envSchema z.object({...})
// Access via ConfigService with registerAs factories
```

### Feature Module Pattern (`apps/api/src/modules/`)

```
src/modules/sync/
  sync.module.ts
  controllers/
    agent-ingest.controller.ts
    ...
  services/
    agent-registry.service.ts
    ...
  dto/
    agent-register.dto.ts
    ...
  interfaces/
  processors/
  schedulers/
```

---

## What NOT to Do

- Do NOT create schemas in `apps/api/src/database/schema/` — they go in `packages/shared/src/database/schema/`
- Do NOT use `import * as schema` in database.module.ts — use explicit named imports
- Do NOT re-add helmet, ThrottlerModule, ValidationPipe, enableShutdownHooks, CORS config, CorrelationIdMiddleware, compression, or any middleware/guard that already exists
- Do NOT use `pnpm build` directly — use `pnpm turbo build --filter=@apps/api`
- Do NOT use `pnpm test` directly — use `pnpm turbo test --filter=@apps/api`
- Do NOT use `pnpm lint` directly — use `pnpm turbo lint --filter=@apps/api`
- Do NOT put modules at `src/sync/` or `src/orders/` — they go in `src/modules/sync/`
- Do NOT use `console.log` — use `Logger` from `nestjs-pino` or `PinoLogger`
- Do NOT use `any` type (except in catch blocks)
- Do NOT write functions longer than 50 lines — extract private helpers
- Do NOT skip Swagger decorators on controller endpoints
- Do NOT commit `.env` files — only `.env.example` with dummy values
- Do NOT skip unit tests for new services
- Do NOT hardcode secrets, URLs, or magic numbers — use ConfigService or named constants
- Do NOT modify existing working modules (health, users, auth) unless task requires it
- Do NOT create a `docker-compose.prod.yml` unless the task specifically requires it

---

## Security Rules (Non-Negotiable)

1. **helmet** in `main.ts` — ALREADY EXISTS, do not touch
2. **CORS** restricted to known origins — ALREADY EXISTS
3. **@nestjs/throttler** on all agent and admin endpoints — use `@Throttle()` decorators for per-route overrides
4. **Agent auth**: Bearer token -> bcrypt compare against `agent_registry.auth_token_hash`
5. **Admin auth**: `X-API-Key` -> constant-time compare via `timingSafeEqual` against `API_SECRET`
6. **Zod config validation** at startup — add new env vars to `validation.schema.ts`
7. **Swagger gated** behind env check — ALREADY EXISTS
8. **Payload limits**: 5MB incremental sync, 10MB batch sync — controller-level guards
9. **Audit logging**: All admin mutations log actor + action + timestamp
10. **No PII in logs** — mask token values, use vendor IDs not names

## Performance Rules

1. **Batch size limits**: Max 500 items per incremental request, max 5000 per batch; reject with 413 if exceeded
2. **DB pool**: `DATABASE_POOL_MAX` env var (already exists, default 10)
3. **In-memory cache**: ERP mappings — 5min TTL, max 10,000 entries per vendor
4. **BullMQ concurrency**: 5 workers for order-sync, 2 for reconciliation
5. **Graceful shutdown**: `app.enableShutdownHooks()` — ALREADY EXISTS
6. **Pagination**: All list endpoints `?page=1&limit=50`, max limit 100
7. **Database indexes**: Every foreign key, every `WHERE`-clause column, composite indexes for common queries
8. **Response compression**: ALREADY EXISTS via `compression` middleware

---

## Completion Signal

When ALL tasks in `IMPLEMENTATION_PLAN.md` show Status: **"passing"**, output:

```
<promise>SYNC_MIGRATION_COMPLETE</promise>
```

## If Stuck

If you cannot make progress after 30 total iterations:

1. Document blockers in `IMPLEMENTATION_PLAN.md` and `activity.md`
2. Output: `<promise>BLOCKED</promise>`

## Iteration End Check

Before finishing each iteration:

- If ALL tasks are "passing" -> `<promise>SYNC_MIGRATION_COMPLETE</promise>`
- If stuck for 3+ iterations on same task -> `<promise>BLOCKED</promise>`
- Otherwise -> Brief summary of what was completed, then **end response**

## Critical Rules

1. **One task at a time** — never work on multiple tasks in one iteration
2. **Always validate** — no commits without passing `pnpm turbo build --filter=@apps/api` minimum
3. **Follow dependency order** — tasks are numbered by dependency
4. **Match existing patterns** — read existing files before writing new ones
5. **No dangling questions** — do NOT ask "shall I continue?" Complete and exit
6. **Secrets safety** — never commit real secrets
7. **Preserve existing functionality** — health, users, auth modules must keep working
8. **Swagger on everything** — `@ApiTags`, `@ApiOperation`, `@ApiResponse` on all endpoints
9. **Test before commit** — at least basic unit tests for every new service
10. **Error format consistency** — use `ValidationException`, `DatabaseException`, `BusinessException` from `src/common/exceptions/`
