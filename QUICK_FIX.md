# CI/CD Pipeline - Quick Fix Commands

## TL;DR - Run These Commands

### 1. Set up GitHub Secrets (Interactive)

```bash
cd infrastructure/scripts
./setup-github-secrets.sh
```

### 2. Prepare Droplet (One-time setup)

```bash
# SSH into droplet
ssh root@165.227.129.93

# Create deploy user
useradd -m -s /bin/bash deploy
echo "deploy ALL=(ALL) NOPASSWD: /usr/bin/docker" >> /etc/sudoers.d/deploy
usermod -aG docker deploy

# Create app directory
mkdir -p /opt/app
chown deploy:deploy /opt/app

# Exit and re-login as deploy user
exit
ssh deploy@165.227.129.93

# Clone repository
cd /opt/app
git clone https://github.com/YOUR_USERNAME/restomarket-app.git .
```

### 3. Set GitHub Secrets Manually (Alternative)

```bash
# Set staging host
gh secret set STAGING_HOST --body "165.227.129.93"

# Set username
gh secret set STAGING_USERNAME --body "deploy"

# Generate and set SSH key
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/restomarket_deploy -N ""
ssh-copy-id -i ~/.ssh/restomarket_deploy.pub deploy@165.227.129.93
gh secret set STAGING_SSH_KEY < ~/.ssh/restomarket_deploy

# Optional: Set Slack webhook
gh secret set SLACK_WEBHOOK --body "https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
```

### 4. Verify Setup

```bash
# Check secrets are set
gh secret list

# Test SSH connection
ssh deploy@165.227.129.93 "docker --version"

# Test health endpoint (after first deployment)
curl http://165.227.129.93:3002/v1/health
```

### 5. Trigger Deployment

```bash
# Push to develop branch
git checkout develop
git push origin develop

# Watch deployment
gh run watch

# Or check logs later
gh run list
gh run view <run-id>
```

## What Was Fixed

| Issue          | Before             | After                    |
| -------------- | ------------------ | ------------------------ |
| Port           | 3001/3000 mismatch | 3002 (consistent)        |
| Health check   | `/health`          | `/v1/health`             |
| SSH setup      | Manual + appleboy  | appleboy only            |
| URLs           | example.com        | 157.245.21.33            |
| Error messages | Generic            | Detailed with HTTP codes |

## Required Secrets

- ✅ `STAGING_HOST` = `165.227.129.93`
- ✅ `STAGING_USERNAME` = `deploy`
- ✅ `STAGING_SSH_KEY` = (private key)
- ⚪ `SLACK_WEBHOOK` = (optional)

## Files Changed

- `.github/workflows/ci-cd.yml` - Fixed all issues
- `infrastructure/docs/CICD_SETUP_GUIDE.md` - New comprehensive guide
- `infrastructure/scripts/setup-github-secrets.sh` - New setup helper
- `CICD_FIXES_SUMMARY.md` - Detailed changes summary

## Quick Troubleshooting

### "can't connect without a private SSH key"

```bash
gh secret set STAGING_SSH_KEY < ~/.ssh/restomarket_deploy
```

### "deploy.sh script not found"

```bash
ssh deploy@165.227.129.93 "cd /opt/app && git pull"
```

### Health check fails (Connection refused)

```bash
# Check if container is running
ssh deploy@165.227.129.93 "docker ps"

# Check container logs
ssh deploy@165.227.129.93 "docker logs restomarket-api-blue"  # or -green

# Check firewall
ssh deploy@165.227.129.93 "sudo ufw allow 3002/tcp"
```

### Health check fails (404)

- Already fixed! Now uses `/v1/health` instead of `/health`

---

**Read full documentation**: `infrastructure/docs/CICD_SETUP_GUIDE.md`
