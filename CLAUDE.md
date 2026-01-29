# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

RestoMarket is a modern B2B Food Supply Platform built as a **pnpm workspace monorepo** managed by **Turborepo**. The project uses TypeScript throughout and follows a clean architecture pattern for the backend.

## Monorepo Structure

```
restomarket-app/
├── apps/
│   ├── api/          # NestJS backend with clean architecture
│   └── web/          # Next.js 16 frontend
└── packages/
    ├── shared/       # Shared types, constants, and utilities
    ├── ui/           # Shared React UI components
    ├── eslint-config/       # Shared ESLint configuration (flat config)
    ├── jest-config/         # Shared Jest configuration
    └── typescript-config/   # Shared TypeScript configurations
```

## Common Commands

### Development

```bash
# Install all dependencies
pnpm install

# Run all apps in dev mode
pnpm dev

# Run specific app
pnpm --filter web dev
pnpm --filter api dev

# Build all apps
pnpm build

# Build specific app
pnpm --filter api build
```

### Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:cov

# Run API e2e tests
pnpm --filter api test:e2e
```

### Code Quality

```bash
# Lint all packages
pnpm lint

# Lint and auto-fix
pnpm lint:fix

# Format all files
pnpm format

# Check formatting without changes
pnpm format:check

# Type check all packages
pnpm type-check
```

### Database (API)

```bash
# Generate migrations
pnpm --filter api db:generate

# Run migrations
pnpm --filter api db:migrate

# Push schema to database
pnpm --filter api db:push

# Open Drizzle Studio
pnpm --filter api db:studio
```

### Cleaning

```bash
# Clean build artifacts and node_modules
pnpm clean

# Clean Turborepo cache
pnpm clean:cache
```

### Working with Packages

```bash
# Add dependency to specific package
pnpm --filter <package-name> add <dependency>

# Add dev dependency to root workspace
pnpm add -D -w <dependency>

# Run command in all packages
pnpm -r <command>
```

## Architecture Guidelines

### API (apps/api) - NestJS with Clean Architecture

The API follows a pragmatic clean architecture approach:

**Directory Structure:**

- `src/modules/` - Feature modules (e.g., users, health, upload)
  - Each module contains: `controller.ts`, `service.ts`, `module.ts`, `dto/`
  - Controllers handle HTTP, services contain business logic
- `src/database/` - Database layer
  - `repositories/` - Repository pattern implementations extending `BaseRepository`
  - `schema/` - Drizzle ORM schema definitions
  - `helpers/` - Database utilities and error handlers
- `src/common/` - Shared application code
  - `dto/`, `filters/`, `interceptors/`, `pipes/`, `decorators/`, `exceptions/`
- `src/config/` - Configuration files using `@nestjs/config`
- `src/shared/` - Shared services and interfaces
- `src/logger/` - Logging configuration (using Pino)

**Key Patterns:**

- **Repository Pattern**: All database access goes through repositories extending `BaseRepository<TTable>`
  - BaseRepository provides: `transaction()`, `handleError()`, `getUpdatedTimestamp()`
  - Child repositories implement their own query methods using Drizzle ORM
- **Validation**: Uses `class-validator` and `class-transformer` with DTOs
  - Global ValidationPipe is configured to transform and validate all requests
  - Custom `ValidationException` for consistent error responses
- **Error Handling**: Custom exceptions in `src/common/exceptions/`
  - `DatabaseException`, `ValidationException`, etc.
  - Database errors are mapped via `mapDatabaseError()` helper
- **Dependency Injection**: Full use of NestJS DI container
  - Services and repositories are provided at module level

**Testing:**

- Unit tests: `*.spec.ts` files alongside source
- E2E tests: `test/` directory with `jest-e2e.json` config
- Use `supertest` for E2E testing

### Web (apps/web) - Next.js 16

- Next.js 16 with React 19
- Uses the App Router
- Imports UI components from `@repo/ui` package

### Shared Package (@repo/shared)

- Provides shared types, constants, and utilities
- Used by both API and Web
- Structure: `types/`, `constants/`, `utils/`
- All exports flow through `src/index.ts`

## Commit Convention

This project enforces **Conventional Commits** via commitlint:

**Format:** `<type>(<scope>): <subject>`

**Types:**

- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `style` - Code style changes (formatting)
- `refactor` - Code refactoring
- `perf` - Performance improvements
- `test` - Add or update tests
- `build` - Build system changes
- `ci` - CI/CD changes
- `chore` - Other changes
- `revert` - Revert previous commit

**Scopes:**

- `api`, `web`, `ui`, `shared`, `eslint-config`, `jest-config`, `typescript-config`, `root`

**Examples:**

```
feat(api): add user authentication endpoint
fix(web): resolve hydration error on homepage
docs(root): update README with setup instructions
```

## Git Hooks

- **pre-commit**: Runs `lint-staged` to lint and format staged files
- **commit-msg**: Validates commit message format using commitlint
- **pre-push**: Runs all tests and builds (`pnpm test && pnpm build`)

## Configuration Files

- **Turborepo**: `turbo.json` - Defines task pipelines and caching
- **pnpm**: `pnpm-workspace.yaml` - Workspace configuration
- **TypeScript**: Root `tsconfig.json` + package-specific configs extending from `@repo/typescript-config`
- **ESLint**: `eslint.config.mjs` + package-specific configs from `@repo/eslint-config` (flat config format)
- **Prettier**: `.prettierrc` - Shared formatting rules

## Environment Variables (API)

The API uses `@nestjs/config` with validation. See `apps/api/src/config/validation.schema.ts` for all required environment variables. Key variables include:

- `NODE_ENV` - Environment (development, production, test)
- `PORT` / `APP_PORT` - Server port (default: 3000)
- `DATABASE_URL` - PostgreSQL connection string
- `LOG_LEVEL` - Logging level
- `CORS_ORIGINS` - Allowed CORS origins
- `SWAGGER_ENABLED` - Enable/disable Swagger (auto-disabled in production)

## Turborepo Tasks

Tasks are defined in `turbo.json` with dependency graphs:

- `build` - Depends on `^build` (dependencies build first)
- `test` - Depends on `build`
- `lint` - Depends on `^build`
- `type-check` - Depends on `^build`
- `dev` - No cache, persistent
- `start` - Depends on `build`, persistent

## Important Notes

- **Package Manager**: Enforces pnpm only (via `preinstall` script with `only-allow`)
- **Node Version**: >= 20.18.1 (specified in `.nvmrc` and `engines`)
- **ESLint**: Uses ESLint 9 with flat config format
- **Database**: Uses Drizzle ORM with PostgreSQL
- **Logging**: Uses Pino for structured logging in the API
- **API Documentation**: Swagger UI available in non-production environments at `/api/docs`
- **API Versioning**: URI-based versioning (default: v1)
- **Security**: Helmet, CORS, compression, and rate limiting configured
