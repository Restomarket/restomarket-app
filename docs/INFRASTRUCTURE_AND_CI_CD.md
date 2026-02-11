# RestoMarket Infrastructure & CI/CD Pipeline

This document describes the infrastructure, automation pipeline, and deployment architecture for the RestoMarket B2B Food Supply Platform.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Infrastructure (Terraform)](#infrastructure-terraform)
3. [CI/CD Pipeline](#cicd-pipeline)
4. [Docker Build Process](#docker-build-process)
5. [Deployment Flow](#deployment-flow)
6. [Secrets & Configuration](#secrets--configuration)
7. [Monitoring & Observability](#monitoring--observability)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           RESTOMARKET STAGING ARCHITECTURE                       │
└─────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐     ┌─────────────────────────────────────────────────────┐
│   GitHub         │     │              DigitalOcean Cloud                       │
│   Actions        │     │                                                      │
│                  │     │  ┌───────────────────────────────────────────────┐  │
│  • Push/PR       │     │  │  Load Balancer (157.245.21.33)                 │  │
│  • Code Quality  │     │  │  • HTTP:80 → API:3002                          │  │
│  • Test         │     │  │  • Health: /v1/health                           │  │
│  • Build        │     │  └───────────────────────────────────────────────┘  │
│  • Docker Build │     │           │                    │                      │
│  • Deploy       │     │           ▼                    ▼                      │
└────────┬────────┘     │  ┌──────────────┐     ┌──────────────┐                │
         │              │  │  api-1       │     │  api-2       │                │
         │              │  │  165.227.129.93│   │  161.35.21.86 │                │
         │              │  │  Docker       │     │  Docker       │                │
         │              │  │  NestJS API   │     │  NestJS API   │                │
         │              │  └──────────────┘     └──────────────┘                │
         │              │           │                    │                      │
         │              │           └────────┬───────────┘                      │
         │              │                    │                                   │
         │              │  ┌─────────────────▼────────────────────────────────┐  │
         │              │  │  Supabase (PostgreSQL) - External                 │  │
         │              │  │  • Pooler: port 6543 (runtime)                   │  │
         │              │  │  • Direct: port 5432 (migrations)                │  │
         │              │  └─────────────────────────────────────────────────┘  │
         │              │                                                       │
         │              │  Redis: Disabled (STAGING_REDIS_URL in secrets)       │
         └──────────────┴───────────────────────────────────────────────────────┘
```

### Key Components

| Component              | Technology                             | Purpose                                 |
| ---------------------- | -------------------------------------- | --------------------------------------- |
| **Compute**            | DigitalOcean Droplets (2× s-2vcpu-4gb) | API servers running NestJS              |
| **Load Balancer**      | DigitalOcean LB                        | Traffic distribution, health checks     |
| **Database**           | Supabase (PostgreSQL)                  | Managed PostgreSQL, Free tier           |
| **Cache**              | Redis (URL in secrets)                 | Session/caching (disabled in Terraform) |
| **Container Registry** | GitHub Container Registry (ghcr.io)    | Docker images                           |
| **CI/CD**              | GitHub Actions                         | Build, test, deploy automation          |

---

## Infrastructure (Terraform)

### Location

```
infrastructure/terraform/
├── environments/
│   └── staging/           # Staging environment
│       ├── main.tf        # Main infrastructure config
│       ├── variables.tf   # Variable definitions
│       ├── outputs.tf     # Outputs (IPs, URLs, etc.)
│       ├── supabase.tf    # Supabase documentation (no provider)
│       └── terraform.tfvars.example
├── modules/
│   ├── api-cluster/       # Droplet creation + cloud-init
│   ├── networking/       # VPC, firewall
│   └── redis/            # Redis (disabled)
└── scripts/
    └── init-backend.sh   # Remote state setup
```

### Staging Environment

**Provisioned Resources:**

1. **VPC** (`10.20.0.0/16`) – Private network for droplets
2. **API Cluster** – 2 droplets (api-1, api-2) with:
   - Ubuntu 22.04
   - Docker pre-installed (via cloud-init)
   - UFW firewall, fail2ban, security hardening
   - Timezone: Africa/Casablanca
3. **Load Balancer** – Public IP `157.245.21.33`:
   - HTTP:80 → API:3002
   - Health check: `/v1/health` every 10s
   - No sticky sessions (stateless API)
4. **Firewall** – Defense-in-depth:
   - SSH (22): Admin IPs + GitHub Actions IPs (from api.github.com/meta)
   - API (3002): **Only from Load Balancer** (not public)
   - VPC: Full internal traffic
5. **Monitoring Alerts** (optional): CPU >80%, Memory >85%, Disk >90%, Load >3

### Database: Supabase

- **Managed externally** at https://app.supabase.com
- **No Terraform provider** – Supabase is configured manually
- Connection strings stored in **GitHub Secrets**:
  - `STAGING_DATABASE_URL` – Pooler (port 6543) for runtime
  - `STAGING_DATABASE_DIRECT_URL` – Direct (port 5432) for migrations
- **Cost:** $0 (Free tier) vs ~$120/month for DigitalOcean managed DB

### Security Model

- **API port 3002** is NOT exposed on droplet public IPs
- **Access only via Load Balancer** (157.245.21.33)
- **SSH** restricted to admin IPs + GitHub Actions IP ranges
- **Migrations** run from CI runner (GitHub Actions) – staging DB must be reachable from GitHub (public or allowlisted IPs)

---

## CI/CD Pipeline

### Workflow File

`.github/workflows/ci-cd.yml`

### Triggers

| Event        | Branches          |
| ------------ | ----------------- |
| Push         | `main`, `develop` |
| Pull Request | `main`, `develop` |

### Concurrency

- Cancels in-progress runs for the same workflow + branch

### Job Dependencies

```
code-quality
    │
    ▼
test
    │
    ▼
validate-migrations
    │
    ▼
build
    │
    ▼
docker-build ────┬──► migrate-staging
    │            │
    │            └──► deploy-staging
    │                      │
    │                      ▼
    │                 verify-load-balancer
```

### Job Details

#### 1. `code-quality` (always)

| Step       | Action                                                 |
| ---------- | ------------------------------------------------------ |
| Checkout   | Full fetch for Turborepo                               |
| Setup      | pnpm, Node 24.13.0                                     |
| Lint       | `pnpm turbo lint type-check --filter=...[origin/base]` |
| Format     | `pnpm format:check`                                    |
| Audit      | `pnpm audit --audit-level=high` (continue-on-error)    |
| TruffleHog | Secret scan (verified only)                            |
| Trivy      | Filesystem vulnerability scan (CRITICAL/HIGH)          |

#### 2. `test` (needs: code-quality)

- **Services:** PostgreSQL 15, Redis 7
- **Steps:**
  - Unit tests: `pnpm turbo test`
  - Integration tests (if configured)
  - Setup DB schema: `pnpm db:migrate`
  - E2E tests: `pnpm --filter api test:e2e`
  - Coverage: `pnpm turbo test:cov`
  - Upload to Codecov (optional)

#### 3. `validate-migrations` (needs: test)

- Runs migrations on fresh DB
- Generates schema from code
- **Fails if** schema drift (committed migrations ≠ generated)

#### 4. `build` (needs: test, validate-migrations)

- `pnpm turbo build --summarize`
- Upload artifacts: `api-build`, `web-build`, `packages-build`

#### 5. `docker-build` (needs: build, **push only**)

- Builds Docker image from `apps/api/Dockerfile`
- Target: `production`
- Pushes to `ghcr.io/<owner>/restomarket-api`
- **Tags:** `sha-<short>`, `develop`, `latest` (if main)
- Uses GitHub Actions cache (type=gha)
- Trivy scan on image (non-blocking)

#### 6. `migrate-staging` (needs: docker-build, **push to develop only**)

- Runs `pnpm --filter api db:migrate`
- Uses `STAGING_DATABASE_DIRECT_URL` (direct connection for migrations)
- Runs from CI runner → staging DB must be reachable

#### 7. `deploy-staging` (needs: docker-build, migrate-staging, **push to develop only**)

- **Matrix:** 2 droplets (api-1, api-2)
- **Strategy:** `fail-fast: false` (deploy to both even if one fails)
- **Method:** SSH via `appleboy/ssh-action`
- **Deployment:** Blue-green (blue/green container names)
- **Rollback:** On failure, restarts previous stopped container
- **Slack:** Notifications on success/failure

#### 8. `verify-load-balancer` (needs: deploy-staging)

- Health check: `http://157.245.21.33/v1/health`
- Retries: 10 attempts, 3s delay
- Tests load distribution

### Required Secrets

| Secret                        | Purpose                           |
| ----------------------------- | --------------------------------- |
| `TURBO_TOKEN`                 | Turborepo remote cache            |
| `STAGING_DATABASE_URL`        | Pooler connection for API runtime |
| `STAGING_DATABASE_DIRECT_URL` | Direct connection for migrations  |
| `STAGING_USERNAME`            | SSH user for droplets             |
| `STAGING_SSH_KEY`             | SSH private key for deployment    |
| `STAGING_REDIS_URL`           | Redis connection (if used)        |
| `SLACK_WEBHOOK`               | Deployment notifications          |
| `CODECOV_TOKEN`               | Coverage upload (optional)        |

### Required Variables

| Variable     | Purpose                         |
| ------------ | ------------------------------- |
| `TURBO_TEAM` | Turborepo team for remote cache |

---

## Docker Build Process

### Dockerfile Location

`apps/api/Dockerfile`

### Multi-Stage Build

```
┌─────────────────────────────────────────────────────────────────┐
│ Stage 1: base                                                   │
│ • node:20-alpine (or NODE_VERSION)                               │
│ • pnpm, dumb-init, curl                                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Stage 2: dependencies                                            │
│ • Copy workspace config + package.json files                     │
│ • pnpm install --frozen-lockfile                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Stage 3: builder                                                 │
│ • Copy source (shared, api)                                       │
│ • pnpm turbo build --filter=@apps/api                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Stage 4: production-deploy                                       │
│ • pnpm deploy --prod --ignore-scripts /prod/api                  │
│ • Production deps only (pruned)                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Stage 5: production (final)                                      │
│ • Non-root user (nestjs:nodejs)                                   │
│ • dumb-init for signal handling                                  │
│ • HEALTHCHECK: curl /v1/health                                   │
│ • CMD: node dist/src/main.js                                     │
│ • EXPOSE 3002                                                    │
└─────────────────────────────────────────────────────────────────┘
```

### Build Arguments

| Arg            | Default | CI Override |
| -------------- | ------- | ----------- |
| `NODE_VERSION` | 20.18.1 | 24.13.0     |
| `PNPM_VERSION` | 9.10.0  | 9.10.0      |

### Security Features

- **Non-root user** (`nestjs:nodejs`, uid 1001)
- **dumb-init** for proper signal handling (SIGTERM, etc.)
- **Minimal production image** via `pnpm deploy`
- **Health check** built into image

### Image Tags

- `sha-<7-char>` – Always
- `develop` – Branch `develop`
- `latest` – Branch `main`

---

## Deployment Flow

### Blue-Green Deployment (per droplet)

```
1. Current: GREEN running → Deploy to BLUE
   OR
   Current: BLUE running → Deploy to GREEN
   OR
   First deploy → Deploy to GREEN

2. Pull image: ghcr.io/<owner>/restomarket-api:sha-<sha>

3. Stop & remove current container

4. Start new container: docker run -d \
     --name restomarket-api-{blue|green} \
     --restart unless-stopped \
     -p 3002:3002 \
     -e DATABASE_URL=... \
     -e REDIS_URL=... \
     -e CORS_ORIGINS=... \
     -e NODE_ENV=production \
     ...

5. Health check: curl http://localhost:3002/v1/health (12 attempts, 5s apart)

6. On failure: Stop new container, rollback (restart previous)

7. Cleanup: Remove old images (keep last 3)
```

### Environment Variables (Injected at Deploy)

| Variable       | Source                                                           |
| -------------- | ---------------------------------------------------------------- |
| `NODE_ENV`     | `production`                                                     |
| `DATABASE_URL` | `STAGING_DATABASE_URL`                                           |
| `DATABASE_SSL` | `true`                                                           |
| `REDIS_URL`    | `STAGING_REDIS_URL`                                              |
| `APP_PORT`     | `3002`                                                           |
| `CORS_ORIGINS` | `http://157.245.21.33,http://165.227.129.93,http://161.35.21.86` |
| `LOG_LEVEL`    | `info`                                                           |
| `API_PREFIX`   | `v1`                                                             |

### Deployment Conditions

| Condition                            | Deploy                         |
| ------------------------------------ | ------------------------------ |
| `github.event_name == 'push'`        | ✅                             |
| `github.ref == 'refs/heads/develop'` | ✅ Staging                     |
| `github.ref == 'refs/heads/main'`    | ❌ (Production not configured) |

---

## Secrets & Configuration

### GitHub Secrets

- **Repository:** Settings → Secrets and variables → Actions
- **Environment:** `staging` has its own protection rules

### Terraform Variables

- **Required:** `do_token`, `ssh_key_name`
- **Optional:** `admin_ips`, `ssl_certificate_name`, `alert_slack_webhook`, etc.
- **Example:** `terraform.tfvars.example`

See [SECRETS_MANAGEMENT.md](./SECRETS_MANAGEMENT.md) for details.

---

## Monitoring & Observability

### Load Balancer

- **URL:** http://157.245.21.33
- **Health:** http://157.245.21.33/v1/health
- **Check interval:** 10s
- **Unhealthy threshold:** 3

### DigitalOcean

- **CPU:** >80% for 5m → Alert
- **Memory:** >85% for 5m → Alert
- **Disk:** >90% for 5m → Alert
- **Load:** >3 for 5m → Alert
- **Alerts:** Email + Slack (if configured)

### Slack Notifications

- **Success:** Deployment success with commit link
- **Failure:** Deployment failure + rollback notice
- **Load Balancer:** Verification complete

---

## Quick Reference

### Commands

```bash
# Terraform
cd infrastructure/terraform/environments/staging
terraform init
terraform plan
terraform apply

# View outputs
terraform output load_balancer_ip
terraform output environment_summary
terraform output ssh_commands

# Local staging-like test
docker compose -f docker-compose.staging.yml up -d
```

### URLs

| Resource              | URL                            |
| --------------------- | ------------------------------ |
| Staging API           | http://157.245.21.33           |
| Health Check          | http://157.245.21.33/v1/health |
| API Docs (if enabled) | http://157.245.21.33/v1/docs   |
| Supabase              | https://app.supabase.com       |

### Droplet IPs (Hardcoded in CI)

| Droplet       | IP             |
| ------------- | -------------- |
| api-1         | 165.227.129.93 |
| api-2         | 161.35.21.86   |
| Load Balancer | 157.245.21.33  |

---

## Related Documentation

- [SECRETS_MANAGEMENT.md](./SECRETS_MANAGEMENT.md) – Secrets and environment variables
- [infrastructure/terraform/environments/staging/README.md](../infrastructure/terraform/environments/staging/README.md) – Terraform staging setup
- [infrastructure/terraform/environments/staging/supabase.tf](../infrastructure/terraform/environments/staging/supabase.tf) – Supabase configuration notes
- [CLAUDE.md](../CLAUDE.md) – Repository overview and development commands
