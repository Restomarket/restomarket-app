# Validation Commands for Turborepo Monorepo

## Package Names

| Package                        | Filter Name    |
| ------------------------------ | -------------- |
| NestJS API                     | `@apps/api`    |
| Shared (schemas, repos, types) | `@repo/shared` |
| Next.js Web                    | `web`          |

## Incremental Validation Strategy

Ralph MUST run these commands in order after making changes:

### 1. Automatic Fixes

```bash
# Fix linting and formatting issues automatically
pnpm turbo lint --filter=@apps/api --fix
```

### 2. Build (MANDATORY — catches TypeScript errors)

```bash
# If you changed packages/shared/ (schemas, types, repos):
pnpm turbo build --filter=@repo/shared
pnpm turbo build --filter=@apps/api

# If you only changed apps/api/:
pnpm turbo build --filter=@apps/api
```

### 3. Tests

```bash
# Run tests for the specific pattern you changed
pnpm turbo test --filter=@apps/api -- --testPathPattern=<pattern>

# Run all API tests
pnpm turbo test --filter=@apps/api
```

### 4. Workspace-Wide Type Check (if cross-package changes)

```bash
# Only needed when changes span packages/shared/ AND apps/api/
pnpm turbo type-check
```

### 5. Database Migrations (if schema changes)

```bash
# After adding/modifying Drizzle schemas in packages/shared/
pnpm db:generate
pnpm db:migrate
```

## Exit Codes

- **0** = All checks passing, proceed with commit
- **Non-zero** = Failures detected, must fix before committing

## Quick Reference: ERP Sync Work

Most sync tasks only change `apps/api/` and sometimes `packages/shared/`:

### API-only changes (services, controllers, DTOs, guards):

```bash
pnpm turbo lint --filter=@apps/api --fix
pnpm turbo test --filter=@apps/api -- --testPathPattern=<relevant>
pnpm turbo build --filter=@apps/api
```

### Schema + API changes (new tables, new repos):

```bash
pnpm turbo build --filter=@repo/shared
pnpm turbo build --filter=@apps/api
pnpm turbo type-check
pnpm db:generate
pnpm db:migrate
```

### Full validation (before major commits):

```bash
pnpm turbo lint --fix
pnpm turbo build
pnpm turbo test
pnpm turbo type-check
```
