# Implementation Plan - DevOps Infrastructure

> **Mission:** Implement production-grade DevOps infrastructure with rollback capability, secrets management, CI/CD gatekeeping, and zero-downtime deployments for dev and staging environments.

---

## Task 1: Setup Infrastructure Directory Structure

**Category:** Setup
**Package:** root
**Status:** passing
**Priority:** high
**Risk Level:** low
**Estimated Iterations:** 1

**Description:**
Create the complete directory structure for infrastructure as code (Terraform, Ansible, Docker) following the specification.

**Acceptance Criteria:**

- [x] `infrastructure/` directory created at repository root
- [x] All subdirectories created as per spec
- [x] `.gitkeep` files added to empty directories (13 files)
- [x] README.md created in infrastructure/ with overview
- [x] Directory structure documented

**Completion Notes:**

- Completed on 2026-01-29
- Created complete directory structure with 20 subdirectories
- Added .gitkeep files to all empty directories
- Created comprehensive README.md with quick start guide, architecture overview, and troubleshooting
- All validation commands passed successfully

**Validation Commands:**

```bash
# Verify directory structure
tree infrastructure/
ls -la infrastructure/terraform/environments/dev
ls -la infrastructure/terraform/environments/staging
ls -la infrastructure/ansible/playbooks
ls -la infrastructure/docker
```

---

## Task 2: Create .env.example and Remove Secrets

**Category:** Security
**Package:** root
**Status:** passing
**Priority:** high
**Risk Level:** high
**Estimated Iterations:** 1

**Description:**
Remove any existing .env files from git history, create .env.example templates with dummy values, and update .gitignore to prevent future secret commits.

**Acceptance Criteria:**

- [x] All `.env` files added to `.gitignore` (including .env.development, .env.staging)
- [x] `.env.example` files created for each app/package with dummy values (root, api, web)
- [x] Existing .env files removed from git history (none were present - verified clean)
- [x] Pre-commit hook configured to detect secrets (.pre-commit-config.yaml with gitleaks)
- [x] Documentation updated with secrets management guidelines (docs/SECRETS_MANAGEMENT.md)

**Completion Notes:**

- Completed on 2026-01-29
- Enhanced .gitignore with additional .env patterns (.env.development, .env.staging, etc.)
- Created .env.example for root, apps/api (already existed), and apps/web
- Created .pre-commit-config.yaml with gitleaks and additional security checks
- Created .gitleaks.toml for customized secret detection rules
- Created comprehensive docs/SECRETS_MANAGEMENT.md with rotation procedures, incident response, and best practices
- No .env files were found in git history - repository is clean
- All validation commands passed successfully

**Validation Commands:**

```bash
# Verify .env files not tracked
git ls-files | grep -E "\.env$" || echo "No .env files tracked"

# Verify .gitignore contains .env
grep "\.env$" .gitignore

# Verify .env.example exists
ls -la apps/*/.env.example packages/*/.env.example || true
```

---

## Task 3: Create Multi-Stage Dockerfile for API

**Category:** Feature
**Package:** apps/api
**Status:** not started
**Priority:** high
**Risk Level:** medium
**Estimated Iterations:** 2

**Description:**
Create optimized multi-stage Dockerfile for NestJS API with security best practices, health checks, and layer caching optimization.

**Acceptance Criteria:**

- [ ] Multi-stage Dockerfile created in `apps/api/Dockerfile`
- [ ] Builder stage compiles TypeScript
- [ ] Production stage contains only runtime files
- [ ] Runs as non-root user (node user)
- [ ] HEALTHCHECK instruction configured
- [ ] .dockerignore created to exclude unnecessary files
- [ ] Image builds successfully
- [ ] Image size < 200MB
- [ ] Build time < 5 minutes

**Validation Commands:**

```bash
# Build Docker image
docker build -t api:test -f apps/api/Dockerfile .

# Check image size
docker images api:test --format "{{.Size}}"

# Verify non-root user
docker run --rm api:test whoami | grep -v root

# Test health check
docker run -d --name api-test api:test
sleep 10
docker inspect api-test --format='{{.State.Health.Status}}'
docker rm -f api-test
```

---

## Task 4: Implement /health Endpoint in API

**Category:** Feature
**Package:** apps/api
**Status:** not started
**Priority:** high
**Risk Level:** low
**Estimated Iterations:** 1

**Description:**
Create comprehensive health check endpoint in NestJS that returns service status, uptime, and dependency health (database, Redis).

**Acceptance Criteria:**

- [ ] `/health` GET endpoint created in API
- [ ] Returns 200 status code when healthy
- [ ] Response includes: status, uptime, timestamp, services (database, redis)
- [ ] Checks actual database connection
- [ ] Checks actual Redis connection
- [ ] Returns 503 if any dependency unhealthy
- [ ] Unit tests written for health endpoint
- [ ] Integration tests verify database/Redis checks

**Response Format:**

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

**Validation Commands:**

```bash
pnpm turbo lint --filter=api --fix
pnpm turbo test --filter=api
pnpm turbo type-check
pnpm turbo build --filter=api

# Integration test
pnpm --filter=api test:integration -- health
```

---

## Task 5: Create Docker Compose for Local Development

**Category:** Feature
**Package:** root
**Status:** not started
**Priority:** high
**Risk Level:** low
**Estimated Iterations:** 2

**Description:**
Create docker-compose.yml for local development with all services (API, PostgreSQL, Redis, Adminer) with hot reload support.

**Acceptance Criteria:**

- [ ] `docker-compose.yml` created at repository root
- [ ] Services: API, PostgreSQL 15, Redis 7, Adminer
- [ ] API service uses volume mounts for hot reload
- [ ] Environment variables loaded from .env.development
- [ ] Health checks configured for all services
- [ ] Named volumes for database and Redis persistence
- [ ] Network isolation with custom network
- [ ] API accessible at localhost:3001
- [ ] Adminer accessible at localhost:8080
- [ ] All services start successfully with `docker-compose up`

**Validation Commands:**

```bash
# Start all services
docker-compose up -d

# Verify all services running
docker-compose ps

# Test API health endpoint
curl http://localhost:3001/health

# Test database connection via Adminer
curl http://localhost:8080

# Check logs
docker-compose logs api

# Cleanup
docker-compose down
```

---

## Task 6: Create Docker Compose for Staging-like Testing

**Category:** Feature
**Package:** root
**Status:** not started
**Priority:** medium
**Risk Level:** low
**Estimated Iterations:** 1

**Description:**
Create docker-compose.staging.yml that mimics staging environment for local testing (production builds, no hot reload).

**Acceptance Criteria:**

- [ ] `docker-compose.staging.yml` created
- [ ] Uses production Docker image (not dev mode)
- [ ] Environment variables from .env.staging.example
- [ ] No volume mounts (tests actual image)
- [ ] Health checks configured
- [ ] Separate network from dev compose
- [ ] Documentation for usage

**Validation Commands:**

```bash
# Build production image
docker-compose -f docker-compose.staging.yml build

# Start staging-like environment
docker-compose -f docker-compose.staging.yml up -d

# Verify services
docker-compose -f docker-compose.staging.yml ps

# Test health
curl http://localhost:3001/health

# Cleanup
docker-compose -f docker-compose.staging.yml down
```

---

## Task 7: Create Terraform Module for Networking

**Category:** Infrastructure
**Package:** root
**Status:** not started
**Priority:** high
**Risk Level:** medium
**Estimated Iterations:** 2

**Description:**
Create reusable Terraform module for DigitalOcean VPC and networking resources.

**Acceptance Criteria:**

- [ ] Module created at `infrastructure/terraform/modules/networking/`
- [ ] VPC resource with configurable IP range
- [ ] Firewall resource with configurable rules
- [ ] Input variables defined in variables.tf
- [ ] Output variables for VPC ID and network details
- [ ] Module documentation in README.md
- [ ] Example usage documented

**Module Structure:**

```
modules/networking/
├── main.tf
├── variables.tf
├── outputs.tf
└── README.md
```

**Validation Commands:**

```bash
# Validate Terraform syntax
cd infrastructure/terraform/modules/networking
terraform init
terraform validate

# Format code
terraform fmt -check
```

---

## Task 8: Create Terraform Module for Database

**Category:** Infrastructure
**Package:** root
**Status:** not started
**Priority:** high
**Risk Level:** high
**Estimated Iterations:** 2

**Description:**
Create reusable Terraform module for DigitalOcean Managed PostgreSQL database with configurable node count and size.

**Acceptance Criteria:**

- [ ] Module created at `infrastructure/terraform/modules/database/`
- [ ] PostgreSQL cluster resource
- [ ] Configurable: version, size, node count, region
- [ ] Private networking (VPC) support
- [ ] Firewall rule for app server access
- [ ] Database user and database creation
- [ ] Output variables for connection string
- [ ] Module documentation

**Validation Commands:**

```bash
cd infrastructure/terraform/modules/database
terraform init
terraform validate
terraform fmt -check
```

---

## Task 9: Create Terraform Module for Redis Cache

**Category:** Infrastructure
**Package:** root
**Status:** not started
**Priority:** medium
**Risk Level:** medium
**Estimated Iterations:** 1

**Description:**
Create Terraform module for DigitalOcean Managed Redis cache.

**Acceptance Criteria:**

- [ ] Module created at `infrastructure/terraform/modules/redis/`
- [ ] Redis cluster resource
- [ ] Configurable: version, size, region
- [ ] Private networking support
- [ ] Output variables for connection string
- [ ] Module documentation

**Validation Commands:**

```bash
cd infrastructure/terraform/modules/redis
terraform init
terraform validate
terraform fmt -check
```

---

## Task 10: Create Terraform Module for API Droplets

**Category:** Infrastructure
**Package:** root
**Status:** not started
**Priority:** high
**Risk Level:** medium
**Estimated Iterations:** 2

**Description:**
Create Terraform module for DigitalOcean Droplets running the API with user-data for Docker setup.

**Acceptance Criteria:**

- [ ] Module created at `infrastructure/terraform/modules/api-cluster/`
- [ ] Droplet resource with configurable count
- [ ] SSH key configuration
- [ ] User-data script to install Docker and Docker Compose
- [ ] VPC networking
- [ ] Tags for environment and service
- [ ] Output variables for droplet IPs
- [ ] Module documentation

**Validation Commands:**

```bash
cd infrastructure/terraform/modules/api-cluster
terraform init
terraform validate
terraform fmt -check
```

---

## Task 11: Create Terraform Configuration for Dev Environment

**Category:** Infrastructure
**Package:** root
**Status:** not started
**Priority:** high
**Risk Level:** medium
**Estimated Iterations:** 2

**Description:**
Create Terraform configuration for dev environment using the modules created, with minimal resources for cost optimization.

**Acceptance Criteria:**

- [ ] Configuration created at `infrastructure/terraform/environments/dev/`
- [ ] main.tf uses networking, database, redis, api-cluster modules
- [ ] variables.tf defines environment-specific variables
- [ ] terraform.tfvars with dev-specific values (1 droplet, small DB)
- [ ] Remote state backend configured (DigitalOcean Spaces or S3)
- [ ] Provider configuration with version constraints
- [ ] Output values for connection strings and IPs
- [ ] README.md with setup and deployment instructions

**Validation Commands:**

```bash
cd infrastructure/terraform/environments/dev

# Initialize Terraform
terraform init

# Validate configuration
terraform validate

# Plan (dry run)
terraform plan

# Check formatting
terraform fmt -check -recursive
```

---

## Task 12: Create Terraform Configuration for Staging Environment

**Category:** Infrastructure
**Package:** root
**Status:** not started
**Priority:** high
**Risk Level:** medium
**Estimated Iterations:** 2

**Description:**
Create Terraform configuration for staging environment with production-like setup (2 API droplets, HA database).

**Acceptance Criteria:**

- [ ] Configuration created at `infrastructure/terraform/environments/staging/`
- [ ] main.tf uses all modules
- [ ] Load balancer configured with SSL and health checks
- [ ] variables.tf and terraform.tfvars for staging
- [ ] 2 API droplets for redundancy
- [ ] PostgreSQL with 2 nodes
- [ ] Firewall rules: SSH from admin IPs, HTTP/HTTPS from LB
- [ ] Monitoring alerts configured
- [ ] Remote state backend configured
- [ ] Output values documented

**Validation Commands:**

```bash
cd infrastructure/terraform/environments/staging
terraform init
terraform validate
terraform plan
terraform fmt -check -recursive
```

---

## Task 13: Create Load Balancer Configuration in Terraform

**Category:** Infrastructure
**Package:** root
**Status:** not started
**Priority:** high
**Risk Level:** medium
**Estimated Iterations:** 2

**Description:**
Add DigitalOcean Load Balancer to staging Terraform config with SSL, health checks, and forwarding rules.

**Acceptance Criteria:**

- [ ] Load balancer resource added to staging main.tf
- [ ] SSL certificate configured (managed by DigitalOcean or Let's Encrypt)
- [ ] Forwarding rule: HTTPS (443) → HTTP (3001)
- [ ] Health check configured for /health endpoint
- [ ] Sticky sessions disabled (stateless API)
- [ ] Droplets automatically registered
- [ ] Output variable for load balancer IP
- [ ] DNS instructions in README

**Validation Commands:**

```bash
cd infrastructure/terraform/environments/staging
terraform validate
terraform plan | grep digitalocean_loadbalancer
```

---

## Task 14: Create Terraform Backend Configuration Script

**Category:** Infrastructure
**Package:** root
**Status:** not started
**Priority:** high
**Risk Level:** low
**Estimated Iterations:** 1

**Description:**
Create initialization script to set up Terraform remote state backend (DigitalOcean Spaces or S3).

**Acceptance Criteria:**

- [ ] Script created at `infrastructure/terraform/scripts/init-backend.sh`
- [ ] Creates S3-compatible bucket (DigitalOcean Spaces)
- [ ] Configures bucket for state storage
- [ ] Enables versioning for state files
- [ ] Creates state lock table (if using DynamoDB)
- [ ] Script is idempotent
- [ ] Documentation in README

**Validation Commands:**

```bash
cd infrastructure/terraform/scripts
chmod +x init-backend.sh

# Dry run
bash -n init-backend.sh

# shellcheck
shellcheck init-backend.sh || echo "shellcheck not installed"
```

---

## Task 15: Create Ansible Playbook for Initial Server Setup

**Category:** Configuration Management
**Package:** root
**Status:** not started
**Priority:** medium
**Risk Level:** low
**Estimated Iterations:** 2

**Description:**
Create Ansible playbook to configure fresh droplets with Docker, security hardening, and monitoring.

**Acceptance Criteria:**

- [ ] Playbook created at `infrastructure/ansible/playbooks/setup-api.yml`
- [ ] Tasks: install Docker, Docker Compose, configure firewall (ufw)
- [ ] Create non-root deploy user
- [ ] Configure automatic security updates
- [ ] Install monitoring agent (if applicable)
- [ ] SSH hardening (disable root login, key-only auth)
- [ ] Playbook is idempotent
- [ ] Inventory files for dev and staging

**Validation Commands:**

```bash
cd infrastructure/ansible

# Syntax check
ansible-playbook playbooks/setup-api.yml --syntax-check

# Dry run
ansible-playbook playbooks/setup-api.yml --check -i inventory/dev.yml
```

---

## Task 16: Create Ansible Playbook for API Deployment

**Category:** Configuration Management
**Package:** root
**Status:** not started
**Priority:** medium
**Risk Level:** medium
**Estimated Iterations:** 2

**Description:**
Create Ansible playbook to deploy API updates with zero-downtime strategy.

**Acceptance Criteria:**

- [ ] Playbook created at `infrastructure/ansible/playbooks/update-api.yml`
- [ ] Tasks: pull new Docker image, run health check, update container
- [ ] Blue-green deployment logic
- [ ] Rollback capability if health check fails
- [ ] Environment-specific variables
- [ ] Playbook tested in dev environment

**Validation Commands:**

```bash
cd infrastructure/ansible
ansible-playbook playbooks/update-api.yml --syntax-check
ansible-playbook playbooks/update-api.yml --check -i inventory/dev.yml
```

---

## Task 17: Create GitHub Actions Workflow - Code Quality

**Category:** CI/CD
**Package:** root
**Status:** not started
**Priority:** high
**Risk Level:** low
**Estimated Iterations:** 2

**Description:**
Create GitHub Actions workflow job for code quality checks (lint, format, type-check, security scan).

**Acceptance Criteria:**

- [ ] Workflow file created: `.github/workflows/ci-cd.yml`
- [ ] Code quality job configured
- [ ] Steps: checkout, setup pnpm, install deps (with cache), lint, format check, type-check
- [ ] Snyk security scan integrated (or Trivy)
- [ ] Dependency audit step
- [ ] Job runs on pull requests and pushes
- [ ] Uses Turborepo filters: `--filter=...[origin/main]`
- [ ] Caching configured for pnpm and turbo

**Validation Commands:**

```bash
# Validate workflow syntax
cat .github/workflows/ci-cd.yml | grep -q "code-quality"

# Test locally with act (if installed)
act pull_request --job code-quality || echo "act not installed"
```

---

## Task 18: Create GitHub Actions Workflow - Test Job

**Category:** CI/CD
**Package:** root
**Status:** not started
**Priority:** high
**Risk Level:** low
**Estimated Iterations:** 2

**Description:**
Create test job in GitHub Actions with service containers for PostgreSQL and Redis, running unit, integration, and E2E tests.

**Acceptance Criteria:**

- [ ] Test job added to ci-cd.yml workflow
- [ ] Runs after code-quality job (depends on)
- [ ] Service containers: PostgreSQL 15, Redis 7
- [ ] Health checks for service containers
- [ ] Steps: install deps, run unit tests, integration tests, E2E tests
- [ ] Coverage report generated
- [ ] Coverage uploaded to Codecov
- [ ] Job fails if coverage below threshold (80%)
- [ ] Uses Turborepo filters

**Validation Commands:**

```bash
# Verify test job in workflow
grep -A 20 "test:" .github/workflows/ci-cd.yml

# Check service containers configured
grep "services:" .github/workflows/ci-cd.yml
```

---

## Task 19: Create GitHub Actions Workflow - Build Job

**Category:** CI/CD
**Package:** root
**Status:** not started
**Priority:** high
**Risk Level:** low
**Estimated Iterations:** 1

**Description:**
Create build job that compiles all packages and uploads artifacts.

**Acceptance Criteria:**

- [ ] Build job added to workflow
- [ ] Runs after test job (depends on)
- [ ] Steps: install deps, build all packages
- [ ] Command: `pnpm turbo build`
- [ ] Build artifacts uploaded for later jobs
- [ ] Uses Turborepo caching
- [ ] Job completes in < 10 minutes

**Validation Commands:**

```bash
# Verify build job
grep -A 15 "build:" .github/workflows/ci-cd.yml

# Test build locally
pnpm turbo build
```

---

## Task 20: Create GitHub Actions Workflow - Docker Build Job

**Category:** CI/CD
**Package:** root
**Status:** not started
**Priority:** high
**Risk Level:** medium
**Estimated Iterations:** 3

**Description:**
Create job to build Docker images, tag with Git SHA, push to registry, and scan for vulnerabilities.

**Acceptance Criteria:**

- [ ] Docker build job added to workflow
- [ ] Runs after build job, only on push events (not PRs)
- [ ] Uses Docker Buildx for efficient builds
- [ ] Logs into container registry (GHCR or DigitalOcean)
- [ ] Builds image with multiple tags: `<sha>`, `<branch>-<sha>`, `latest`
- [ ] Pushes to registry
- [ ] Runs Trivy vulnerability scan
- [ ] Uploads scan results to GitHub Security
- [ ] Fails on high/critical vulnerabilities
- [ ] Uses layer caching for fast builds

**Image Tags:**

```
ghcr.io/org/api:abc1234
ghcr.io/org/api:main-abc1234
ghcr.io/org/api:latest
```

**Validation Commands:**

```bash
# Verify docker build job
grep -A 30 "docker-build:" .github/workflows/ci-cd.yml

# Test Docker build locally
docker build -t api:test -f apps/api/Dockerfile .
```

---

## Task 21: Create GitHub Actions Workflow - Deploy Staging Job

**Category:** CI/CD
**Package:** root
**Status:** not started
**Priority:** high
**Risk Level:** medium
**Estimated Iterations:** 3

**Description:**
Create deployment job for staging environment with SSH deployment, health checks, and notifications.

**Acceptance Criteria:**

- [ ] Deploy staging job added to workflow
- [ ] Runs after docker-build, only on `develop` branch
- [ ] Uses GitHub environment: staging
- [ ] SSH deployment to DigitalOcean droplet
- [ ] Steps: SSH in, pull new image, update containers with zero-downtime
- [ ] Health check after deployment
- [ ] Rollback on failed health check
- [ ] Smoke tests after deployment
- [ ] Slack notification on completion
- [ ] Environment secrets configured in GitHub

**Validation Commands:**

```bash
# Verify deploy job
grep -A 40 "deploy-staging:" .github/workflows/ci-cd.yml

# Check SSH action configured
grep "appleboy/ssh-action" .github/workflows/ci-cd.yml
```

---

## Task 22: Create Deployment Script for Zero-Downtime Deploy

**Category:** Deployment
**Package:** root
**Status:** not started
**Priority:** high
**Risk Level:** high
**Estimated Iterations:** 2

**Description:**
Create bash script for blue-green deployment on droplets, ensuring zero-downtime with health checks.

**Acceptance Criteria:**

- [ ] Script created at `infrastructure/scripts/deploy.sh`
- [ ] Accepts parameters: image tag, environment
- [ ] Pulls new Docker image
- [ ] Starts new container (blue)
- [ ] Waits for health check to pass
- [ ] Stops old container (green)
- [ ] Renames containers for next deployment
- [ ] Rolls back on failed health check
- [ ] Logs each step
- [ ] Script tested in staging

**Deployment Flow:**

```
1. Pull new image
2. Start api-blue container
3. Wait 10s + health check
4. If healthy: stop api-green, rename blue→green
5. If unhealthy: stop api-blue, exit 1
6. Cleanup old images
```

**Validation Commands:**

```bash
cd infrastructure/scripts
chmod +x deploy.sh
bash -n deploy.sh  # Syntax check
shellcheck deploy.sh || echo "shellcheck not installed"

# Test in staging (manual step)
# ./deploy.sh api:abc1234 staging
```

---

## Task 23: Create Rollback Script

**Category:** Deployment
**Package:** root
**Status:** not started
**Priority:** high
**Risk Level:** medium
**Estimated Iterations:** 1

**Description:**
Create script for one-command rollback to previous Docker image version.

**Acceptance Criteria:**

- [ ] Script created at `infrastructure/scripts/rollback.sh`
- [ ] Accepts parameter: Git SHA or image tag
- [ ] Lists recent images if no parameter provided
- [ ] Pulls specified image
- [ ] Deploys using zero-downtime strategy (calls deploy.sh)
- [ ] Verifies rollback with health check
- [ ] Logs rollback action
- [ ] Documentation for usage

**Usage:**

```bash
# List recent deployments
./rollback.sh --list

# Rollback to specific version
./rollback.sh abc1234
```

**Validation Commands:**

```bash
cd infrastructure/scripts
chmod +x rollback.sh
bash -n rollback.sh
shellcheck rollback.sh || echo "shellcheck not installed"
```

---

## Task 24: Configure Image Retention Policy

**Category:** Deployment
**Package:** root
**Status:** not started
**Priority:** medium
**Risk Level:** low
**Estimated Iterations:** 1

**Description:**
Create script or GitHub Action to automatically clean up old Docker images, keeping only the 5 most recent.

**Acceptance Criteria:**

- [ ] Cleanup script created at `infrastructure/scripts/cleanup-images.sh`
- [ ] Lists images for a given repository
- [ ] Keeps 5 most recent images (by timestamp)
- [ ] Deletes older images
- [ ] Preserves images tagged with `latest`, `stable`, semantic versions
- [ ] Runs weekly via cron or GitHub Actions scheduled workflow
- [ ] Logs deleted images

**Validation Commands:**

```bash
cd infrastructure/scripts
chmod +x cleanup-images.sh
bash -n cleanup-images.sh
shellcheck cleanup-images.sh || echo "shellcheck not installed"
```

---

## Task 25: Setup Secrets in GitHub Actions

**Category:** Security
**Package:** root
**Status:** not started
**Priority:** high
**Risk Level:** high
**Estimated Iterations:** 1

**Description:**
Configure all required secrets in GitHub repository settings for CI/CD pipeline.

**Acceptance Criteria:**

- [ ] GitHub repository secrets configured
- [ ] Secrets for staging environment:
  - `STAGING_HOST` - Droplet IP
  - `STAGING_USERNAME` - SSH user
  - `STAGING_SSH_KEY` - Private SSH key
  - `DO_REGISTRY_TOKEN` - DigitalOcean registry token
  - `DATABASE_URL` - Staging DB connection string
  - `REDIS_URL` - Staging Redis connection string
- [ ] Secrets for registries:
  - `GITHUB_TOKEN` (auto-provided)
  - `SNYK_TOKEN` (if using Snyk)
- [ ] Secrets for notifications:
  - `SLACK_WEBHOOK` - Slack webhook URL
- [ ] Documentation of all required secrets in README

**Validation:**
This is a manual configuration task. Validation:

- [ ] All secrets listed in Settings > Secrets and variables > Actions
- [ ] Secrets match the workflow file references
- [ ] Test deployment runs successfully without secret errors

---

## Task 26: Configure Branch Protection Rules

**Category:** CI/CD
**Package:** root
**Status:** not started
**Priority:** high
**Risk Level:** low
**Estimated Iterations:** 1

**Description:**
Set up branch protection rules on `main` and `develop` branches to require CI checks before merging.

**Acceptance Criteria:**

- [ ] Branch protection enabled for `main` branch
- [ ] Branch protection enabled for `develop` branch
- [ ] Required status checks: code-quality, test, build
- [ ] Require pull request before merging
- [ ] Require at least 1 approval for main
- [ ] Dismiss stale reviews when new commits pushed
- [ ] Require linear history (optional)
- [ ] Do not allow force pushes
- [ ] Do not allow deletions

**Validation:**
Manual configuration in GitHub Settings > Branches

- [ ] Rules visible in Settings > Branches
- [ ] Test by creating PR - verify checks must pass

---

## Task 27: Create Pre-commit Hook for Secret Detection

**Category:** Security
**Package:** root
**Status:** not started
**Priority:** high
**Risk Level:** low
**Estimated Iterations:** 1

**Description:**
Set up pre-commit hook using `gitleaks` or `detect-secrets` to prevent committing secrets.

**Acceptance Criteria:**

- [ ] `.pre-commit-config.yaml` created
- [ ] Secret detection configured (gitleaks or detect-secrets)
- [ ] Hook runs on every commit
- [ ] Blocks commit if secrets detected
- [ ] Instructions in README for developers to install pre-commit
- [ ] CI also runs secret scan (redundancy)
- [ ] False positives documented

**Validation Commands:**

```bash
# Install pre-commit
pip install pre-commit

# Install hooks
pre-commit install

# Test hook
pre-commit run --all-files

# Test by adding fake secret
echo "API_KEY=sk-1234567890abcdef" > test.env
git add test.env
git commit -m "test" # Should fail
```

---

## Task 28: Create Monitoring Alert Configuration

**Category:** Monitoring
**Package:** root
**Status:** not started
**Priority:** medium
**Risk Level:** low
**Estimated Iterations:** 1

**Description:**
Add monitoring alerts to staging Terraform config for CPU, memory, disk, and health check failures.

**Acceptance Criteria:**

- [ ] Terraform resource for DigitalOcean monitoring alerts
- [ ] Alert: CPU usage > 80% for 5 minutes
- [ ] Alert: Memory usage > 85% for 5 minutes
- [ ] Alert: Disk usage > 90%
- [ ] Alert: Health check failures
- [ ] Email notifications configured
- [ ] Slack notifications configured (optional)
- [ ] Alerts tested in staging

**Validation Commands:**

```bash
cd infrastructure/terraform/environments/staging
terraform validate
terraform plan | grep digitalocean_monitor_alert
```

---

## Task 29: Create Documentation - Deployment Runbook

**Category:** Documentation
**Package:** root
**Status:** not started
**Priority:** medium
**Risk Level:** low
**Estimated Iterations:** 1

**Description:**
Write comprehensive deployment runbook with step-by-step procedures for deployments, rollbacks, and incident response.

**Acceptance Criteria:**

- [ ] Document created at `infrastructure/docs/deployment-runbook.md`
- [ ] Sections: Normal deployment, Rollback, Emergency procedures
- [ ] Step-by-step instructions with commands
- [ ] Troubleshooting section
- [ ] Contact information for escalations
- [ ] Links to monitoring dashboards
- [ ] Runbook tested by following it for a staging deployment

**Validation Commands:**

```bash
# Verify document exists and is complete
cat infrastructure/docs/deployment-runbook.md | grep -i rollback
cat infrastructure/docs/deployment-runbook.md | grep -i emergency
```

---

## Task 30: Create Documentation - Secrets Management Guide

**Category:** Documentation
**Package:** root
**Status:** not started
**Priority:** medium
**Risk Level:** low
**Estimated Iterations:** 1

**Description:**
Document secrets management practices, rotation procedures, and access controls.

**Acceptance Criteria:**

- [ ] Document created at `infrastructure/docs/secrets-management.md`
- [ ] Sections: Where secrets are stored, How to add new secrets, Rotation procedures
- [ ] List of all secrets and their purposes
- [ ] Access control documentation
- [ ] Incident response for leaked secrets
- [ ] Secret rotation schedule (90 days)
- [ ] Examples for each platform (GitHub, DigitalOcean, Vercel)

**Validation Commands:**

```bash
cat infrastructure/docs/secrets-management.md | grep -i rotation
cat infrastructure/docs/secrets-management.md | grep -i github
```

---

## Task 31: Create Architecture Diagrams

**Category:** Documentation
**Package:** root
**Status:** not started
**Priority:** low
**Risk Level:** low
**Estimated Iterations:** 2

**Description:**
Create visual diagrams for infrastructure topology, CI/CD pipeline, deployment flow, and network security.

**Acceptance Criteria:**

- [ ] Diagrams created in `infrastructure/docs/diagrams/`
- [ ] Infrastructure topology diagram (using Mermaid or draw.io)
- [ ] CI/CD pipeline flow diagram
- [ ] Deployment flow diagram (blue-green)
- [ ] Network security diagram (VPC, firewall, LB)
- [ ] Diagrams referenced in main README
- [ ] Source files included (editable format)

**Validation Commands:**

```bash
ls infrastructure/docs/diagrams/
# Should contain: topology.png, cicd.png, deployment.png, network.png
```

---

## Task 32: Create Infrastructure README

**Category:** Documentation
**Package:** root
**Status:** not started
**Priority:** medium
**Risk Level:** low
**Estimated Iterations:** 1

**Description:**
Write comprehensive README for infrastructure directory with setup instructions, usage guide, and troubleshooting.

**Acceptance Criteria:**

- [ ] README created at `infrastructure/README.md`
- [ ] Sections: Overview, Prerequisites, Setup, Deployment, Rollback, Troubleshooting
- [ ] Links to all documentation
- [ ] Quick start guide for new developers
- [ ] Architecture overview
- [ ] Links to external resources (Terraform docs, DigitalOcean docs)

**Validation Commands:**

```bash
cat infrastructure/README.md | grep -i "quick start"
cat infrastructure/README.md | grep -i prerequisites
```

---

## Task 33: Test Complete CI/CD Pipeline in Dev

**Category:** Testing
**Package:** root
**Status:** not started
**Priority:** high
**Risk Level:** low
**Estimated Iterations:** 2

**Description:**
End-to-end test of CI/CD pipeline by creating a test PR that goes through all stages.

**Acceptance Criteria:**

- [ ] Create test branch with small change
- [ ] Open PR to develop
- [ ] Verify code-quality job runs and passes
- [ ] Verify test job runs with service containers
- [ ] Verify build job runs and passes
- [ ] Merge PR to develop
- [ ] Verify Docker image builds with correct tags
- [ ] Verify staging deployment job runs (if in dev first)
- [ ] All jobs complete successfully
- [ ] No manual intervention required

**Validation:**
This is an integration test task. Validation:

- [ ] GitHub Actions shows all green checks
- [ ] Docker registry contains new image
- [ ] Deployment successful (if staging exists)

---

## Task 34: Test Rollback Procedure in Staging

**Category:** Testing
**Package:** root
**Status:** not started
**Priority:** high
**Risk Level:** medium
**Estimated Iterations:** 1

**Description:**
Test rollback procedure by deploying a version, then rolling back to previous version.

**Acceptance Criteria:**

- [ ] Deploy current version to staging
- [ ] Note the Git SHA
- [ ] Deploy a new version to staging
- [ ] Execute rollback script with previous SHA
- [ ] Verify health endpoint returns 200
- [ ] Verify API is serving previous version
- [ ] Rollback completes in < 2 minutes
- [ ] Zero downtime during rollback

**Validation:**
Manual testing task. Document results in activity.md

- [ ] Rollback script works as expected
- [ ] Health checks pass after rollback
- [ ] No downtime observed

---

## Task 35: Performance Test - Build Time Optimization

**Category:** Performance
**Package:** root
**Status:** not started
**Priority:** low
**Risk Level:** low
**Estimated Iterations:** 1

**Description:**
Measure and optimize CI/CD pipeline build times to meet <10 minute target.

**Acceptance Criteria:**

- [ ] Baseline build time measured
- [ ] Turborepo remote caching configured (if not already)
- [ ] pnpm caching optimized in GitHub Actions
- [ ] Docker layer caching configured
- [ ] Build time < 10 minutes for typical PR
- [ ] Build time < 5 minutes for unchanged packages
- [ ] Performance metrics documented

**Validation Commands:**

```bash
# Check workflow run times in GitHub Actions
# Target: < 10 minutes total for PR workflow
```

---

## Task 36: Security Audit - Complete Infrastructure Review

**Category:** Security
**Package:** root
**Status:** not started
**Priority:** medium
**Risk Level:** low
**Estimated Iterations:** 1

**Description:**
Conduct security audit of complete infrastructure configuration and fix any issues.

**Acceptance Criteria:**

- [ ] Secrets scan completed (gitleaks, trufflehog)
- [ ] Terraform security scan (tfsec or checkov)
- [ ] Docker image vulnerability scan (Trivy)
- [ ] Firewall rules reviewed
- [ ] SSH configuration reviewed (key-only, no root)
- [ ] Database access restricted to VPC only
- [ ] HTTPS enforced (HTTP redirects to HTTPS)
- [ ] All findings documented and resolved

**Validation Commands:**

```bash
# Run security scanners
gitleaks detect --source . --verbose || echo "No secrets found"

cd infrastructure/terraform
tfsec . || echo "tfsec not installed"
checkov -d . || echo "checkov not installed"

docker run --rm aquasec/trivy image api:latest
```

---

## Completion Criteria

When ALL tasks show Status: "passing", output:
**<promise>DEVOPS_COMPLETE</promise>**

---

## Blocked Tasks

If any task is blocked, document:

- What's blocking it
- What was attempted
- Potential solutions
- Updated status to "blocked"

---

## Notes

- Tasks are ordered by dependency and priority
- High-risk tasks should be tackled first
- Each task should result in 1-3 Git commits
- Run validation commands after each task before marking as "passing"
- Update this file after each iteration with progress notes
