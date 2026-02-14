# Project Constitution

## Monorepo Structure

```
restomarket-app/                   # pnpm workspace + Turborepo
├── apps/
│   ├── api/                       # NestJS backend
│   │   └── src/
│   │       ├── modules/           # Feature modules (health, users, sync)
│   │       ├── database/          # DatabaseModule, NestJS adapters
│   │       ├── config/            # Zod validation, registerAs factories
│   │       ├── common/            # Guards, middleware, filters, interceptors, exceptions, DTOs
│   │       ├── auth/              # Better Auth integration
│   │       ├── logger/            # Pino config
│   │       └── shared/            # SharedModule
│   └── web/                       # Next.js 16 frontend
└── packages/
    ├── shared/                    # Drizzle schemas, base repos, types, utils
    │   └── src/
    │       ├── database/schema/   # ALL Drizzle pgTable definitions go here
    │       ├── database/repositories/  # Framework-agnostic base repos
    │       └── types/             # Shared TypeScript types
    ├── ui/                        # React UI components
    ├── eslint-config/
    ├── jest-config/
    └── typescript-config/
```

## Code Quality Standards

### TypeScript

- Use TypeScript strict mode in all packages.
- No `any` types without explicit justification (catch blocks are acceptable).
- All public APIs must have complete type definitions.
- Prefer type inference over explicit types where clear.

### Naming Conventions

- **File names:** kebab-case (`agent-registry.service.ts`)
- **DB columns:** snake_case (`vendor_id`, `created_at`)
- **TypeScript:** camelCase for variables/properties, PascalCase for classes/types/interfaces
- **Modules:** Located in `apps/api/src/modules/<name>/`

### Testing

- Test files co-located with source: `__tests__/*.spec.ts` or `*.spec.ts`
- Use Jest (configured per package via `@repo/jest-config`)
- At minimum: happy path + error path for every new service
- E2E tests in `apps/api/test/`

### Code Style

- Follow existing patterns in each package.
- Use async/await over raw promises.
- Prefer named exports over default exports.
- Functions should not exceed 50 lines — extract private helpers.

## NestJS Conventions (apps/api)

### Module Pattern

```typescript
// Feature modules live in src/modules/<name>/
// src/modules/sync/
//   sync.module.ts
//   controllers/
//   services/
//   dto/
```

### Database Layer (Two-Layer Pattern)

1. **Schemas** in `packages/shared/src/database/schema/` — Drizzle `pgTable` definitions
2. **Base repositories** in `packages/shared/src/database/repositories/` — extends `BaseRepository`, framework-agnostic
3. **NestJS adapters** in `apps/api/src/database/adapters/` — wraps base repo with NestJS DI + PinoLogger
4. **Schema registration** in `apps/api/src/database/database.module.ts` — explicit named imports (NO `import *`)

### Logging

- Use `nestjs-pino` Logger (NEVER `console.log`)
- PinoLogger injected via constructor
- Correlation ID automatically included via middleware

### Error Handling

- `ValidationException` — request validation failures (from ValidationPipe)
- `DatabaseException` — database operation errors
- `BusinessException` — business logic errors
- All caught by global `HttpExceptionFilter`

### API Response Format

- Success: wrapped by `ResponseInterceptor`
- Pagination: `{ data, meta: { page, limit, totalCount, totalPages, hasNextPage, hasPreviousPage } }`
- Errors: `{ statusCode, message, error, details? }`

### Swagger

- `@ApiTags`, `@ApiOperation`, `@ApiResponse` on every public endpoint
- Gated behind `nodeEnv !== 'production'` in main.ts

## Monorepo Standards

### Build Commands (Always use Turbo)

```bash
pnpm turbo build --filter=@apps/api      # Build API only
pnpm turbo build --filter=@repo/shared    # Build shared package
pnpm turbo test --filter=@apps/api        # Run API tests
pnpm turbo lint --filter=@apps/api        # Lint API
pnpm turbo type-check                     # Type check all packages
```

### Package Dependencies

- Install to specific packages: `pnpm --filter @apps/api add <pkg>`
- Never modify package.json manually without running `pnpm install`
- Respect package boundaries — no direct file imports across packages, use workspace protocol

### Database Commands (Root Level)

```bash
pnpm db:generate    # Generate Drizzle migrations (runs in @repo/shared)
pnpm db:migrate     # Apply migrations
pnpm db:push        # Push schema directly (dev only)
pnpm db:studio      # Open Drizzle Studio
```

## Git Workflow

- Commit after each completed task from `IMPLEMENTATION_PLAN.md`.
- Use conventional commits: `feat(<scope>):`, `fix(<scope>):`, `refactor(<scope>):`, `test(<scope>):`
- Scopes: `api`, `web`, `ui`, `shared`, `sync`, `database`, `config`, `security`
- Each commit should pass validation checks from `AGENTS.md`.
- Do NOT commit `.env` files — only `.env.example` with dummy values.

## When Stuck

If you're blocked after 10 iterations:

1. Document what's blocking progress in `IMPLEMENTATION_PLAN.md`.
2. List what was attempted.
3. Suggest alternative approaches.
4. Update task status to "blocked".
5. Output `<promise>BLOCKED</promise>`.
