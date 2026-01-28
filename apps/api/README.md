# NestJS Clean Architecture API

Production-ready NestJS API boilerplate with Clean Architecture, Drizzle ORM, and comprehensive DevOps setup.

## 🚀 Features

### Core Architecture

- ✅ **Clean Architecture** - Domain-driven design with clear separation of concerns
- ✅ **Type-Safe Configuration** - Zod validation with full TypeScript type inference
- ✅ **Repository Pattern** - Base repository with common operations and error handling

### Database & ORM

- ✅ **Drizzle ORM** - Type-safe database operations with PostgreSQL
- ✅ **Graceful Shutdown** - Proper lifecycle management for database connections
- ✅ **Query Optimization** - GIN indexes for text search and optimized queries
- ✅ **Soft Delete Pattern** - Built-in soft delete support with `deletedAt` timestamps

### API & Documentation

- ✅ **Swagger Documentation** - Auto-generated API documentation with OpenAPI 3.0
- ✅ **Response Interceptors** - Standardized API response format
- ✅ **Validation Pipes** - DTO validation with class-validator
- ✅ **Pagination Support** - Built-in pagination utilities and decorators

### Logging & Monitoring

- ✅ **Pino Logger** - High-performance structured logging with context tracking
- ✅ **Health Checks** - Database connectivity and system health monitoring
- ✅ **Correlation IDs** - Request tracking across services

### Security

- ✅ **Helmet** - Security headers protection
- ✅ **CORS** - Configurable cross-origin resource sharing
- ✅ **Rate Limiting** - Throttler for API rate limiting
- ✅ **Input Validation** - Comprehensive validation with class-validator and Zod

### DevOps & Testing

- ✅ **Docker Ready** - Multi-stage Dockerfile and docker-compose setup
- ✅ **Testing** - Unit, integration, and e2e tests with Jest
- ✅ **Code Quality** - ESLint, Prettier, Husky git hooks with lint-staged
- ✅ **Git Hooks** - Pre-commit, commit-msg validation, and pre-push checks
- ✅ **Conventional Commits** - Automated commit message validation
- ✅ **CI/CD Ready** - Production-ready build configuration

## 📋 Prerequisites

- **Node.js** 20+ (LTS recommended)
- **pnpm** 8+ (Package manager)
- **PostgreSQL** 16+ (Database)
- **Docker & Docker Compose** (Optional, for containerized development)

## 🛠️ Installation

### 1. Clone and Install Dependencies

```bash
# Clone the repository
git clone <repository-url>
cd nest-js-boilerplate

# Install dependencies
pnpm install
```

### 2. Setup Environment Variables

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your configuration
# Update DATABASE_URL, PORT, and other variables as needed
```

### 3. Start PostgreSQL Database

**Option A: Using Docker (Recommended)**

```bash
docker-compose -f docker/docker-compose.yml up -d postgres
```

**Option B: Local PostgreSQL**

```bash
# Make sure PostgreSQL is running on your system
# Update DATABASE_URL in .env accordingly
```

### 4. Run Database Migrations

```bash
# Generate migration files
pnpm db:generate

# Apply migrations to database
pnpm db:migrate
```

### 5. Start the Application

**Development Mode:**

```bash
pnpm start:dev
```

**Production Mode:**

```bash
# Build the application
pnpm build

# Start production server
pnpm start:prod
```

### 6. Verify Installation

- **API:** http://localhost:3000/api
- **Swagger Docs:** http://localhost:3000/api/docs
- **Health Check:** http://localhost:3000/api/health

## 🐳 Docker Usage

### Development Environment

```bash
# Start all services (PostgreSQL + API)
cd docker
docker-compose up

# Or start in detached mode
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Production Deployment

```bash
# Build production image
docker build -f docker/Dockerfile -t nestjs-api:latest .

# Run container
docker run -d \
  -p 3000:3000 \
  --env-file .env \
  --name nestjs-api \
  nestjs-api:latest

# View logs
docker logs -f nestjs-api

# Stop container
docker stop nestjs-api
```

## 📖 API Documentation

### Swagger UI

Access interactive API documentation at: **http://localhost:3000/api/docs**

### Available Endpoints

- **Health Check:** `GET /api/health`
  - Returns database connectivity and system status
- **Users CRUD:** `GET|POST|PATCH|DELETE /api/users`
  - Full CRUD operations with pagination and filtering

### Configuration

Swagger can be enabled/disabled via environment variables:

```bash
SWAGGER_ENABLED=true  # Enable Swagger UI (default in development)
```

## 🧪 Testing

### Run Tests

```bash
# Unit tests
pnpm test

# Watch mode
pnpm test:watch

# E2E tests
pnpm test:e2e

# Test coverage
pnpm test:cov

# Debug tests
pnpm test:debug
```

### Coverage Goals

- **Overall Coverage:** 80%+
- **Statements:** 80%+
- **Branches:** 75%+
- **Functions:** 80%+
- **Lines:** 80%+

## 📂 Project Structure

```
src/
├── main.ts                 # Application entry point
├── app.module.ts          # Root module
│
├── common/                # Shared utilities & cross-cutting concerns
│   ├── constants/         # Application constants
│   ├── decorators/        # Custom decorators (pagination, roles, etc.)
│   ├── dto/              # Base DTOs (pagination, filtering)
│   ├── exceptions/        # Custom exception classes
│   ├── filters/          # Exception filters
│   ├── interceptors/      # Response, logging, timeout interceptors
│   ├── middleware/        # Correlation ID, logger context
│   ├── pipes/            # Validation and transformation pipes
│   ├── types/            # TypeScript type definitions
│   └── utils/            # Helper utilities (date, pagination)
│
├── config/                # Configuration management
│   ├── *.config.ts       # Feature configs (app, database, cors, etc.)
│   ├── config.types.ts   # TypeScript configuration types
│   └── validation.schema.ts  # Zod validation schemas
│
├── core/                  # Clean Architecture layers
│   └── (future: domain, application, infrastructure)
│
├── database/              # Database layer
│   ├── database.module.ts     # Database module with lifecycle hooks
│   ├── repositories/          # Data access layer
│   │   ├── base.repository.ts    # Base repository with CRUD
│   │   └── *.repository.ts       # Feature-specific repositories
│   ├── schema/                # Drizzle ORM schemas
│   │   ├── base.schema.ts        # Common schema fields
│   │   └── *.schema.ts          # Entity schemas
│   └── helpers/               # Database utilities
│       └── error-handler.helper.ts  # PostgreSQL error handling
│
├── modules/               # Feature modules
│   ├── health/           # Health check endpoints
│   ├── upload/           # File upload functionality
│   └── users/            # Users CRUD module
│       ├── users.controller.ts   # HTTP endpoints
│       ├── users.service.ts      # Business logic
│       ├── users.module.ts       # Module definition
│       └── dto/                  # Request/response DTOs
│
├── shared/                # Shared business logic
│   ├── interfaces/        # Common interfaces
│   └── services/          # Shared services
│
└── logger/                # Logging configuration
    └── pino.config.ts     # Pino logger setup
```

### Key Design Patterns

- **Repository Pattern:** Abstracts data access logic
- **Module Pattern:** Feature-based organization
- **Decorator Pattern:** Custom decorators for metadata
- **Interceptor Pattern:** Cross-cutting concerns (logging, transformation)
- **Factory Pattern:** Configuration and service instantiation

## 🔒 Environment Variables

### Required Variables

| Variable       | Description                  | Default       | Example                                    |
| -------------- | ---------------------------- | ------------- | ------------------------------------------ |
| `NODE_ENV`     | Environment mode             | `development` | `development`, `production`, `test`        |
| `PORT`         | Application port             | `3000`        | `3000`                                     |
| `DATABASE_URL` | PostgreSQL connection string | -             | `postgresql://user:pass@localhost:5432/db` |

### Optional Variables

| Variable          | Description                 | Default      |
| ----------------- | --------------------------- | ------------ |
| `LOG_LEVEL`       | Logging level               | `info`       |
| `SWAGGER_ENABLED` | Enable Swagger UI           | `true` (dev) |
| `CORS_ENABLED`    | Enable CORS                 | `true`       |
| `CORS_ORIGIN`     | Allowed origins             | `*`          |
| `THROTTLE_TTL`    | Rate limit time window (ms) | `60000`      |
| `THROTTLE_LIMIT`  | Max requests per TTL        | `10`         |

### Example .env File

```bash
# Application
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/nestjs_db

# Logging
LOG_LEVEL=debug

# API Documentation
SWAGGER_ENABLED=true

# Security
CORS_ENABLED=true
CORS_ORIGIN=http://localhost:3000,http://localhost:4200

# Rate Limiting
THROTTLE_TTL=60000
THROTTLE_LIMIT=100
```

> **Note:** For complete configuration documentation, see the inline comments in `.env.example`

## 📝 Available Scripts

### Development

| Command            | Description                              |
| ------------------ | ---------------------------------------- |
| `pnpm start:dev`   | Start development server with hot-reload |
| `pnpm start:debug` | Start in debug mode                      |
| `pnpm start`       | Start without watch mode                 |

### Production

| Command           | Description             |
| ----------------- | ----------------------- |
| `pnpm build`      | Build for production    |
| `pnpm start:prod` | Start production server |

### Code Quality

| Command       | Description                    |
| ------------- | ------------------------------ |
| `pnpm lint`   | Run ESLint and auto-fix issues |
| `pnpm format` | Format code with Prettier      |

### Testing

| Command           | Description             |
| ----------------- | ----------------------- |
| `pnpm test`       | Run unit tests          |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm test:cov`   | Run tests with coverage |
| `pnpm test:e2e`   | Run end-to-end tests    |
| `pnpm test:debug` | Debug tests             |

### Database

| Command            | Description                             |
| ------------------ | --------------------------------------- |
| `pnpm db:generate` | Generate migration files from schema    |
| `pnpm db:migrate`  | Apply migrations to database            |
| `pnpm db:push`     | Push schema changes directly (dev only) |
| `pnpm db:studio`   | Open Drizzle Studio (GUI)               |

### Utilities

| Command        | Description                                 |
| -------------- | ------------------------------------------- |
| `pnpm prepare` | Setup Husky git hooks (auto-run on install) |

## 📚 Documentation

- [Configuration Guide](./docs/CONFIGURATION.md) - Complete configuration system documentation
- [Configuration Quick Reference](./docs/CONFIG_QUICK_REF.md) - Quick start and common patterns
- [Refactoring Summary](./docs/REFACTORING_SUMMARY.md) - Details of all improvements

## 🎯 Type-Safe Configuration

This project uses a type-safe configuration system with Zod validation and TypeScript type inference.

### Usage Example

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Configuration } from '@config/config.types';

@Injectable()
export class MyService {
  constructor(private readonly config: ConfigService<Configuration, true>) {}

  myMethod() {
    // ✅ Fully type-safe with IntelliSense
    const port = this.config.get('app.port', { infer: true });
    // Type: number

    const env = this.config.get('app.nodeEnv', { infer: true });
    // Type: "development" | "production" | "test"

    const dbUrl = this.config.get('database.url', { infer: true });
    // Type: string

    // ✅ Nested configuration access
    const corsEnabled = this.config.get('cors.enabled', { infer: true });
    // Type: boolean
  }
}
```

### Benefits

- **Type Safety:** Full TypeScript support with autocomplete
- **Runtime Validation:** Zod schemas validate environment variables at startup
- **Clear Errors:** Descriptive error messages for invalid configurations
- **Centralized:** All configuration in one place
- **Testable:** Easy to mock for unit tests

### Adding New Configuration

1. Add environment variable to `.env`
2. Update Zod schema in `config/validation.schema.ts`
3. Add config loader in `config/*.config.ts`
4. Export type in `config/config.types.ts`

Types are automatically inferred from your Zod schemas!

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

### Git Hooks

This project uses **Husky** to enforce code quality and commit standards automatically:

- **Pre-commit:** Auto-fixes ESLint issues and formats code with Prettier
- **Commit-msg:** Validates commit messages follow Conventional Commits format
- **Pre-push:** Runs tests and linter before pushing to remote

📚 **Full Documentation:** See [Husky Quick Reference](./.husky/QUICK_REFERENCE.md)

### Code Standards

1. **Follow Conventional Commits**

   ```
   <type>(<scope>): <subject>
   ```

   - `feat:` New features
   - `fix:` Bug fixes
   - `docs:` Documentation changes
   - `style:` Code style changes (formatting)
   - `refactor:` Code refactoring
   - `test:` Adding or updating tests
   - `chore:` Maintenance tasks

   **Examples:**

   ```bash
   git commit -m "feat: add user authentication"
   git commit -m "fix(api): resolve null pointer exception"
   git commit -m "docs: update README"
   ```

2. **Maintain Type Safety**
   - Use strict TypeScript
   - Add proper type definitions
   - Use type-safe configuration system

3. **Code Quality**
   - Run linting and tests before committing
   - Fix all ESLint warnings/errors
   - Format code with Prettier
   - Maintain test coverage above 80%

### Development Workflow

```bash
# 1. Create a feature branch
git checkout -b feat/your-feature-name

# 2. Make your changes
# ... write code ...

# 3. Run tests and linting
pnpm lint
pnpm test
pnpm test:e2e

# 4. Commit (Husky will run pre-commit hooks)
git add .
git commit -m "feat: add your feature description"

# 5. Push and create PR
git push origin feat/your-feature-name
```

### Pull Request Guidelines

- Provide clear description of changes
- Reference related issues
- Include tests for new features
- Update documentation as needed
- Ensure CI/CD pipeline passes

## 📄 License

MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🎯 Quick Start

Get up and running in 5 minutes:

```bash
# 1. Install dependencies
pnpm install

# 2. Setup environment
cp .env.example .env

# 3. Start database
docker-compose -f docker/docker-compose.yml up -d postgres

# 4. Run migrations
pnpm db:generate
pnpm db:migrate

# 5. Start development server
pnpm start:dev
```

### Access Points

- **API:** http://localhost:3000/api
- **Swagger Docs:** http://localhost:3000/api/docs
- **Health Check:** http://localhost:3000/api/health
- **Database Studio:** `pnpm db:studio` (http://localhost:4983)

## ✅ Production-Ready Checklist

This boilerplate includes all essential features for production deployment:

### Architecture & Design

- [x] Clean Architecture with clear separation of concerns
- [x] Repository pattern for data access
- [x] Domain-driven design principles
- [x] Modular feature-based structure

### Type Safety & Validation

- [x] TypeScript strict mode enabled
- [x] Zod validation for environment variables
- [x] Type-safe configuration with inference
- [x] DTO validation with class-validator

### Database & ORM

- [x] Drizzle ORM with PostgreSQL
- [x] Migration system with version control
- [x] Repository pattern implementation
- [x] Graceful database shutdown
- [x] Optimistic locking support
- [x] Soft delete pattern
- [x] GIN indexes for text search
- [x] Centralized error handling
- [x] Safe bigint handling

### API & Documentation

- [x] RESTful API design
- [x] OpenAPI 3.0 specification
- [x] Swagger UI documentation
- [x] Response standardization
- [x] Pagination support
- [x] Filtering and sorting utilities

### Security

- [x] Helmet security headers
- [x] CORS configuration
- [x] Rate limiting (Throttler)
- [x] Input validation and sanitization
- [x] Environment variable validation
- [x] Error message sanitization

### Logging & Monitoring

- [x] Pino structured logging
- [x] Correlation ID tracking
- [x] Context-aware logging
- [x] Health check endpoints
- [x] Database connectivity monitoring
- [x] Request/response logging

### Testing

- [x] Jest testing framework
- [x] Unit test setup
- [x] Integration test setup
- [x] E2E test setup
- [x] Test coverage reporting
- [x] Mock utilities

### DevOps & Deployment

- [x] Docker multi-stage build
- [x] Docker Compose for development
- [x] Production-ready Dockerfile
- [x] Environment-based configuration
- [x] Graceful shutdown handling
- [x] Health check endpoints for orchestration

### Code Quality

- [x] ESLint configuration
- [x] Prettier formatting
- [x] Husky git hooks
- [x] Lint-staged for pre-commit
- [x] Conventional commits
- [x] TypeScript path aliases

### Developer Experience

- [x] Hot reload in development
- [x] Type-safe configuration
- [x] Comprehensive documentation
- [x] Example modules (Users CRUD)
- [x] Clear project structure
- [x] Environment variable examples

### Performance

- [x] Compression middleware
- [x] Optimized database queries
- [x] Connection pooling
- [x] Efficient logging
- [x] Request timeout handling

---

## 📚 Additional Resources

### Documentation

- [NestJS Documentation](https://docs.nestjs.com/)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [Pino Logger Documentation](https://getpino.io/)
- [Zod Validation Documentation](https://zod.dev/)

### Related Projects

- [NestJS Examples](https://github.com/nestjs/nest/tree/master/sample)
- [Drizzle Examples](https://github.com/drizzle-team/drizzle-orm/tree/main/examples)

### Tools

- **Drizzle Studio:** Visual database browser (`pnpm db:studio`)
- **Swagger UI:** Interactive API documentation
- **Postman/Insomnia:** API testing tools

---

## 🐛 Troubleshooting

### Common Issues

**Database Connection Failed**

```bash
# Check if PostgreSQL is running
docker-compose -f docker/docker-compose.yml ps

# Check DATABASE_URL in .env
echo $DATABASE_URL
```

**Port Already in Use**

```bash
# Change PORT in .env
PORT=3001

# Or kill the process using port 3000
lsof -ti:3000 | xargs kill -9
```

**Migration Issues**

```bash
# Reset migrations (development only)
pnpm db:push

# Or manually drop database and re-run migrations
```

**TypeScript Errors**

```bash
# Clear build cache
rm -rf dist/
pnpm build
```

---

## 💡 Tips & Best Practices

1. **Always use ConfigService** instead of `process.env` for type safety
2. **Use the Repository pattern** for all database operations
3. **Add pagination** to all list endpoints
4. **Log with context** using correlation IDs
5. **Validate all inputs** with DTOs and class-validator
6. **Write tests** for new features before merging
7. **Use database transactions** for multi-step operations
8. **Handle errors gracefully** with custom exceptions
9. **Document APIs** with Swagger decorators
10. **Keep modules focused** on single responsibility

---

**Built with ❤️ using NestJS, Drizzle ORM, and TypeScript**

For questions or issues, please open an issue on GitHub.
