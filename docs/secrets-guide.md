# Secrets and Environment Variables Guide

> **Version:** 1.0
> **Last Updated:** 2026-02-12
> **Audience:** Developers, DevOps, Security Team

---

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Environment Variables Reference](#environment-variables-reference)
4. [Secret Generation](#secret-generation)
5. [Environment-Specific Configuration](#environment-specific-configuration)
6. [Security Best Practices](#security-best-practices)
7. [Troubleshooting](#troubleshooting)

---

## Overview

This document provides comprehensive guidance on managing secrets and environment variables for the RestoMarket platform. **Never commit real secrets to version control.**

### Files

| File                       | Purpose                                    | Commit to Git? |
| -------------------------- | ------------------------------------------ | -------------- |
| `.env`                     | Local development secrets (your machine)   | ❌ NO          |
| `.env.example`             | Template with dummy values for development | ✅ YES         |
| `.env.prod.example`        | Template with guidance for production      | ✅ YES         |
| `.env.local`               | Local overrides (any environment)          | ❌ NO          |
| `.env.development`         | Development environment (if needed)        | ❌ NO          |
| `.env.production`          | Production environment (if needed)         | ❌ NO          |
| `.env.staging`             | Staging environment (if needed)            | ❌ NO          |
| `.env.test`                | Test environment (usually committed)       | ✅ YES         |
| `docs/secrets-guide.md`    | This guide                                 | ✅ YES         |
| `scripts/check-secrets.sh` | Script to detect leaked secrets            | ✅ YES         |

### Loading Order

The API uses `@nestjs/config` with Zod validation. Environment variables are loaded in this order:

1. Process environment variables (from shell/system)
2. `.env` file (if exists)
3. `.env.{NODE_ENV}` file (if exists, e.g., `.env.development`)
4. `.env.local` file (if exists, highest priority)

---

## Quick Start

### 1. Clone the Repository

```bash
git clone <repo-url>
cd restomarket-app
pnpm install
```

### 2. Copy the Example File

```bash
# For local development
cp apps/api/.env.example apps/api/.env

# Edit with your values
nano apps/api/.env  # or use your preferred editor
```

### 3. Generate Secrets

```bash
# Better Auth secret (32+ chars)
openssl rand -base64 32

# Agent secret (16+ chars)
openssl rand -base64 24

# API secret (32+ chars)
openssl rand -base64 48

# Or use this one-liner to generate all three:
echo "BETTER_AUTH_SECRET=$(openssl rand -base64 32)"
echo "AGENT_SECRET=$(openssl rand -base64 24)"
echo "API_SECRET=$(openssl rand -base64 48)"
```

### 4. Configure Database

Update `DATABASE_URL` with your PostgreSQL connection string:

```env
# Local PostgreSQL
DATABASE_URL=postgresql://postgres:password@localhost:5432/restomarket

# Supabase (recommended)
DATABASE_URL=postgresql://postgres.YOUR_PROJECT_REF:YOUR_PASSWORD@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=require
```

### 5. Start Development

```bash
pnpm dev
```

---

## Environment Variables Reference

### Core Application Variables

| Variable          | Required | Default           | Description                    | Example                             |
| ----------------- | -------- | ----------------- | ------------------------------ | ----------------------------------- |
| `NODE_ENV`        | No       | `development`     | Environment mode               | `development`, `production`, `test` |
| `APP_NAME`        | No       | `restomarket-api` | Application name (for logging) | `restomarket-api`                   |
| `APP_PORT`        | No       | `3000`            | HTTP server port               | `3002`                              |
| `APP_HOST`        | No       | `0.0.0.0`         | HTTP server host               | `0.0.0.0`                           |
| `API_PREFIX`      | No       | `api`             | API route prefix               | `api`                               |
| `API_VERSION`     | No       | `1`               | API version (URI-based)        | `1`                                 |
| `REQUEST_TIMEOUT` | No       | `30000`           | Global request timeout (ms)    | `30000`                             |

### Database Variables

| Variable                   | Required | Default | Description                                     | Example                                               |
| -------------------------- | -------- | ------- | ----------------------------------------------- | ----------------------------------------------------- |
| `DATABASE_URL`             | ✅ Yes   | -       | PostgreSQL connection string (pooled)           | `postgresql://user:pass@host:6543/db?sslmode=require` |
| `DATABASE_DIRECT_URL`      | No       | -       | Direct connection for migrations                | `postgresql://user:pass@host:5432/db?sslmode=require` |
| `DATABASE_POOL_MAX`        | No       | `10`    | Max connections in pool                         | `20`                                                  |
| `DATABASE_IDLE_TIMEOUT`    | No       | `20`    | Idle connection timeout (seconds)               | `20`                                                  |
| `DATABASE_CONNECT_TIMEOUT` | No       | `10`    | Connection timeout (seconds)                    | `10`                                                  |
| `DATABASE_SSL`             | No       | `true`  | Enable SSL for database (required for Supabase) | `true`                                                |
| `DATABASE_SSL_CA`          | No       | -       | SSL certificate path (if needed)                | `/path/to/ca-certificate.crt`                         |

**Supabase-specific:**

| Variable               | Required | Default | Description                         | Example                           |
| ---------------------- | -------- | ------- | ----------------------------------- | --------------------------------- |
| `SUPABASE_PROJECT_REF` | No       | -       | Supabase project reference ID       | `abcdefghijklmnop`                |
| `SUPABASE_URL`         | No       | -       | Supabase project URL                | `https://PROJECT_REF.supabase.co` |
| `SUPABASE_ANON_KEY`    | No       | -       | Supabase anonymous public key (JWT) | `eyJhbGciOiJIUzI1NiIsInR5cCI6...` |

### Logging Variables

| Variable     | Required | Default | Description                           | Example                                            |
| ------------ | -------- | ------- | ------------------------------------- | -------------------------------------------------- |
| `LOG_LEVEL`  | No       | `info`  | Logging level                         | `fatal`, `error`, `warn`, `info`, `debug`, `trace` |
| `LOG_PRETTY` | No       | `false` | Enable pretty-printed logs (dev only) | `true`                                             |

### Security Variables

| Variable         | Required | Default                 | Description                          | Example                                         |
| ---------------- | -------- | ----------------------- | ------------------------------------ | ----------------------------------------------- |
| `CORS_ORIGINS`   | No       | `http://localhost:3000` | Comma-separated allowed CORS origins | `http://localhost:3000,https://app.example.com` |
| `RATE_LIMIT_TTL` | No       | `60`                    | Rate limit window (seconds)          | `60`                                            |
| `RATE_LIMIT_MAX` | No       | `100`                   | Max requests per window              | `100`                                           |

### Better Auth Variables

| Variable             | Required              | Default | Description                               | Example                                              |
| -------------------- | --------------------- | ------- | ----------------------------------------- | ---------------------------------------------------- |
| `BETTER_AUTH_SECRET` | Dev: No, Prod: ✅ Yes | -       | Secret for encrypting cookies and tokens  | `openssl rand -base64 32`                            |
| `BETTER_AUTH_URL`    | No                    | -       | Base URL for auth callbacks (Next.js app) | `http://localhost:3000` or `https://app.example.com` |

**Note:** `BETTER_AUTH_SECRET` must be the same across API and Next.js app.

### Redis Variables

| Variable    | Required | Default                  | Description                     | Example                             |
| ----------- | -------- | ------------------------ | ------------------------------- | ----------------------------------- |
| `REDIS_URL` | No       | `redis://localhost:6379` | Redis connection URL for BullMQ | `redis://:password@redis-host:6379` |

**Production Redis URL format:**

- With password: `redis://:your_password@your-redis-host:6379`
- With TLS: `rediss://:your_password@your-redis-host:6380`

### ERP Sync Variables

| Variable             | Required              | Default | Description                                 | Example                                       |
| -------------------- | --------------------- | ------- | ------------------------------------------- | --------------------------------------------- |
| `AGENT_SECRET`       | Dev: No, Prod: ✅ Yes | -       | Shared secret for ERP agent authentication  | `openssl rand -base64 24`                     |
| `API_SECRET`         | Dev: No, Prod: ✅ Yes | -       | API key for admin endpoints (internal only) | `openssl rand -base64 48`                     |
| `SLACK_WEBHOOK_URL`  | No                    | -       | Slack webhook for sync alerts (optional)    | `https://hooks.slack.com/services/T00/B00/XX` |
| `BULLMQ_CONCURRENCY` | No                    | `5`     | BullMQ worker concurrency (1-20)            | `5`                                           |

### Swagger Variables

| Variable              | Required | Default                | Description                               | Example                        |
| --------------------- | -------- | ---------------------- | ----------------------------------------- | ------------------------------ |
| `SWAGGER_ENABLED`     | No       | `true`                 | Enable Swagger UI (auto-disabled in prod) | `true`                         |
| `SWAGGER_TITLE`       | No       | `NestJS Clean API`     | Swagger page title                        | `RestoMarket API`              |
| `SWAGGER_DESCRIPTION` | No       | `Production-ready API` | Swagger description                       | `B2B Food Supply Platform API` |
| `SWAGGER_VERSION`     | No       | `1.0`                  | API version in Swagger                    | `1.0`                          |

### Application URLs

| Variable              | Required | Default | Description                  | Example                    |
| --------------------- | -------- | ------- | ---------------------------- | -------------------------- |
| `NEXT_PUBLIC_APP_URL` | No       | -       | Next.js app URL (for CORS)   | `http://localhost:3000`    |
| `NEXT_PUBLIC_API_URL` | No       | -       | API URL (for Next.js client) | `http://localhost:3002/v1` |

---

## Secret Generation

### Recommended Tools

```bash
# OpenSSL (most common)
openssl rand -base64 32   # Generates 32 random bytes, base64-encoded

# Node.js (if OpenSSL not available)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Python
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

### Minimum Requirements

| Secret Type          | Minimum Length | Recommended Command       |
| -------------------- | -------------- | ------------------------- |
| `BETTER_AUTH_SECRET` | 32 chars       | `openssl rand -base64 32` |
| `AGENT_SECRET`       | 16 chars       | `openssl rand -base64 24` |
| `API_SECRET`         | 32 chars       | `openssl rand -base64 48` |
| Database Password    | 16 chars       | `openssl rand -base64 24` |

### Rotation Schedule

| Secret Type          | Rotation Frequency | Rotation Process                                          |
| -------------------- | ------------------ | --------------------------------------------------------- |
| `BETTER_AUTH_SECRET` | Every 90 days      | Update in both API and Next.js, invalidates all sessions  |
| `AGENT_SECRET`       | Every 90 days      | Coordinate with all ERP agents                            |
| `API_SECRET`         | Every 90 days      | Update in deployment secrets, coordinate with admin tools |
| Database Password    | Every 180 days     | Use database provider's rotation tools                    |

---

## Environment-Specific Configuration

### Development

**File:** `apps/api/.env` (local, not committed)

```env
NODE_ENV=development
APP_PORT=3002
DATABASE_URL=postgresql://postgres:password@localhost:5432/restomarket
REDIS_URL=redis://localhost:6379
BETTER_AUTH_SECRET=dev_secret_at_least_32_chars_long
AGENT_SECRET=dev_agent_secret
API_SECRET=dev_api_secret_at_least_32_chars
LOG_LEVEL=debug
LOG_PRETTY=true
SWAGGER_ENABLED=true
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
```

**Notes:**

- Use `LOG_PRETTY=true` for readable logs during development
- `SWAGGER_ENABLED=true` to access Swagger UI at `/api/docs`
- Secrets can be simple values (not production-grade)

### Staging

**File:** `.env.staging` (deployment secrets manager, not committed)

```env
NODE_ENV=production
APP_PORT=3002
DATABASE_URL=postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=require
REDIS_URL=redis://:staging_password@staging-redis:6379
BETTER_AUTH_SECRET=<generate with openssl rand -base64 32>
AGENT_SECRET=<generate with openssl rand -base64 24>
API_SECRET=<generate with openssl rand -base64 48>
LOG_LEVEL=info
LOG_PRETTY=false
SWAGGER_ENABLED=false
CORS_ORIGINS=https://staging.restomarket.com
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/STAGING/WEBHOOK
SUPABASE_PROJECT_REF=staging_project_ref
```

**Notes:**

- Use production-grade secrets (generated with OpenSSL)
- `SWAGGER_ENABLED=false` in staging (unless internal)
- Configure Slack alerts for staging monitoring

### Production

**File:** `.env.production` (deployment secrets manager, never committed)

```env
NODE_ENV=production
APP_PORT=3002
DATABASE_URL=postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=require
DATABASE_DIRECT_URL=postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require
REDIS_URL=rediss://:prod_password@prod-redis:6380
BETTER_AUTH_SECRET=<ROTATE EVERY 90 DAYS>
AGENT_SECRET=<ROTATE EVERY 90 DAYS>
API_SECRET=<ROTATE EVERY 90 DAYS>
LOG_LEVEL=warn
LOG_PRETTY=false
SWAGGER_ENABLED=false
CORS_ORIGINS=https://app.restomarket.com
RATE_LIMIT_TTL=60
RATE_LIMIT_MAX=100
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/PRODUCTION/WEBHOOK
DATABASE_POOL_MAX=20
BULLMQ_CONCURRENCY=10
SUPABASE_PROJECT_REF=prod_project_ref
```

**Notes:**

- All secrets must be generated with cryptographically secure methods
- `LOG_LEVEL=warn` to reduce log volume
- `SWAGGER_ENABLED=false` — never expose Swagger in production
- Use secrets manager (AWS Secrets Manager, Vault, etc.)
- Enable TLS for Redis (`rediss://`)

---

## Security Best Practices

### 1. Never Commit Secrets

✅ **DO:**

- Use `.env` files locally (in `.gitignore`)
- Use `.env.example` with dummy values
- Store production secrets in a secrets manager

❌ **DON'T:**

- Commit `.env`, `.env.local`, `.env.production` to Git
- Hardcode secrets in source code
- Share secrets via Slack, email, or messaging apps

### 2. Use Strong Secrets

✅ **DO:**

- Generate with `openssl rand -base64 <bytes>`
- Use at least 32 bytes for authentication secrets
- Use unique secrets per environment

❌ **DON'T:**

- Use weak passwords like `password`, `123456`, `changeme`
- Reuse secrets across environments
- Use predictable patterns

### 3. Rotate Secrets Regularly

✅ **DO:**

- Rotate production secrets every 90 days
- Document rotation dates
- Test rotation process in staging first

❌ **DON'T:**

- Use the same secret for years
- Rotate without coordination (agents, frontend, etc.)
- Skip rotation after incidents

### 4. Limit Secret Access

✅ **DO:**

- Use role-based access control (RBAC)
- Grant access on a need-to-know basis
- Audit secret access logs

❌ **DON'T:**

- Share production secrets with entire team
- Store secrets in shared documents
- Use the same secrets across dev/staging/production

### 5. Validate Environment Variables

✅ **DO:**

- Use Zod validation schema (already implemented)
- Fail fast on startup if required vars are missing
- Log masked values (never full secrets)

❌ **DON'T:**

- Allow app to start with invalid config
- Log full secret values
- Rely on runtime checks

### 6. Check for Leaked Secrets

Run the secrets checker before every commit:

```bash
bash scripts/check-secrets.sh
```

Add to pre-commit hook:

```bash
# .husky/pre-commit
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

pnpm lint-staged
bash scripts/check-secrets.sh || exit 1
```

---

## Troubleshooting

### Issue: "Environment validation failed"

**Error:**

```
❌ Environment validation failed:
  - DATABASE_URL: Required
```

**Solution:**

- Copy `.env.example` to `.env`
- Fill in the required variable
- Restart the application

### Issue: "Better Auth secret must be at least 32 characters"

**Error:**

```
❌ Environment validation failed:
  - BETTER_AUTH_SECRET: String must contain at least 32 character(s)
```

**Solution:**

```bash
openssl rand -base64 32
# Copy output to .env
```

### Issue: "Agent secret not configured"

**Error:**

```
BusinessException: AGENT_SECRET_NOT_CONFIGURED
```

**Solution:**

- Set `AGENT_SECRET` in `.env` (development)
- Use `openssl rand -base64 24` to generate
- Restart the API

### Issue: Secrets leaked in Git history

**Solution:**

1. **Rotate the compromised secret immediately**
2. **Remove from Git history:**

```bash
# Use git-filter-repo (recommended) or BFG Repo-Cleaner
git filter-repo --path .env --invert-paths --force

# Force push (DANGEROUS - coordinate with team)
git push origin --force --all
```

3. **Update secrets in all environments**
4. **Notify security team**

### Issue: Redis connection fails

**Error:**

```
Error: connect ECONNREFUSED 127.0.0.1:6379
```

**Solution:**

- Ensure Redis is running: `docker compose up -d redis`
- Check `REDIS_URL` in `.env`
- Verify Redis is accessible: `redis-cli ping`

### Issue: Database SSL error

**Error:**

```
Error: self-signed certificate in certificate chain
```

**Solution:**

- Set `DATABASE_SSL=true` for Supabase
- Or add `?sslmode=require` to `DATABASE_URL`

---

## Additional Resources

- [Zod Documentation](https://zod.dev/) — Environment validation
- [NestJS Config Module](https://docs.nestjs.com/techniques/configuration) — Configuration management
- [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html) — Security best practices
- [12-Factor App: Config](https://12factor.net/config) — Environment variable patterns

---

## Checklist for New Developers

- [ ] Clone the repository
- [ ] Run `pnpm install`
- [ ] Copy `apps/api/.env.example` to `apps/api/.env`
- [ ] Generate secrets with `openssl rand -base64 32`
- [ ] Configure `DATABASE_URL` with local or Supabase connection
- [ ] Configure `REDIS_URL` (default: `redis://localhost:6379`)
- [ ] Start Docker services: `docker compose up -d`
- [ ] Run migrations: `pnpm db:migrate`
- [ ] Start development: `pnpm dev`
- [ ] Verify Swagger UI at `http://localhost:3002/api/docs`
- [ ] Run secrets checker: `bash scripts/check-secrets.sh`

---

**Last Updated:** 2026-02-12
**Maintained By:** DevOps Team
**Questions?** Open an issue or contact security@restomarket.com
