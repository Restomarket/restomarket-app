# CI/CD Pipeline Setup Guide

This guide walks you through setting up the GitHub Actions CI/CD pipeline for deploying to the Frankfurt staging environment.

## Overview

The CI/CD pipeline automatically:

- Runs code quality checks (linting, formatting, type checking)
- Executes tests (unit, integration, E2E)
- Builds and scans Docker images
- Deploys to staging environment on `develop` branch pushes
- Performs health checks and smoke tests
- Sends Slack notifications (optional)

## Prerequisites

1. **DigitalOcean Frankfurt Infrastructure** must be provisioned (see `FRANKFURT_QUICK_REFERENCE.md`)
2. **GitHub repository admin access** to configure secrets and environments
3. **SSH access** to staging droplets
4. **Slack webhook** (optional, for notifications)

## Issues Fixed in Latest Update

### 1. Port Configuration Mismatch

**Problem**: The workflow used port `3001` but the Dockerfile exposes port `3002`.
**Fix**: Updated all port references to `3002` to match the Dockerfile.

### 2. Redundant SSH Setup Step

**Problem**: Workflow had unnecessary "Set up SSH key" step that wrote to `~/.ssh/id_rsa`.
**Fix**: Removed this step as `appleboy/ssh-action` handles SSH keys internally.

### 3. Health Check Endpoint Mismatch

**Problem**: Workflow checked `/health` but the API uses versioned endpoints `/v1/health`.
**Fix**: Updated all health check URLs to `/v1/health`.

### 4. Placeholder URLs

**Problem**: Used `https://staging-api.example.com` instead of actual infrastructure.
**Fix**: Updated to use Frankfurt load balancer IP `157.245.21.33` or `STAGING_HOST` secret.

### 5. Missing Error Context

**Problem**: Health checks didn't show HTTP response codes on failure.
**Fix**: Added detailed error messages with HTTP codes and URLs being tested.

## Required GitHub Secrets

Configure these secrets in your GitHub repository:

### 1. STAGING_HOST

**Value**: `165.227.129.93` (Frankfurt Droplet 1) or `161.35.21.86` (Droplet 2)

**How to set**:

```bash
gh secret set STAGING_HOST --body "165.227.129.93"
```

**Or via GitHub UI**:

- Go to Settings → Secrets and variables → Actions
- Click "New repository secret"
- Name: `STAGING_HOST`
- Secret: `165.227.129.93`

### 2. STAGING_USERNAME

**Value**: `deploy` or `root` (depending on your setup)

**How to set**:

```bash
gh secret set STAGING_USERNAME --body "deploy"
```

**Recommended**: Create a dedicated `deploy` user with limited permissions:

```bash
# SSH into droplet
ssh root@165.227.129.93

# Create deploy user
useradd -m -s /bin/bash deploy
usermod -aG docker deploy

# Set up SSH key for deploy user
mkdir -p /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
# Add your deploy public key to /home/deploy/.ssh/authorized_keys
```

### 3. STAGING_SSH_KEY

**Value**: Private SSH key for connecting to the droplet

**Generate new deploy key**:

```bash
# On your local machine
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/restomarket_deploy

# Copy public key to droplet
ssh-copy-id -i ~/.ssh/restomarket_deploy.pub deploy@165.227.129.93

# Or manually:
cat ~/.ssh/restomarket_deploy.pub
# Then add to /home/deploy/.ssh/authorized_keys on droplet
```

**Set the secret**:

```bash
# Using gh CLI
gh secret set STAGING_SSH_KEY < ~/.ssh/restomarket_deploy

# Or copy the private key content
cat ~/.ssh/restomarket_deploy
# Then paste in GitHub UI
```

**Security Notes**:

- Use a dedicated deploy key (not your personal SSH key)
- Use Ed25519 keys (more secure than RSA)
- Never commit private keys to the repository
- Consider using GitHub's deploy keys for repository-specific access

### 4. SLACK_WEBHOOK (Optional)

**Value**: Slack incoming webhook URL

**How to get**:

1. Go to your Slack workspace → Apps → Add Incoming Webhooks
2. Create a new webhook for your deployment channel
3. Copy the webhook URL (starts with `https://hooks.slack.com/services/...`)

**Set the secret**:

```bash
gh secret set SLACK_WEBHOOK --body "https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
```

**If you don't want Slack notifications**:

- The workflow will continue to work (notifications use `continue-on-error`)
- Consider removing the notification steps to avoid errors in logs

## Automated Setup Script

You can use the provided script to automate most of the setup:

```bash
cd infrastructure/scripts
./gh-setup-staging-secrets.sh
```

This script will:

- ✅ Create the `staging` GitHub environment
- ✅ Configure deployment branch policy for `develop` branch
- ✅ List existing secrets
- ✅ Automatically set `STAGING_USERNAME=deploy`
- ℹ️ Provide instructions for setting other secrets

## Environment Setup on Droplet

The droplet must have:

### 1. Application Directory Structure

```bash
# SSH into droplet
ssh deploy@165.227.129.93

# Create application directory
sudo mkdir -p /opt/app
sudo chown deploy:deploy /opt/app
cd /opt/app

# Clone repository (or sync deployment scripts)
git clone https://github.com/YOUR_USERNAME/restomarket-app.git .
```

### 2. Docker Installation

```bash
# Should already be installed via Terraform/Ansible
docker --version
docker compose version

# Ensure deploy user can run docker
sudo usermod -aG docker deploy
# Log out and back in for group changes to take effect
```

### 3. GitHub Container Registry Access

The workflow handles GHCR login, but you can test manually:

```bash
echo "YOUR_GITHUB_TOKEN" | docker login ghcr.io -u YOUR_USERNAME --password-stdin
```

### 4. Environment Variables

The deployment script will inject these automatically:

- `NODE_ENV=staging`
- `IMAGE_TAG` (from workflow)
- Other env vars should be in a `.env` file or configured separately

## Deployment Flow

### On Push to `develop` Branch:

1. **Code Quality Checks** (Job 1)
   - Linting, formatting, type checking
   - Security scans (gitleaks, Trivy)
   - Dependency audit

2. **Tests** (Job 2)
   - Unit tests
   - Integration tests (if configured)
   - E2E tests
   - Coverage reporting

3. **Build** (Job 3)
   - Turborepo build all packages
   - Upload build artifacts

4. **Docker Build** (Job 4)
   - Build Docker image
   - Tag with SHA and branch name
   - Push to GitHub Container Registry (ghcr.io)
   - Security scan with Trivy

5. **Deploy to Staging** (Job 5) - **Only on `develop` pushes**
   - SSH into staging droplet
   - Pull new Docker image
   - Run zero-downtime deployment script
   - Health check with retries
   - Smoke tests
   - Rollback on failure
   - Slack notification

## Deployment Strategy

The deployment uses **blue-green deployment** for zero downtime:

1. New container starts alongside current container
2. Health checks verify new container is healthy
3. Traffic switches to new container
4. Old container is stopped and removed
5. Old images are cleaned up (keeps last 5)

## Health Checks

### Local Health Check (on droplet)

```bash
curl http://localhost:3002/v1/health
```

### External Health Check (via load balancer)

```bash
curl http://157.245.21.33:3002/v1/health
```

Expected response:

```json
{
  "status": "ok",
  "info": { ... },
  "error": {},
  "details": { ... }
}
```

## Troubleshooting

### Deployment Fails: "can't connect without a private SSH key"

**Cause**: `STAGING_SSH_KEY` secret is missing or invalid.
**Fix**:

```bash
# Verify secret exists
gh secret list | grep STAGING_SSH_KEY

# Set the secret
gh secret set STAGING_SSH_KEY < ~/.ssh/restomarket_deploy
```

### Deployment Fails: "deploy.sh script not found"

**Cause**: Repository not cloned to `/opt/app` on droplet.
**Fix**:

```bash
ssh deploy@165.227.129.93
sudo mkdir -p /opt/app && sudo chown deploy:deploy /opt/app
cd /opt/app
git clone https://github.com/YOUR_USERNAME/restomarket-app.git .
```

### Health Check Fails: Connection Refused

**Possible causes**:

1. Container failed to start - check logs:

   ```bash
   ssh deploy@165.227.129.93
   docker ps -a
   docker logs restomarket-api-blue  # or restomarket-api-green
   ```

2. Port mismatch - verify Dockerfile EXPOSE matches HOST_PORT

3. Firewall blocking port 3002:
   ```bash
   # On droplet
   sudo ufw status
   sudo ufw allow 3002/tcp
   ```

### Health Check Fails: Wrong Endpoint

**Cause**: API uses versioned endpoints (`/v1/health`)
**Fix**: Already fixed in latest workflow - uses `/v1/health`

### Slack Notification Fails: "no_team" or 404

**Causes**:

1. `SLACK_WEBHOOK` secret is missing or invalid
2. Webhook URL is incorrect or expired

**Fix**:

```bash
# Verify secret
gh secret list | grep SLACK_WEBHOOK

# Update secret with new webhook
gh secret set SLACK_WEBHOOK --body "https://hooks.slack.com/services/..."

# Or remove notification steps if not needed
```

### Rollback Doesn't Work

**Cause**: No previous container to rollback to (first deployment)
**Expected**: First deployment will fail completely if health checks fail
**Fix**: Check logs, fix issue, redeploy

## Testing the Pipeline

### 1. Test SSH Connection

```bash
# From your local machine or CI
ssh deploy@165.227.129.93 "echo 'SSH connection successful'"
```

### 2. Test Deployment Script Manually

```bash
ssh deploy@165.227.129.93
cd /opt/app

# Set test environment
export IMAGE_TAG="ghcr.io/YOUR_USERNAME/restomarket-api:latest"
export ENVIRONMENT="staging"
export HEALTH_CHECK_URL="http://localhost:3002/v1/health"
export HOST_PORT="3002"
export CONTAINER_PORT="3002"

# Run deployment
./infrastructure/scripts/deploy.sh "$IMAGE_TAG" "$ENVIRONMENT"
```

### 3. Test Health Endpoint

```bash
# Local on droplet
curl -v http://localhost:3002/v1/health

# External via load balancer
curl -v http://157.245.21.33:3002/v1/health

# External via droplet IP
curl -v http://165.227.129.93:3002/v1/health
```

### 4. Trigger Test Deployment

```bash
# Make a small change on develop branch
git checkout develop
echo "# Test deployment" >> README.md
git add README.md
git commit -m "test(ci): trigger staging deployment"
git push origin develop

# Watch the workflow
gh run watch
```

## Port Reference

| Service | Container Port | Host Port | Public Access                     |
| ------- | -------------- | --------- | --------------------------------- |
| API     | 3002           | 3002      | Load Balancer: 157.245.21.33:3002 |

**Note**: The Dockerfile exposes port `3002` and the health check runs on `3002` inside the container.

## Network Architecture

```
GitHub Actions
    │
    ├─ SSH ────────────────────────→ Droplet 1 (165.227.129.93:22)
    │                                    │
    │                                    └─ Docker Container (port 3002)
    │
    └─ HTTP (health check) ─────────→ Droplet 1 (165.227.129.93:3002)
                                      OR
                                      Load Balancer (157.245.21.33:3002)
```

## Next Steps

1. ✅ Configure all required GitHub secrets
2. ✅ Set up deployment user on droplet
3. ✅ Clone repository to `/opt/app` on droplet
4. ✅ Test SSH connection from local machine
5. ✅ Test deployment script manually
6. ✅ Push to `develop` branch to trigger first deployment
7. ⏭️ Configure SSL/TLS (see `SSL_SETUP_GUIDE.md`)
8. ⏭️ Set up custom domain for staging API
9. ⏭️ Enable firewall rules after SSL is configured

## Security Best Practices

- ✅ Use dedicated deploy user (not root)
- ✅ Use dedicated deploy SSH key (not personal key)
- ✅ Use Ed25519 keys (modern, secure)
- ✅ Restrict deploy user permissions
- ✅ Enable GitHub environment protection rules
- ✅ Use secrets for all sensitive data
- ✅ Enable branch protection for `main` and `develop`
- ✅ Require PR reviews before merge
- ⏭️ Set up firewall rules after initial deployment
- ⏭️ Configure fail2ban for SSH protection
- ⏭️ Enable audit logging

## References

- Frankfurt Infrastructure: `infrastructure/FRANKFURT_QUICK_REFERENCE.md`
- Deployment Script: `infrastructure/scripts/deploy.sh`
- Rollback Script: `infrastructure/scripts/rollback.sh`
- GitHub Secrets Setup: `infrastructure/scripts/gh-setup-staging-secrets.sh`
- Terraform Outputs: Run `terraform output` in `infrastructure/terraform/environments/staging/`

## Support

If you encounter issues:

1. Check workflow logs: `gh run list` then `gh run view <run-id>`
2. Check deployment logs on droplet: `ssh deploy@IP "docker logs <container>"`
3. Review this guide's troubleshooting section
4. Check related documentation files
5. Open an issue in the repository

---

**Last Updated**: 2026-01-30
**Status**: ✅ Workflow fixed and ready for use
