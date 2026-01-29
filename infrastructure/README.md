# Infrastructure - DevOps Configuration

This directory contains all infrastructure as code (IaC), deployment scripts, and configuration management for the RestoMarket application.

## Directory Structure

```
infrastructure/
├── terraform/              # Infrastructure as Code with Terraform
│   ├── modules/           # Reusable Terraform modules
│   │   ├── api-cluster/   # API server droplets configuration
│   │   ├── database/      # Managed PostgreSQL configuration
│   │   ├── networking/    # VPC and firewall rules
│   │   ├── monitoring/    # Monitoring and alerting
│   │   └── redis/         # Managed Redis cache
│   ├── environments/      # Environment-specific configurations
│   │   ├── dev/          # Development environment
│   │   └── staging/      # Staging environment
│   └── scripts/          # Terraform utility scripts
│       ├── init-backend.sh   # Initialize remote state backend
│       └── deploy.sh         # Deployment helper
├── ansible/               # Configuration Management
│   ├── playbooks/        # Ansible playbooks
│   │   ├── setup-api.yml    # Initial server setup
│   │   ├── update-api.yml   # API deployment with zero-downtime
│   │   └── backup.yml       # Backup procedures
│   └── inventory/        # Inventory files
│       ├── dev.yml          # Development inventory
│       └── staging.yml      # Staging inventory
├── docker/               # Docker configurations
│   ├── api/             # API Dockerfile and configs
│   └── docker-compose.yml   # Local development setup
├── scripts/             # Deployment and maintenance scripts
│   ├── deploy.sh           # Zero-downtime deployment script
│   ├── rollback.sh         # One-command rollback script
│   └── cleanup-images.sh   # Image retention policy enforcement
└── docs/                # Infrastructure documentation
    ├── deployment-runbook.md    # Deployment procedures
    └── diagrams/                # Architecture diagrams (Mermaid)
        ├── topology.md              # Infrastructure topology
        ├── cicd-pipeline.md         # CI/CD pipeline flow
        ├── deployment-flow.md       # Blue-green deployment
        └── network-security.md      # Security architecture
```

## Overview

This infrastructure supports two environments:

- **Development**: Local development using Docker Compose
- **Staging**: DigitalOcean-hosted environment for pre-production testing

### Key Features

1. **Rollback Capability**: Docker images tagged with Git SHA for instant recovery
2. **Secrets Management**: No secrets in code; using platform-native secret managers
3. **CI/CD Gatekeeping**: Quality checks block deployments via GitHub Actions
4. **Zero-Downtime Deployments**: Blue-green deployment strategy with health checks
5. **Infrastructure as Code**: Terraform for reproducible infrastructure
6. **Configuration Management**: Ansible for server provisioning and updates

## Prerequisites

### Required Tools

- **Terraform** >= 1.6
- **Ansible** >= 2.15
- **Docker** >= 24.0
- **Docker Compose** >= 2.20
- **pnpm** >= 8.0
- **Node.js** >= 20.18
- **DigitalOcean CLI** (`doctl`)

### Required Accounts

- GitHub account with repository access
- DigitalOcean account with API token
- Container registry access (GitHub Container Registry or DigitalOcean Registry)

### Environment Variables

See `.env.example` files in each app directory for required environment variables.

## Quick Start

### Local Development with Docker Compose

**For detailed instructions, see [docker/README.md](docker/README.md)**

```bash
# 1. Copy environment variables
cp .env.development.example .env.development

# 2. Start all services (API, PostgreSQL, Redis, Adminer)
docker-compose up -d

# 3. Verify services are running
docker-compose ps
curl http://localhost:3001/health

# 4. View logs
docker-compose logs -f api

# 5. Access services:
# - API: http://localhost:3001
# - Swagger Docs: http://localhost:3001/api/docs
# - Adminer (DB UI): http://localhost:8080
# - Health Check: http://localhost:3001/health

# 6. Stop services
docker-compose down
```

### Staging-like Local Testing

**For detailed instructions, see [docker/STAGING.md](docker/STAGING.md)**

Test production builds locally before deploying:

```bash
# 1. Copy staging environment variables
cp .env.staging.example .env.staging

# 2. Build production image
docker-compose -f docker-compose.staging.yml build

# 3. Start services (API, PostgreSQL, Redis, Adminer)
docker-compose -f docker-compose.staging.yml up -d

# 4. Verify production build
docker-compose -f docker-compose.staging.yml ps
curl http://localhost:3002/health

# 5. Test production behavior (no hot reload, optimized image)
# - API: http://localhost:3002
# - Adminer (DB UI): http://localhost:8081

# 6. Stop and cleanup
docker-compose -f docker-compose.staging.yml down -v
```

### Infrastructure Provisioning (Staging)

#### First Time Setup: Initialize Remote State Backend

Before provisioning infrastructure, set up the Terraform remote state backend:

```bash
# 1. Set up DigitalOcean Spaces credentials
export AWS_ACCESS_KEY_ID='your-spaces-access-key'
export AWS_SECRET_ACCESS_KEY='your-spaces-secret-key'

# 2. Run backend initialization script
cd infrastructure/terraform/scripts
./init-backend.sh staging restomarket-terraform-state-staging nyc3

# The script will:
# - Create a DigitalOcean Spaces bucket
# - Enable versioning for state rollback
# - Generate backend-config.tfvars in the staging directory
```

**For detailed backend setup instructions, see [terraform/scripts/README.md](terraform/scripts/README.md)**

#### Provision Infrastructure

```bash
# 1. Navigate to staging environment
cd infrastructure/terraform/environments/staging

# 2. Copy and configure variables
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values (DO token, SSH keys, etc.)

# 3. Initialize Terraform with remote backend
terraform init -backend-config=backend-config.tfvars

# 4. Review planned changes
terraform plan

# 5. Apply infrastructure changes
terraform apply

# 6. Note the output values (IPs, connection strings)
terraform output
```

### Deployment

```bash
# Deploy to staging (triggered automatically on push to develop branch)
# Or manually:
cd infrastructure/scripts
./deploy.sh <image-tag> staging
```

### Rollback

```bash
# List recent deployments
cd infrastructure/scripts
./rollback.sh --list

# Rollback to specific version
./rollback.sh abc1234
```

## Deployment Process

### Automated Deployment (GitHub Actions)

1. Developer pushes to `develop` branch
2. CI pipeline runs: lint → test → build → docker-build
3. If all checks pass, deploy-staging job runs
4. New Docker image pulled and deployed with zero downtime
5. Health checks verify deployment
6. Slack notification sent on completion

### Manual Deployment

```bash
# SSH into droplet
ssh deploy@<droplet-ip>

# Run deployment script
cd /opt/restomarket
./deploy.sh registry.digitalocean.com/my-registry/api:abc1234 staging
```

## Rollback Procedures

See `docs/deployment-runbook.md` for detailed rollback procedures.

Quick rollback:

```bash
# On the droplet or via CI/CD
./infrastructure/scripts/rollback.sh <previous-git-sha>
```

## Architecture Diagrams

Comprehensive visual documentation is available in the `docs/diagrams/` directory:

- **[Infrastructure Topology](./docs/diagrams/topology.md)**: Complete infrastructure layout for dev and staging environments with VPC, services, firewalls, and cost breakdown
- **[CI/CD Pipeline](./docs/diagrams/cicd-pipeline.md)**: Full pipeline flow from code quality to deployment, including caching strategy and security scanning
- **[Deployment Flow](./docs/diagrams/deployment-flow.md)**: Blue-green deployment sequence with health checks, rollback mechanism, and zero-downtime guarantee
- **[Network Security](./docs/diagrams/network-security.md)**: Security architecture with firewall rules, SSH hardening, SSL/TLS configuration, and defense-in-depth layers

All diagrams use Mermaid and render automatically on GitHub. See [diagrams README](./docs/diagrams/README.md) for viewing and editing instructions.

## Monitoring

- **DigitalOcean Monitoring**: CPU, memory, disk usage alerts
- **Health Checks**: `/health` endpoint monitored by load balancer
- **Logs**: Structured JSON logs with Pino (API)

## Security

- All secrets stored in platform-native secret managers (GitHub Secrets, DigitalOcean)
- Pre-commit hooks prevent secret commits (`gitleaks`)
- Docker images scanned for vulnerabilities (`Trivy`)
- SSH access restricted to admin IPs only
- Database accessible only from VPC
- HTTPS enforced with SSL certificates

## Troubleshooting

### Common Issues

**Container won't start**

```bash
docker-compose logs api
docker inspect <container-id>
```

**Health check failing**

```bash
curl -v http://localhost:3001/health
docker exec -it <container-id> sh
```

**Database connection issues**

```bash
# Check connection string in environment
echo $DATABASE_URL

# Test connection
docker exec -it postgres psql -U postgres -c "SELECT 1"
```

**Terraform state locked**

```bash
# Force unlock (use with caution)
terraform force-unlock <lock-id>
```

## Documentation

- [Deployment Runbook](docs/deployment-runbook.md) - Step-by-step deployment procedures
- [Secrets Management](../docs/SECRETS_MANAGEMENT.md) - How to manage secrets safely
- [Manual Tasks Guide](docs/MANUAL_TASKS.md) - Complete guide for manual configuration and testing
- [Architecture Diagrams](docs/diagrams/) - Visual infrastructure diagrams
- [Scripts Documentation](scripts/README.md) - Deployment and maintenance scripts

## Contributing

When making infrastructure changes:

1. Create a feature branch
2. Update Terraform/Ansible configurations
3. Test in dev environment first
4. Run `terraform validate` and `terraform fmt`
5. Open PR with description of changes
6. Apply to staging after approval

## Support

For infrastructure issues, contact the DevOps team or create an issue in the repository.

## License

See root LICENSE file.
