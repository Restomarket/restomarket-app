# Secrets Management Guide

This guide explains how to safely manage secrets in the RestoMarket application.

## Core Principles

1. **Never commit secrets to git** - Use `.env` files locally, never commit them
2. **Use platform-native secret managers** - GitHub Secrets, DigitalOcean, Vercel
3. **Rotate secrets regularly** - Every 90 days minimum
4. **Principle of least privilege** - Grant minimal necessary access
5. **Audit secret access** - Monitor who accesses what

## Where Secrets Are Stored

### Local Development

- **Location**: `.env.development` files (gitignored)
- **Source**: Copy from `.env.example` and fill in values
- **Access**: Developers on their local machines
- **Rotation**: Not required (use non-production values)

Example:

```bash
cp apps/api/.env.example apps/api/.env.development
# Edit .env.development with your local values
```

### GitHub Actions (CI/CD)

- **Location**: Repository Settings → Secrets and variables → Actions
- **Access**: GitHub Actions workflows only
- **Rotation**: Every 90 days

**Required Secrets:**

```
# DigitalOcean
DO_API_TOKEN              # API token for Terraform and deployments
DO_REGISTRY_TOKEN         # Container registry access

# SSH Access
STAGING_HOST              # Staging server IP/hostname
STAGING_USERNAME          # SSH username (deploy user)
STAGING_SSH_KEY           # Private SSH key for deployment

# Database (Staging)
DATABASE_URL              # PostgreSQL connection string
REDIS_URL                 # Redis connection string

# Security Scanning
SNYK_TOKEN               # Snyk security scanning (optional)

# Notifications
SLACK_WEBHOOK_URL        # Slack notifications (optional)
SENTRY_DSN               # Error tracking (optional)

# Code Coverage
CODECOV_TOKEN            # Codecov uploads (optional)
```

**How to Add Secrets:**

1. Go to: `https://github.com/YOUR_ORG/restomarket-app/settings/secrets/actions`
2. Click "New repository secret"
3. Enter name and value
4. Click "Add secret"

### DigitalOcean Droplets (Staging/Production)

- **Location**: Droplet environment variables or systemd service files
- **Access**: Restricted to deployment user and admins
- **Rotation**: Every 90 days

**Setting Environment Variables on Droplet:**

```bash
# SSH into droplet
ssh deploy@staging.example.com

# Edit systemd service file
sudo nano /etc/systemd/system/restomarket-api.service

# Add environment variables
[Service]
Environment="NODE_ENV=staging"
Environment="DATABASE_URL=postgresql://..."
Environment="REDIS_URL=redis://..."

# Reload and restart
sudo systemctl daemon-reload
sudo systemctl restart restomarket-api
```

**Using .env files on Droplet (Alternative):**

```bash
# Create .env file
sudo nano /opt/restomarket/.env.staging

# Secure permissions (read only by owner)
sudo chmod 600 /opt/restomarket/.env.staging
sudo chown deploy:deploy /opt/restomarket/.env.staging

# Docker Compose will load it automatically
cd /opt/restomarket
docker-compose --env-file .env.staging up -d
```

### Vercel (Web Application)

- **Location**: Project Settings → Environment Variables
- **Access**: Vercel dashboard, restricted by team permissions
- **Rotation**: Every 90 days

**How to Add Environment Variables:**

1. Go to: `https://vercel.com/YOUR_ORG/restomarket-web/settings/environment-variables`
2. Add variable for each environment (Production, Preview, Development)
3. Redeploy to apply changes

**Required Variables:**

```
NEXT_PUBLIC_API_URL       # API endpoint URL
NODE_ENV                  # Environment (production, staging)
```

## Secret Types and Rotation Schedule

| Secret Type        | Location                         | Rotation Frequency | Criticality |
| ------------------ | -------------------------------- | ------------------ | ----------- |
| Database passwords | DO Managed DB, GitHub Secrets    | 90 days            | High        |
| API tokens (DO)    | GitHub Secrets                   | 90 days            | High        |
| SSH keys           | GitHub Secrets, Droplets         | 180 days           | High        |
| Redis passwords    | DO Managed Redis, GitHub Secrets | 90 days            | Medium      |
| Webhook URLs       | GitHub Secrets                   | As needed          | Low         |
| Registry tokens    | GitHub Secrets                   | 90 days            | Medium      |

## How to Add New Secrets

### Step 1: Add to .env.example (All Environments)

```bash
# In .env.example
NEW_SECRET=your_secret_value_here
```

### Step 2: Add to Application Configuration

**NestJS API** - Update validation schema:

```typescript
// apps/api/src/config/validation.schema.ts
export const validationSchema = Joi.object({
  // ... existing
  NEW_SECRET: Joi.string().required(),
});
```

### Step 3: Add to GitHub Secrets

Via GitHub UI or CLI:

```bash
gh secret set NEW_SECRET --body "actual_secret_value"
```

### Step 4: Add to Deployment Targets

**DigitalOcean Droplet:**

```bash
# Via SSH
echo "NEW_SECRET=actual_value" | sudo tee -a /opt/restomarket/.env.staging
```

**Vercel:**

```bash
vercel env add NEW_SECRET staging
# Enter value when prompted
```

### Step 5: Update Workflows

If the secret is needed in CI/CD, reference it in `.github/workflows/ci-cd.yml`:

```yaml
env:
  NEW_SECRET: ${{ secrets.NEW_SECRET }}
```

## Secret Rotation Procedures

### Rotating Database Passwords

```bash
# 1. Generate new password
NEW_PASSWORD=$(openssl rand -base64 32)

# 2. Update password in DigitalOcean console
# Settings → Users & Databases → Reset Password

# 3. Update GitHub Secret
gh secret set DATABASE_URL --body "postgresql://user:${NEW_PASSWORD}@host/db"

# 4. Update on droplet
ssh deploy@staging.example.com
sudo nano /opt/restomarket/.env.staging
# Update DATABASE_URL
docker-compose restart api

# 5. Verify application is healthy
curl https://staging-api.example.com/health
```

### Rotating API Tokens

```bash
# 1. Generate new token in provider dashboard (e.g., DigitalOcean)

# 2. Update GitHub Secret
gh secret set DO_API_TOKEN --body "new_token_value"

# 3. Test with Terraform
cd infrastructure/terraform/environments/staging
terraform plan  # Should succeed with new token

# 4. Document rotation in rotation log
echo "$(date): Rotated DO_API_TOKEN" >> docs/rotation-log.txt
```

### Rotating SSH Keys

```bash
# 1. Generate new SSH key pair
ssh-keygen -t ed25519 -C "deploy@restomarket" -f ~/.ssh/restomarket_deploy_new

# 2. Add public key to droplet
ssh-copy-id -i ~/.ssh/restomarket_deploy_new.pub deploy@staging.example.com

# 3. Test new key
ssh -i ~/.ssh/restomarket_deploy_new deploy@staging.example.com exit

# 4. Update GitHub Secret
gh secret set STAGING_SSH_KEY < ~/.ssh/restomarket_deploy_new

# 5. Remove old key from droplet
ssh deploy@staging.example.com
nano ~/.ssh/authorized_keys  # Remove old key

# 6. Test deployment with new key
gh workflow run ci-cd.yml
```

## Incident Response: Leaked Secrets

If a secret is accidentally committed or leaked:

### Step 1: Immediate Actions (Do within 15 minutes)

```bash
# 1. Revoke the secret immediately in provider dashboard
#    - DigitalOcean: Revoke API token
#    - Database: Reset password
#    - SSH: Remove key from authorized_keys

# 2. Rotate the secret (generate new one)
# 3. Update all locations where secret is used
# 4. Verify applications are functioning
```

### Step 2: Remove from Git History

```bash
# Option 1: BFG Repo Cleaner (recommended)
# Download from: https://rtyley.github.io/bfg-repo-cleaner/
java -jar bfg.jar --replace-text passwords.txt restomarket-app/
cd restomarket-app
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Option 2: git-filter-repo
pip install git-filter-repo
git filter-repo --path apps/api/.env --invert-paths
```

### Step 3: Force Push (Coordinate with Team)

```bash
# WARNING: This rewrites history
git push origin --force --all
git push origin --force --tags
```

### Step 4: Audit and Document

```bash
# 1. Document incident
echo "$(date): Leaked secret: [type], Action: Rotated" >> docs/security-incidents.log

# 2. Review who had access
# 3. Update access controls if needed
# 4. Review and improve detection (pre-commit hooks)
```

## Pre-commit Hook for Secret Detection

Install and configure:

```bash
# Install pre-commit
pip install pre-commit

# Install hooks
pre-commit install

# Test
pre-commit run --all-files

# Test with fake secret
echo "AWS_SECRET=AKIAIOSFODNN7EXAMPLE" > test.txt
git add test.txt
git commit -m "test"  # Should be blocked
```

If a false positive occurs:

```bash
# Add to .gitleaks.toml allowlist
# Then retry commit
git commit -m "your message"
```

## Verifying No Secrets in Repository

```bash
# Run gitleaks
gitleaks detect --source . --verbose

# Search for common patterns
git log -p | grep -i "password\|secret\|token\|api_key" | less

# Check current files
grep -r -i "password\|secret\|token" --include=*.env --exclude-dir=node_modules .
```

## Access Control

### Who Has Access to What

| Secret Type          | Developers | CI/CD | Staging | Production |
| -------------------- | ---------- | ----- | ------- | ---------- |
| Local .env           | ✅         | ❌    | ❌      | ❌         |
| GitHub Secrets       | ❌\*       | ✅    | ✅      | ✅         |
| DigitalOcean Console | ❌\*       | ❌    | ✅      | ✅         |
| Droplet env vars     | ❌         | ✅    | ✅      | ✅         |

\* Admin access only

### Granting Access

**GitHub Secrets:**

- Only repository admins can view/edit secrets
- Use environment protection rules for production

**DigitalOcean:**

- Use Teams feature to grant limited access
- Use read-only access where possible

**SSH Access:**

- Each user has their own SSH key
- Keys are added to authorized_keys individually
- Keys can be revoked without affecting others

## Audit Logs

### Viewing Access Logs

**GitHub:**

- Settings → Security → Audit log
- Filter by "secret" actions

**DigitalOcean:**

- API → Activity → API calls
- Droplet → Access → SSH logs

**Application Logs:**

```bash
# View who accessed secrets via SSH
sudo last -f /var/log/wtmp

# View sudo actions
sudo grep sudo /var/log/auth.log

# View systemd service access
sudo journalctl -u restomarket-api | grep "Environment"
```

## Best Practices

1. ✅ **Use .env.example templates** - Always provide examples
2. ✅ **Automate rotation** - Calendar reminders every 90 days
3. ✅ **Least privilege** - Grant minimal necessary access
4. ✅ **Audit regularly** - Review access logs monthly
5. ✅ **Separate by environment** - Dev, staging, prod have different secrets
6. ✅ **Use secret managers** - Never hardcode secrets
7. ✅ **Encrypt at rest** - Use platform encryption features
8. ✅ **Monitor for leaks** - Use pre-commit hooks and CI scans
9. ✅ **Document everything** - Keep this guide updated
10. ✅ **Test rotation** - Verify apps work after rotation

## Prohibited Practices

1. ❌ **Never commit .env files** - Use .gitignore
2. ❌ **Never share secrets in Slack/email** - Use secure vaults
3. ❌ **Never log secrets** - Redact from application logs
4. ❌ **Never put secrets in Docker images** - Use runtime injection
5. ❌ **Never reuse secrets** - Each environment has unique values
6. ❌ **Never use weak passwords** - Minimum 32 characters for tokens

## Tools and Resources

- **gitleaks**: https://github.com/gitleaks/gitleaks
- **pre-commit**: https://pre-commit.com/
- **1Password**: Team password manager (recommended)
- **HashiCorp Vault**: For advanced secret management (future consideration)
- **GitHub Advanced Security**: Automated secret scanning

## Questions?

Contact the DevOps team or create an issue for secret management questions.
