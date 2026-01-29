# Infrastructure Scripts

This directory contains operational scripts for deployment, rollback, and maintenance of the RestoMarket infrastructure.

## Available Scripts

### 1. deploy.sh - Zero-Downtime Deployment

Blue-green deployment script that ensures zero downtime during API updates.

**Usage:**

```bash
./deploy.sh <image-tag> <environment>
```

**Examples:**

```bash
# Deploy to staging with Git SHA
./deploy.sh sha-abc1234 staging

# Deploy to production
./deploy.sh sha-def5678 production

# Deploy to dev environment
./deploy.sh sha-123456 dev
```

**Features:**

- Blue-green deployment strategy (alternates containers)
- Health check with configurable timeout (60s) and interval (5s)
- Automatic rollback on failed health checks
- Graceful shutdown with SIGTERM handling
- Cleanup of old Docker images (keeps last 5)
- Comprehensive logging with timestamps
- Color-coded output

**Environment Variables:**

- `HEALTH_CHECK_URL` - Health endpoint URL (default: http://localhost:3001/health)
- `HEALTH_CHECK_TIMEOUT` - Max wait time in seconds (default: 60)
- `HEALTH_CHECK_INTERVAL` - Retry interval in seconds (default: 5)
- `CONTAINER_PORT` - Container port (default: 3001)
- `HOST_PORT` - Host port (default: 3001)
- `STARTUP_WAIT` - Initial startup wait in seconds (default: 10)

**Deployment Flow:**

1. Pull new Docker image from registry
2. Start new container (blue or green, opposite of current)
3. Wait for startup + perform health checks
4. Stop old container gracefully (only after new one is healthy)
5. Clean up old container and images
6. Verify deployment success

**See Also:** Task 22 in IMPLEMENTATION_PLAN.md

---

### 2. rollback.sh - One-Command Rollback

Rollback to a previous Docker image version with zero downtime.

**Usage:**

```bash
./rollback.sh [OPTIONS] <git-sha|image-tag> <environment>
```

**Options:**

- `--list` - List recent deployments and exit
- `-h, --help` - Show help message

**Examples:**

```bash
# List recent deployments
./rollback.sh --list

# Rollback to specific Git SHA
./rollback.sh abc1234 staging

# Rollback using full image tag
./rollback.sh sha-abc1234 production

# Rollback using branch tag
./rollback.sh main-abc1234 staging
```

**Features:**

- Lists recent Docker images and running containers
- Automatic image tag normalization (abc1234 → sha-abc1234)
- Image verification before deployment
- Interactive confirmation prompt
- Zero-downtime rollback via deploy.sh
- Comprehensive logging to /var/log/rollback-\*.log
- Shows current container status after rollback

**Environment Variables:**

- `REGISTRY_URL` - Docker registry (default: ghcr.io)
- `IMAGE_NAME` - Image name (default: restomarket-api)
- `REGISTRY_USERNAME` - Registry username (auto-detected or manual)
- `GITHUB_TOKEN` - GitHub token for private repos

**Rollback Workflow:**

1. Validate prerequisites (Docker, deploy.sh)
2. List recent deployments (if --list flag)
3. Normalize target image tag
4. Verify image exists in registry
5. Request user confirmation
6. Execute zero-downtime deployment via deploy.sh
7. Verify rollback success

**See Also:** Task 23 in IMPLEMENTATION_PLAN.md

---

### 3. cleanup-images.sh - Docker Image Retention Policy

Automated cleanup of old Docker images to maintain a retention policy.

**Usage:**

```bash
./cleanup-images.sh [OPTIONS]
```

**Options:**

- `-h, --help` - Show help message
- `-n, --dry-run` - Preview deletions without actually deleting
- `-k, --keep COUNT` - Number of recent images to keep (default: 5)
- `-r, --registry URL` - Registry URL (default: ghcr.io)
- `-i, --image NAME` - Image name (default: restomarket-api)
- `-l, --local-only` - Clean only local images
- `-g, --registry-only` - Clean only registry images (requires gh CLI)

**Examples:**

```bash
# Dry run with default settings
./cleanup-images.sh --dry-run

# Keep 10 most recent images
./cleanup-images.sh --keep 10

# Clean only local images
./cleanup-images.sh --local-only

# Clean specific image with 3 kept
./cleanup-images.sh --image my-api --keep 3
```

**Features:**

- Keeps N most recent images by creation date (default: 5)
- Preserves protected tags: `latest`, `stable`, semantic versions (v1.2.3)
- Preserves branch tags: `main`, `develop`
- Dry-run mode for safe testing
- Comprehensive logging to /var/log/docker-cleanup-\*.log
- Color-coded output
- Supports both local and GHCR cleanup

**Environment Variables:**

- `KEEP_COUNT` - Number of images to keep (default: 5)
- `REGISTRY_URL` - Docker registry URL (default: ghcr.io)
- `IMAGE_NAME` - Image name (default: restomarket-api)
- `DRY_RUN` - Set to 'true' for dry-run mode (default: false)
- `GITHUB_TOKEN` - GitHub token for GHCR authentication

**Protected Tags:**

The following tags are NEVER deleted:

- `latest` - Latest stable release
- `stable` - Stable release marker
- Semantic versions: `v1.2.3`, `1.0.0`
- Branch tags: `main`, `develop`, `master`

**Cleanup Workflow:**

1. Check prerequisites (Docker daemon)
2. List all images for the repository
3. Separate protected and unprotected images
4. Sort unprotected images by creation date (newest first)
5. Delete oldest images beyond retention count
6. Show remaining disk usage

**Automated Execution:**

This script is automatically run weekly via GitHub Actions:

- Schedule: Sundays at 2:00 AM UTC
- Workflow: `.github/workflows/cleanup-images.yml`
- Can be manually triggered via GitHub UI

**See Also:** Task 24 in IMPLEMENTATION_PLAN.md

---

## Installation

All scripts are executable by default. If needed, make them executable:

```bash
chmod +x infrastructure/scripts/*.sh
```

## Prerequisites

### Common Requirements

- **Docker CLI** - For image and container management

  ```bash
  # macOS
  brew install docker

  # Ubuntu/Debian
  sudo apt-get install docker.io
  ```

- **Running Docker Daemon** - Docker service must be running
  ```bash
  # Check status
  docker info
  ```

### Optional Tools

- **shellcheck** - For script linting (development)

  ```bash
  # macOS
  brew install shellcheck

  # Ubuntu/Debian
  sudo apt-get install shellcheck
  ```

- **GitHub CLI (gh)** - For registry cleanup

  ```bash
  # macOS
  brew install gh

  # Ubuntu/Debian
  sudo apt-get install gh
  ```

## Security Considerations

### SSH Access

Deployment scripts require SSH access to droplets:

```bash
# Add your SSH key to the droplet
ssh-copy-id deploy@<droplet-ip>

# Test connection
ssh deploy@<droplet-ip>
```

### Registry Authentication

For private registries, authenticate before running scripts:

```bash
# GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# DigitalOcean Container Registry
doctl registry login
```

### Environment Variables

Never commit sensitive environment variables. Use:

- GitHub Secrets for CI/CD
- Local `.env` files (gitignored)
- System environment variables

## Logging

All scripts create timestamped log files:

- **deploy.sh**: Logs to stdout/stderr (captured by CI/CD)
- **rollback.sh**: `/var/log/rollback-YYYYMMDD-HHMMSS.log`
- **cleanup-images.sh**: `/var/log/docker-cleanup-YYYYMMDD-HHMMSS.log`

**View logs:**

```bash
# Recent rollback logs
ls -lt /var/log/rollback-*.log | head -5

# Recent cleanup logs
ls -lt /var/log/docker-cleanup-*.log | head -5

# Follow live logs
tail -f /var/log/rollback-*.log
```

## Troubleshooting

### Common Issues

**1. Docker daemon not running**

```bash
# Check status
docker info

# Start Docker (macOS)
open -a Docker

# Start Docker (Linux)
sudo systemctl start docker
```

**2. Permission denied**

```bash
# Add user to docker group
sudo usermod -aG docker $USER

# Re-login or run
newgrp docker
```

**3. Image not found**

```bash
# Verify image exists
docker images | grep <image-name>

# Pull image manually
docker pull ghcr.io/<owner>/<image>:<tag>
```

**4. Health check timeout**

```bash
# Check container logs
docker logs <container-name>

# Increase timeout
HEALTH_CHECK_TIMEOUT=120 ./deploy.sh <image> <env>
```

**5. Failed to clean up images**

```bash
# Check disk space
df -h
docker system df

# Prune unused resources
docker system prune -a
```

## CI/CD Integration

These scripts are integrated into GitHub Actions workflows:

- **deploy.sh** - Used in `.github/workflows/ci-cd.yml` (deploy-staging job)
- **rollback.sh** - Used for automatic rollback on deployment failure
- **cleanup-images.sh** - Scheduled weekly in `.github/workflows/cleanup-images.yml`

**GitHub Secrets Required:**

- `STAGING_HOST` - Droplet IP address
- `STAGING_USERNAME` - SSH username (e.g., deploy)
- `STAGING_SSH_KEY` - Private SSH key for authentication
- `GITHUB_TOKEN` - Auto-provided for GHCR access

## Best Practices

1. **Always use dry-run first**

   ```bash
   ./cleanup-images.sh --dry-run
   ```

2. **Test deployments in dev/staging before production**

   ```bash
   ./deploy.sh sha-abc1234 dev
   ./deploy.sh sha-abc1234 staging
   # Only if tests pass:
   ./deploy.sh sha-abc1234 production
   ```

3. **Keep rollback images available**
   - Maintain at least 5 recent images
   - Never delete `latest` or `stable` tags

4. **Monitor logs after deployment**

   ```bash
   docker logs -f api-blue
   ```

5. **Verify health checks**
   ```bash
   curl http://localhost:3001/health
   ```

## Related Documentation

- **Deployment Runbook**: `infrastructure/docs/deployment-runbook.md` (to be created)
- **Implementation Plan**: `IMPLEMENTATION_PLAN.md` (Tasks 22-24)
- **Activity Log**: `activity.md`
- **CI/CD Workflow**: `.github/workflows/ci-cd.yml`
- **Cleanup Workflow**: `.github/workflows/cleanup-images.yml`

## Support

For issues or questions:

1. Check the troubleshooting section above
2. Review logs in `/var/log/`
3. Consult the IMPLEMENTATION_PLAN.md
4. Check activity.md for recent changes
