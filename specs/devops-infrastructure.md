# DevOps Infrastructure - Feature Specification

## Overview

Implement production-grade DevOps infrastructure for a Turborepo monorepo with emphasis on rollback capability, secrets management, CI/CD gatekeeping, and zero-downtime deployments. This infrastructure will support two environments: **development** and **staging**.

## Business Context

**Problem:** Currently, the application has no rollback capability, secrets are potentially exposed, deployments are not gated by quality checks, and there's no health monitoring or zero-downtime deployment strategy.

**Risk:** If production breaks, recovery is impossible. Security incidents from leaked secrets are imminent. Poor code can reach production.

**Impact:** This implementation provides production safety, security hardening, quality control, and operational reliability.

---

## Priority 0 Requirements (P0 - Must Have)

### 1. Rollback Capability

**Goal:** Enable instant recovery from production failures

**Requirements:**

- Docker images must be tagged with Git SHA
- Retain last 3-5 Docker images per service
- One-command rollback capability
- Image tags must be immutable and traceable to specific commits

**Acceptance Criteria:**

- [ ] Docker images tagged with format: `<service>:<git-sha>`
- [ ] Docker images also tagged with semantic versions: `<service>:latest`, `<service>:v1.2.3`
- [ ] Image retention policy configured (keep 5 most recent images)
- [ ] Rollback script that can deploy any previous image by SHA
- [ ] Documentation for rollback procedure
- [ ] Tested rollback in staging environment

**Technical Implementation:**

```bash
# Example rollback command
docker pull registry.digitalocean.com/my-registry/api:abc1234
docker-compose up -d
```

---

### 2. Secrets Management

**Goal:** Eliminate secret exposure in code, containers, and logs

**Requirements:**

- No secrets in `.env` files committed to repository
- Secrets stored in platform-native secret managers:
  - GitHub Secrets for CI/CD
  - DigitalOcean App Platform / Droplet environment variables for runtime
  - Vercel Environment Variables for web apps
- Secrets must never appear in Docker images
- Secrets must be redacted from all logs
- Rotation strategy for critical secrets (database, API keys)

**Acceptance Criteria:**

- [ ] All `.env` files removed from git history (if present)
- [ ] `.env.example` files created with dummy values
- [ ] GitHub Actions configured to use GitHub Secrets
- [ ] DigitalOcean Droplets configured with environment variables
- [ ] Vercel environment variables configured per environment
- [ ] Dockerfile does not contain hardcoded secrets
- [ ] Application logs redact sensitive values
- [ ] Secret rotation documented in runbook
- [ ] Pre-commit hook to prevent accidental secret commits

**Prohibited:**

- ❌ Secrets in repository files
- ❌ Secrets in Docker images (Dockerfile, image layers)
- ❌ Secrets in application logs
- ❌ Secrets in CI/CD logs

---

### 3. CI as Quality Gatekeeper

**Goal:** Block deployments that fail quality checks

**Requirements:**

- CI pipeline must run on all pull requests and pushes
- Pipeline must include: lint, test, build, security scan
- Failed checks must block deployment
- Monorepo-aware: only affected packages tested
- Fast feedback (<10 minutes for typical PR)

**Acceptance Criteria:**

- [ ] GitHub Actions workflow configured for CI/CD
- [ ] Lint step runs with `turbo lint --filter=...[origin/main]`
- [ ] Test step runs with `turbo test --filter=...[origin/main]`
- [ ] Build step runs with `turbo build --filter=...[origin/main]`
- [ ] Security scanning integrated (Snyk or Trivy)
- [ ] Branch protection rules require CI to pass
- [ ] Deployment jobs depend on successful CI jobs
- [ ] Cache configuration for fast turbo builds
- [ ] Pipeline fails fast (stops on first error)

**Turborepo Filters:**

```bash
# Only lint/test/build changed packages and dependents
turbo run lint test build --filter=...[origin/main]
```

---

### 4. Health Checks + Zero-Downtime Deployment

**Goal:** Ensure service availability during deployments

**Requirements:**

- Health check endpoint in all services
- Container health checks configured
- Blue-green or rolling deployment strategy
- New container verified before old container stops
- Load balancer health checks configured
- Graceful shutdown handling

**Acceptance Criteria:**

- [ ] `/health` endpoint implemented in API (NestJS)
- [ ] Health endpoint returns 200 with uptime, database status, Redis status
- [ ] Docker health check configured in Dockerfile
- [ ] Docker Compose health checks configured
- [ ] Deployment script implements blue-green strategy
- [ ] Load balancer configured with health checks
- [ ] Graceful shutdown with SIGTERM handling
- [ ] Zero-downtime deployment tested in staging
- [ ] Rollback maintains zero-downtime

**Health Check Response:**

```json
{
  "status": "healthy",
  "uptime": 3600,
  "timestamp": "2025-01-29T12:00:00Z",
  "services": {
    "database": "connected",
    "redis": "connected"
  }
}
```

---

## Infrastructure as Code (IaC)

### Directory Structure

```
infrastructure/
├── terraform/
│   ├── modules/
│   │   ├── api-cluster/
│   │   ├── database/
│   │   ├── networking/
│   │   └── monitoring/
│   ├── environments/
│   │   ├── dev/
│   │   │   ├── main.tf
│   │   │   ├── variables.tf
│   │   │   └── terraform.tfvars
│   │   └── staging/
│   │       ├── main.tf
│   │       ├── variables.tf
│   │       └── terraform.tfvars
│   └── scripts/
│       ├── init.sh
│       └── deploy.sh
├── ansible/
│   ├── playbooks/
│   │   ├── setup-api.yml
│   │   ├── update-api.yml
│   │   └── backup.yml
│   └── inventory/
│       ├── dev.yml
│       └── staging.yml
└── docker/
    ├── api/
    │   └── Dockerfile
    └── docker-compose.yml
```

### Terraform Requirements

**Resources to Create:**

- VPC with private networking
- Droplets (API servers) with auto-scaling groups
- Load Balancer with SSL and health checks
- Managed PostgreSQL database (2 nodes for staging, HA for prod)
- Managed Redis cache
- Container Registry (DigitalOcean Container Registry)
- Spaces bucket for backups
- Firewall rules (SSH from admin IPs only, HTTP/HTTPS from LB only)
- Monitoring alerts (CPU, memory, disk)

**Acceptance Criteria:**

- [ ] Terraform modules created for each resource type
- [ ] Environment-specific configurations (dev, staging)
- [ ] State stored remotely (DigitalOcean Spaces or S3)
- [ ] State locking configured
- [ ] Terraform plan shows no destructive changes on re-run
- [ ] All resources tagged with environment and project
- [ ] Output variables for connection strings
- [ ] Terraform documentation in README

---

## GitHub Actions CI/CD Pipeline

### Workflow Jobs

**1. Code Quality Job**

- Checkout code
- Setup pnpm and Node.js
- Install dependencies (with cache)
- Run lint: `pnpm lint`
- Run format check: `pnpm format:check`
- Run type check: `pnpm type-check`
- Security scan with Snyk
- Dependency audit
- SonarCloud analysis (optional)

**2. Test Job**

- Run after code-quality
- Setup services (PostgreSQL, Redis) via GitHub service containers
- Run unit tests with coverage
- Run integration tests
- Run E2E tests
- Upload coverage to Codecov
- Fail if coverage below threshold

**3. Build Job**

- Run after test
- Build all packages: `pnpm build`
- Upload build artifacts

**4. Docker Build Job**

- Run after build, only on push events
- Build Docker images for each app
- Tag with Git SHA and branch name
- Push to container registry
- Run Trivy security scan on images
- Upload scan results

**5. Deploy Staging Job**

- Run after docker-build, only on `develop` branch
- Deploy API to DigitalOcean Droplet via SSH
- Deploy web to Vercel preview
- Run smoke tests
- Notify on Slack

**6. Deploy Production Job**

- Run after docker-build, only on `main` branch
- Require manual approval (GitHub environment protection)
- Backup database before deployment
- Deploy with blue-green strategy
- Run production smoke tests
- Create Sentry release
- Notify on Slack

**Acceptance Criteria:**

- [ ] Complete workflow file created: `.github/workflows/ci-cd.yml`
- [ ] All jobs configured with proper dependencies
- [ ] Environment secrets configured in GitHub
- [ ] Branch protection rules set for main and develop
- [ ] Docker image tagging with SHA implemented
- [ ] Zero-downtime deployment script tested
- [ ] Rollback procedure documented
- [ ] Monitoring and alerting configured

---

## Docker Configuration

### Multi-Stage Dockerfile for API

**Requirements:**

- Use multi-stage builds for optimization
- Base image: Node.js 18 Alpine
- Install only production dependencies in final stage
- Non-root user for security
- Health check configured
- Optimized layer caching

**Acceptance Criteria:**

- [ ] Dockerfile uses multi-stage build
- [ ] Builder stage compiles TypeScript
- [ ] Production stage contains only runtime files
- [ ] Image size < 200MB
- [ ] Runs as non-root user
- [ ] HEALTHCHECK instruction configured
- [ ] .dockerignore file excludes unnecessary files
- [ ] Build time < 5 minutes

### Docker Compose for Local Development

**Requirements:**

- Services: API, PostgreSQL, Redis, Adminer
- Volume mounts for hot reload
- Environment variables from .env files
- Health checks for all services
- Network isolation

**Acceptance Criteria:**

- [ ] docker-compose.yml for local dev environment
- [ ] docker-compose.staging.yml for staging-like local testing
- [ ] All services start with `docker-compose up`
- [ ] API accessible at localhost:3001
- [ ] Database migrations run automatically
- [ ] Hot reload working for API
- [ ] Named volumes for data persistence

---

## Environments

### Development Environment

- **Purpose:** Local development and testing
- **Infrastructure:** Docker Compose on developer machines
- **Database:** Local PostgreSQL container
- **Redis:** Local Redis container
- **Secrets:** `.env.development` (not committed)
- **URL:** http://localhost:3001

### Staging Environment

- **Purpose:** Pre-production testing, QA validation
- **Infrastructure:** DigitalOcean Droplet(s) + Managed DB
- **Database:** DigitalOcean Managed PostgreSQL (single node)
- **Redis:** DigitalOcean Managed Redis
- **Secrets:** DigitalOcean environment variables
- **URL:** https://staging-api.example.com
- **Deployment:** Automatic on push to `develop` branch
- **Monitoring:** Basic DigitalOcean monitoring

---

## Security Requirements

### Container Security

- [ ] Non-root user in Docker containers
- [ ] Minimal base images (Alpine or Distroless)
- [ ] No secrets in image layers
- [ ] Regular vulnerability scanning (Trivy)
- [ ] Image signing (optional for P1)

### Network Security

- [ ] VPC with private networking
- [ ] Firewall rules: SSH from admin IPs only
- [ ] Load balancer terminates SSL
- [ ] Internal services not exposed publicly
- [ ] Database accessible only from app servers

### Secrets Security

- [ ] Secrets rotation every 90 days
- [ ] Principle of least privilege for service accounts
- [ ] Audit logs for secret access
- [ ] Encrypted at rest and in transit

---

## Monitoring & Observability

### Health Checks

- [ ] Application health endpoint: `/health`
- [ ] Docker health checks
- [ ] Load balancer health checks
- [ ] Database connection monitoring

### Alerts

- [ ] CPU usage > 80% for 5 minutes
- [ ] Memory usage > 85% for 5 minutes
- [ ] Disk usage > 90%
- [ ] Failed health checks
- [ ] Deployment failures

### Logging

- [ ] Structured JSON logging
- [ ] Log levels: ERROR, WARN, INFO, DEBUG
- [ ] Request ID tracking
- [ ] Centralized log aggregation (optional for P1)

---

## Rollback Procedures

### Manual Rollback (One-Command)

```bash
# List recent images
docker images | grep api

# Pull previous version by SHA
docker pull registry.digitalocean.com/my-registry/api:abc1234

# Update docker-compose.yml or run directly
docker-compose up -d

# Verify health
curl https://staging-api.example.com/health
```

### Automated Rollback Script

```bash
#!/bin/bash
# scripts/rollback.sh
PREVIOUS_SHA=$1
docker pull registry.digitalocean.com/my-registry/api:$PREVIOUS_SHA
docker-compose up -d
```

**Acceptance Criteria:**

- [ ] Rollback script created and tested
- [ ] Documentation includes step-by-step rollback guide
- [ ] Rollback tested in staging (deploy → rollback → verify)
- [ ] Rollback time < 5 minutes

---

## Documentation Requirements

### Required Documentation

- [ ] `README.md` in `infrastructure/` with setup instructions
- [ ] Terraform module documentation
- [ ] Deployment runbook
- [ ] Rollback runbook
- [ ] Secrets management guide
- [ ] Monitoring and alerting guide
- [ ] Disaster recovery plan

### Architecture Diagrams

- [ ] Infrastructure topology diagram
- [ ] CI/CD pipeline flow diagram
- [ ] Deployment flow diagram
- [ ] Network security diagram

---

## Success Metrics

### Performance

- Build time: < 10 minutes for full pipeline
- Deployment time: < 5 minutes per environment
- Rollback time: < 2 minutes

### Reliability

- Zero-downtime deployments: 100%
- Successful rollbacks: 100%
- CI pipeline success rate: > 95%

### Security

- Secrets in repository: 0
- High-severity vulnerabilities: 0
- Security scan failures: 0
