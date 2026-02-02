# CI/CD Pipeline Fixes - Summary

## Issues Fixed

### 1. ✅ Port Configuration Mismatch

**Problem**: Workflow used port `3001` but Dockerfile exposes `3002`

**Fixed**:

- Updated `HOST_PORT` and `CONTAINER_PORT` from `3001/3000` to `3002/3002`
- Updated health check URL to use port `3002`
- Comment now correctly states "matches Dockerfile" instead of "matches Ansible/Terraform"

### 2. ✅ Redundant SSH Setup Step Removed

**Problem**: Unnecessary "Set up SSH key" step that manually configured `~/.ssh/id_rsa`

**Why it failed**: The `appleboy/ssh-action` expects to handle SSH keys internally via its `key` parameter

**Fixed**:

- Removed lines 400-405 (the redundant SSH setup step)
- The `appleboy/ssh-action` now handles SSH authentication directly

### 3. ✅ Health Check Endpoint Path Fixed

**Problem**: Workflow checked `/health` but API uses versioned endpoints `/v1/health`

**Fixed**:

- Updated all health check URLs from `/health` to `/v1/health`
- Updated smoke test URLs to use `/v1/health`
- Matches the Dockerfile HEALTHCHECK command at line 133

### 4. ✅ Placeholder URLs Replaced

**Problem**: Used `https://staging-api.example.com` which doesn't exist

**Fixed**:

- Environment URL: Changed to `http://157.245.21.33` (Frankfurt load balancer)
- Health checks: Now use `${{ secrets.STAGING_HOST }}:3002/v1/health`
- Smoke tests: Use `${{ secrets.STAGING_HOST }}:3002` variable
- Slack notification: Changed to `http://157.245.21.33:3002`

### 5. ✅ Improved Error Reporting

**Problem**: Health checks showed generic errors without details

**Fixed**:

- Added HTTP status code display in health check output
- Added URL being tested in health check output
- Added response body in smoke test failures
- Changed from `grep -q "200"` to explicit HTTP code comparison

## Files Modified

### `.github/workflows/ci-cd.yml`

```diff
- url: https://staging-api.example.com
+ url: http://157.245.21.33

- Removed "Set up SSH key" step (7 lines)

- export HEALTH_CHECK_URL="http://localhost:3001/health"
- export HOST_PORT="3001"
- export CONTAINER_PORT="3000"
+ export HEALTH_CHECK_URL="http://localhost:3002/v1/health"
+ export HOST_PORT="3002"
+ export CONTAINER_PORT="3002"

+ HEALTH_URL="http://${{ secrets.STAGING_HOST }}:3002/v1/health"
+ HTTP_CODE=$(curl -f -s -o /dev/null -w "%{http_code}" "$HEALTH_URL" || echo "000")

+ STAGING_URL="http://${{ secrets.STAGING_HOST }}:3002"
- curl -s https://staging-api.example.com/health
+ curl -s "$STAGING_URL/v1/health"
```

## Files Created

### `infrastructure/docs/CICD_SETUP_GUIDE.md`

Comprehensive guide covering:

- Prerequisites and overview
- Detailed explanation of all issues fixed
- Required GitHub secrets with examples
- Environment setup on droplet
- Deployment flow and strategy
- Troubleshooting guide
- Security best practices
- Testing procedures

### `infrastructure/scripts/setup-github-secrets.sh`

Interactive script to:

- Validate `gh` CLI installation and authentication
- Check existing secrets
- Guide through setting each required secret
- Generate SSH key pairs if needed
- Provide next steps after setup

## Required GitHub Secrets

These secrets must be configured before deployment will work:

| Secret Name        | Value                        | How to Set                                                         |
| ------------------ | ---------------------------- | ------------------------------------------------------------------ |
| `STAGING_HOST`     | `165.227.129.93`             | `gh secret set STAGING_HOST --body "165.227.129.93"`               |
| `STAGING_USERNAME` | `deploy` or `root`           | `gh secret set STAGING_USERNAME --body "deploy"`                   |
| `STAGING_SSH_KEY`  | Private SSH key              | `gh secret set STAGING_SSH_KEY < ~/.ssh/restomarket_deploy`        |
| `SLACK_WEBHOOK`    | Slack webhook URL (optional) | `gh secret set SLACK_WEBHOOK --body "https://hooks.slack.com/..."` |

## What Was Wrong Before

### Error 1: SSH Connection Failure

```
Error: can't connect without a private SSH key or password
```

**Cause**: The redundant SSH setup step wasn't compatible with `appleboy/ssh-action`

### Error 2: Slack Notification Failure

```
Error: no_team
Error: Request failed with status code 404
```

**Cause**: `SLACK_WEBHOOK` secret not configured (this is optional)

## Infrastructure Details (Frankfurt)

Based on `infrastructure/FRANKFURT_QUICK_REFERENCE.md`:

| Resource      | IP/URL           | Purpose                                     |
| ------------- | ---------------- | ------------------------------------------- |
| Load Balancer | `157.245.21.33`  | Public access, HTTP only (no SSL yet)       |
| Droplet 1     | `165.227.129.93` | API server (recommended for `STAGING_HOST`) |
| Droplet 2     | `161.35.21.86`   | API server (backup)                         |
| API Port      | `3002`           | Container and host port                     |

## Next Steps

1. **Configure GitHub Secrets** (use helper script):

   ```bash
   cd infrastructure/scripts
   ./setup-github-secrets.sh
   ```

2. **Set up droplet** (if not already done):

   ```bash
   # SSH into droplet
   ssh root@165.227.129.93

   # Create deploy user
   useradd -m -s /bin/bash deploy
   usermod -aG docker deploy

   # Create app directory
   mkdir -p /opt/app
   chown deploy:deploy /opt/app

   # Switch to deploy user
   su - deploy
   cd /opt/app

   # Clone repository
   git clone https://github.com/YOUR_USERNAME/restomarket-app.git .
   ```

3. **Test SSH connection**:

   ```bash
   ssh deploy@165.227.129.93 "echo 'Connection successful'"
   ```

4. **Trigger deployment**:

   ```bash
   # Push to develop branch
   git checkout develop
   git push origin develop

   # Monitor deployment
   gh run watch
   ```

## Port Reference

| Component              | Port                         | Configuration                         |
| ---------------------- | ---------------------------- | ------------------------------------- |
| Dockerfile EXPOSE      | `3002`                       | `apps/api/Dockerfile:126`             |
| Dockerfile HEALTHCHECK | `3002`                       | `apps/api/Dockerfile:133`             |
| CI/CD HOST_PORT        | `3002`                       | `.github/workflows/ci-cd.yml:417`     |
| CI/CD CONTAINER_PORT   | `3002`                       | `.github/workflows/ci-cd.yml:418`     |
| Health Check URL       | `http://HOST:3002/v1/health` | `.github/workflows/ci-cd.yml:416,437` |

All ports are now consistently `3002` throughout the configuration.

## Testing the Fix

### 1. Verify GitHub secrets are set

```bash
gh secret list
```

Should show:

- `STAGING_HOST`
- `STAGING_SSH_KEY`
- `STAGING_USERNAME`
- `SLACK_WEBHOOK` (optional)

### 2. Test SSH access

```bash
ssh deploy@$(gh secret list | grep STAGING_HOST | awk '{print $2}') "docker --version"
```

### 3. Test deployment script locally

```bash
ssh deploy@165.227.129.93
cd /opt/app
export IMAGE_TAG="ghcr.io/YOUR_USERNAME/restomarket-api:latest"
export ENVIRONMENT="staging"
export HEALTH_CHECK_URL="http://localhost:3002/v1/health"
export HOST_PORT="3002"
export CONTAINER_PORT="3002"
./infrastructure/scripts/deploy.sh "$IMAGE_TAG" "$ENVIRONMENT"
```

### 4. Trigger CI/CD pipeline

```bash
git checkout develop
echo "# Test deployment" >> README.md
git add README.md
git commit -m "test(ci): trigger staging deployment"
git push origin develop
gh run watch
```

## Deployment Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Code pushed to 'develop' branch                          │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   v
┌─────────────────────────────────────────────────────────────┐
│ 2. GitHub Actions:                                          │
│    - Code quality checks                                     │
│    - Tests (unit, integration, E2E)                         │
│    - Build packages                                          │
│    - Build Docker image                                      │
│    - Push to ghcr.io                                        │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   v
┌─────────────────────────────────────────────────────────────┐
│ 3. SSH to Droplet (165.227.129.93:22)                      │
│    - User: deploy                                            │
│    - Auth: STAGING_SSH_KEY secret                           │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   v
┌─────────────────────────────────────────────────────────────┐
│ 4. Run deployment script at /opt/app                        │
│    - Pull new image from ghcr.io                            │
│    - Start new container (blue-green deployment)            │
│    - Health check: http://localhost:3002/v1/health         │
│    - Stop old container                                      │
│    - Clean up old images                                     │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   v
┌─────────────────────────────────────────────────────────────┐
│ 5. External health checks from GitHub Actions               │
│    - URL: http://165.227.129.93:3002/v1/health             │
│    - Retries: 12 attempts, 5s interval                      │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   v
┌─────────────────────────────────────────────────────────────┐
│ 6. Smoke tests                                              │
│    - JSON response validation                                │
│    - API version header check                               │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   v
┌─────────────────────────────────────────────────────────────┐
│ 7. Slack notification (if configured)                       │
│    - Success or failure message                             │
│    - Links to deployment logs and API                       │
└─────────────────────────────────────────────────────────────┘
```

## Documentation

- 📖 **Full Setup Guide**: `infrastructure/docs/CICD_SETUP_GUIDE.md`
- 🚀 **Frankfurt Quick Reference**: `infrastructure/FRANKFURT_QUICK_REFERENCE.md`
- 🔧 **Setup Script**: `infrastructure/scripts/setup-github-secrets.sh`
- 📜 **Deployment Script**: `infrastructure/scripts/deploy.sh`

## Rollback Procedure

If deployment fails, the workflow automatically:

1. Detects failure via `if: failure()` condition
2. SSH back into droplet
3. Runs rollback script to restore previous container
4. Sends Slack notification about rollback

Manual rollback:

```bash
ssh deploy@165.227.129.93
cd /opt/app
./infrastructure/scripts/rollback.sh <previous-sha> staging
```

## Status

- ✅ Workflow file fixed
- ✅ Documentation created
- ✅ Setup scripts created
- ⏳ GitHub secrets need to be configured
- ⏳ Droplet needs to be prepared
- ⏳ First deployment needs to be tested

---

**Last Updated**: 2026-01-30
**Status**: Ready for GitHub secrets configuration and testing
