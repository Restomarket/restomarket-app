# Deployment Runbook

> **Purpose:** Step-by-step procedures for deployments, rollbacks, and incident response for RestoMarket API infrastructure.

**Last Updated:** 2026-01-29
**Maintainers:** DevOps Team
**Escalation Contact:** [Your escalation contact here]

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Normal Deployment Procedures](#normal-deployment-procedures)
4. [Rollback Procedures](#rollback-procedures)
5. [Emergency Procedures](#emergency-procedures)
6. [Troubleshooting](#troubleshooting)
7. [Monitoring and Alerts](#monitoring-and-alerts)
8. [Post-Deployment Verification](#post-deployment-verification)
9. [Contact Information](#contact-information)

---

## Overview

RestoMarket uses a **blue-green deployment strategy** with zero-downtime deployments. All deployments are automated via GitHub Actions for staging and can be triggered manually for production.

**Environments:**

- **Dev**: Local development (Docker Compose)
- **Staging**: Pre-production testing (DigitalOcean Droplets + Load Balancer)
- **Production**: Live environment (not yet configured)

**Deployment Methods:**

1. **Automated CI/CD** (Recommended for staging)
2. **Manual SSH Deployment** (Emergency or testing)
3. **Ansible Playbook** (Batch deployments)

---

## Prerequisites

Before performing any deployment, ensure you have:

- [ ] SSH access to target droplet(s)
- [ ] Docker registry credentials (GitHub Container Registry)
- [ ] VPN or admin IP whitelisted for SSH access
- [ ] Slack webhook configured for notifications
- [ ] Access to monitoring dashboards (DigitalOcean)
- [ ] Recent backup confirmed (database)
- [ ] Rollback plan identified (previous image SHA)

**Required Tools:**

```bash
# Verify tools are installed
which ssh      # SSH client
which docker   # Docker CLI (for local testing)
which ansible  # Ansible (for batch deployments)
which git      # Git (for SHA tracking)
```

---

## Normal Deployment Procedures

### Method 1: Automated Deployment via GitHub Actions (Recommended)

**Staging Environment:**

1. **Trigger Deployment:**

   ```bash
   # Push to develop branch
   git checkout develop
   git pull origin develop
   git push origin develop
   ```

2. **Monitor Deployment:**
   - Go to GitHub Actions: https://github.com/{org}/restomarket-app/actions
   - Watch the `CI/CD` workflow
   - Jobs will run: code-quality → test → build → docker-build → deploy-staging

3. **Verify Deployment:**

   ```bash
   # Check health endpoint
   curl -f https://staging-api.example.com/health

   # Expected response:
   # {"status":"healthy","uptime":123,"timestamp":"2026-01-29T...","services":{"database":"connected","redis":"connected"}}
   ```

4. **Monitor Logs:**

   ```bash
   # SSH to staging droplet
   ssh deploy@<staging-ip>

   # View API logs
   docker logs api-green --tail 100 -f
   # OR
   docker logs api-blue --tail 100 -f
   ```

5. **Verify in Slack:**
   - Check `#deployments` channel for success notification
   - Notification includes: commit SHA, author, deployment time, health check URL

**Production Environment (Manual Approval Required):**

> Production deployments are not yet configured. When ready, deployments to production will require manual approval in GitHub Actions.

---

### Method 2: Manual SSH Deployment (Emergency)

**When to Use:**

- CI/CD pipeline is down
- Emergency hotfix needed immediately
- Testing deployment scripts

**Steps:**

1. **SSH to Target Droplet:**

   ```bash
   ssh deploy@<droplet-ip>
   cd /opt/app
   ```

2. **Log in to Docker Registry:**

   ```bash
   # Use GitHub Personal Access Token with packages:read scope
   echo $GITHUB_TOKEN | docker login ghcr.io -u <username> --password-stdin
   ```

3. **Identify Target Image:**

   ```bash
   # List recent images in registry
   docker pull ghcr.io/<org>/restomarket-api:main
   docker images ghcr.io/<org>/restomarket-api --format "table {{.Tag}}\t{{.CreatedAt}}\t{{.Size}}"

   # Choose image by SHA or branch tag:
   # - sha-abc1234 (specific commit)
   # - main-abc1234 (main branch + commit)
   # - develop-abc1234 (develop branch + commit)
   ```

4. **Run Deployment Script:**

   ```bash
   # Download deployment script (if not present)
   curl -o deploy.sh https://raw.githubusercontent.com/<org>/restomarket-app/main/infrastructure/scripts/deploy.sh
   chmod +x deploy.sh

   # Run deployment
   ./deploy.sh ghcr.io/<org>/restomarket-api:sha-abc1234 staging
   ```

5. **Monitor Deployment:**

   ```bash
   # Script will:
   # - Pull new image
   # - Start new container (blue or green)
   # - Wait for health check (60s timeout)
   # - Stop old container
   # - Clean up old images

   # Watch logs in real-time (separate terminal)
   watch -n 2 'docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"'
   ```

6. **Verify Success:**

   ```bash
   # Check health endpoint
   curl http://localhost:3001/health

   # Verify new container is running
   docker ps --filter "name=api-" --format "table {{.Names}}\t{{.Image}}\t{{.Status}}"
   ```

---

### Method 3: Ansible Playbook Deployment (Batch)

**When to Use:**

- Deploying to multiple droplets simultaneously
- Orchestrated deployments across environments
- Scheduled maintenance deployments

**Steps:**

1. **Update Inventory:**

   ```bash
   cd infrastructure/ansible

   # Verify inventory
   cat inventory/staging.yml
   ```

2. **Set Required Variables:**

   ```bash
   # Export Docker registry credentials
   export DOCKER_REGISTRY_TOKEN="<github-token>"

   # Or pass via command line (see below)
   ```

3. **Run Playbook:**

   ```bash
   # Deploy to all staging droplets
   ansible-playbook playbooks/update-api.yml \
     -i inventory/staging.yml \
     -e "image_tag=sha-abc1234" \
     -e "environment=staging" \
     -e "docker_registry_token=$DOCKER_REGISTRY_TOKEN"

   # Deploy to single droplet
   ansible-playbook playbooks/update-api.yml \
     -i inventory/staging.yml \
     -e "image_tag=sha-abc1234" \
     -e "environment=staging" \
     -e "docker_registry_token=$DOCKER_REGISTRY_TOKEN" \
     --limit api-staging-01
   ```

4. **Monitor Playbook Execution:**
   - Playbook will run tasks sequentially on each host
   - Watch for any `FAILED` tasks (automatic rollback will trigger)
   - Playbook completes when all droplets are healthy

5. **Verify All Droplets:**
   ```bash
   # Check health on all droplets
   for host in api-staging-01 api-staging-02; do
     echo "=== $host ==="
     ssh deploy@$host 'curl -s http://localhost:3001/health | jq'
   done
   ```

---

## Rollback Procedures

### When to Rollback

Rollback immediately if:

- Health checks fail after deployment
- Application errors spike (>5% error rate)
- Critical functionality broken (reported by users or smoke tests)
- Database migrations fail or cause data issues
- Performance degrades significantly (>50% latency increase)

### Method 1: Automated Rollback (GitHub Actions)

**Automatic Rollback:**

- CI/CD pipeline automatically rolls back if health checks fail
- Rollback happens within deployment job
- No manual intervention required
- Slack notification sent on rollback

**Manual Rollback Trigger:**
If deployment succeeded but issues discovered later:

1. **Identify Previous Commit:**

   ```bash
   git log --oneline develop -10
   # Example output:
   # abc1234 feat(api): add new feature (current - bad)
   # def5678 fix(api): bug fix (previous - good)
   ```

2. **Revert Commit:**

   ```bash
   git revert abc1234
   git push origin develop
   ```

3. **Monitor New Deployment:**
   - GitHub Actions will trigger automatically
   - Previous version (def5678) will be deployed
   - Verify in Slack notifications

---

### Method 2: Manual Rollback via SSH (Fast)

**When to Use:**

- Immediate rollback needed (<2 minutes)
- CI/CD pipeline unavailable
- Emergency production issue

**Steps:**

1. **SSH to Target Droplet:**

   ```bash
   ssh deploy@<droplet-ip>
   cd /opt/app
   ```

2. **Identify Previous Version:**

   ```bash
   # List recent local images
   docker images ghcr.io/<org>/restomarket-api --format "table {{.Tag}}\t{{.CreatedAt}}\t{{.Size}}"

   # Or check current/previous containers
   docker ps -a --filter "name=api-" --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.CreatedAt}}"
   ```

3. **Run Rollback Script:**

   ```bash
   # List available versions
   ./rollback.sh --list

   # Rollback to specific SHA
   ./rollback.sh def5678 staging

   # Script will:
   # - Pull previous image (if not local)
   # - Run zero-downtime deployment (via deploy.sh)
   # - Verify health checks
   # - Complete in <2 minutes
   ```

4. **Verify Rollback:**

   ```bash
   # Check health
   curl http://localhost:3001/health

   # Verify correct version running
   docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}"

   # Check logs for errors
   docker logs api-green --tail 50
   ```

5. **Monitor Application:**
   ```bash
   # Watch error rates in DigitalOcean monitoring
   # Check Slack alerts channel
   # Verify user-reported issues resolved
   ```

---

### Method 3: Database Rollback (If Needed)

**Caution:** Only rollback database if:

- Migration caused data corruption
- Application cannot function with new schema
- Backup is recent (<1 hour old)

**Steps:**

1. **Stop API Application:**

   ```bash
   ssh deploy@<droplet-ip>
   docker stop api-blue api-green
   ```

2. **Restore Database Backup:**

   ```bash
   # Connect to database droplet or use managed database backup
   # DigitalOcean Managed Database:
   # - Go to DigitalOcean Console
   # - Databases → restomarket-staging-db
   # - Backups tab → Select backup → Restore

   # OR manual restore from backup file:
   psql $DATABASE_URL < /backups/staging-db-2026-01-29.sql
   ```

3. **Revert Database Migrations:**

   ```bash
   # If using Drizzle migrations
   cd /opt/app
   pnpm --filter api db:rollback
   ```

4. **Start API with Previous Version:**

   ```bash
   ./rollback.sh <previous-sha> staging
   ```

5. **Verify Data Integrity:**

   ```bash
   # Run data validation queries
   psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"
   psql $DATABASE_URL -c "SELECT COUNT(*) FROM orders;"

   # Check application logs
   docker logs api-green --tail 100 | grep -i error
   ```

---

## Emergency Procedures

### Critical Production Outage

**If Production is Down (All Users Affected):**

1. **Immediate Actions (Within 1 minute):**

   ```bash
   # Check if API is responding
   curl -f https://api.example.com/health || echo "API DOWN"

   # Check if database is accessible
   ssh deploy@<prod-ip> 'docker exec api-green nc -zv <db-host> 5432'

   # Check if Redis is accessible
   ssh deploy@<prod-ip> 'docker exec api-green nc -zv <redis-host> 6379'
   ```

2. **Identify Issue (Within 2 minutes):**

   ```bash
   # Check recent deployments in GitHub Actions
   # Check container status
   ssh deploy@<prod-ip> 'docker ps -a --filter "name=api-"'

   # Check recent logs
   ssh deploy@<prod-ip> 'docker logs api-green --tail 200'
   ```

3. **Rollback Decision (Within 3 minutes):**
   - If recent deployment caused issue: **ROLLBACK immediately**
   - If infrastructure issue (DB, Redis): **Check service status**, restart if needed
   - If load issue: **Scale horizontally** (add droplets) or **Scale vertically** (resize droplets)

4. **Execute Rollback (Within 5 minutes):**

   ```bash
   # Fast rollback to last known good version
   ssh deploy@<prod-ip>
   cd /opt/app
   ./rollback.sh <last-good-sha> production
   ```

5. **Communicate (Within 5 minutes):**
   - Post in `#incidents` Slack channel
   - Update status page (if available)
   - Notify stakeholders

6. **Monitor Recovery (Within 10 minutes):**

   ```bash
   # Verify health endpoint
   watch -n 5 'curl -s https://api.example.com/health | jq'

   # Monitor error rates in DigitalOcean
   # Monitor user reports in support channels
   ```

---

### Partial Outage (Some Users Affected)

**If Some Requests Are Failing (>5% Error Rate):**

1. **Identify Scope:**

   ```bash
   # Check error rates by endpoint
   ssh deploy@<droplet-ip> 'docker logs api-green --tail 500 | grep -i error | head -20'

   # Check if specific droplet is having issues (if multiple droplets)
   # Test load balancer health checks
   curl https://<load-balancer-ip>/health
   ```

2. **Isolate Problem Droplet:**

   ```bash
   # If one droplet is unhealthy, remove from load balancer
   # Via DigitalOcean Console:
   # Load Balancers → restomarket-staging-lb → Droplets → Remove unhealthy droplet

   # OR via Terraform (if configured)
   # Update droplet tags to exclude from LB
   ```

3. **Investigate and Fix:**

   ```bash
   # SSH to problem droplet
   ssh deploy@<droplet-ip>

   # Check disk space
   df -h

   # Check memory usage
   free -h

   # Check CPU usage
   top -n 1

   # Check Docker container status
   docker ps -a
   docker stats --no-stream
   ```

4. **Resolve or Replace:**
   - If fixable: Restart container, clear disk space, etc.
   - If not fixable: Terminate droplet, create new one via Terraform

---

### Database Connection Issues

**If API Cannot Connect to Database:**

1. **Check Database Status:**

   ```bash
   # DigitalOcean Managed Database:
   # Go to Console → Databases → restomarket-staging-db
   # Check "Status" indicator

   # OR test connection manually
   psql $DATABASE_URL -c "SELECT 1;"
   ```

2. **Check Firewall Rules:**

   ```bash
   # Verify API droplet can reach database
   ssh deploy@<droplet-ip> 'nc -zv <db-host> 5432'

   # Check firewall rules in DigitalOcean Console
   # Networking → Firewalls → restomarket-staging-db-firewall
   # Ensure API droplet tag is in inbound rules
   ```

3. **Check Connection Pool:**

   ```bash
   # If using connection pooling
   # Check pool status in DigitalOcean Console
   # Databases → Connection Pools → restomarket-pool

   # Verify pool size and mode (transaction/session/statement)
   ```

4. **Restart API if Needed:**

   ```bash
   ssh deploy@<droplet-ip>
   docker restart api-green

   # Monitor logs
   docker logs api-green -f
   ```

---

## Troubleshooting

### Common Issues and Solutions

#### Issue: Health Check Failing After Deployment

**Symptoms:**

- `/health` endpoint returns 503
- Deployment script times out waiting for health check

**Diagnosis:**

```bash
# Check container logs
docker logs api-green --tail 100

# Common causes:
# - Database migration failed
# - Database connection refused
# - Redis connection refused
# - Application crash on startup
```

**Solutions:**

1. **If database migration failed:**

   ```bash
   # Check migration status
   docker exec api-green pnpm --filter api db:studio

   # Manually run migrations
   docker exec api-green pnpm --filter api db:migrate
   ```

2. **If database connection refused:**

   ```bash
   # Verify DATABASE_URL environment variable
   docker exec api-green printenv | grep DATABASE_URL

   # Test connection from container
   docker exec api-green nc -zv <db-host> 5432

   # Check firewall rules (see Database Connection Issues above)
   ```

3. **If application crash:**

   ```bash
   # Check logs for stack trace
   docker logs api-green --tail 200

   # Common fixes:
   # - Rollback to previous version
   # - Fix environment variables
   # - Fix configuration files
   ```

---

#### Issue: Deployment Script Exits with Error

**Symptoms:**

- `deploy.sh` script exits with error code
- New container fails to start

**Diagnosis:**

```bash
# Check script output
./deploy.sh <image> <env> 2>&1 | tee deploy.log

# Check Docker daemon
docker ps
docker version
```

**Solutions:**

1. **If image pull fails:**

   ```bash
   # Verify registry credentials
   docker login ghcr.io -u <username>

   # Check if image exists in registry
   docker pull <image>
   ```

2. **If port conflict:**

   ```bash
   # Check what's using port 3001
   sudo lsof -i :3001

   # Stop conflicting service
   docker stop <container-name>
   ```

3. **If disk space full:**

   ```bash
   # Check disk space
   df -h

   # Clean up old images
   ./cleanup-images.sh --keep 3

   # Clean up Docker system
   docker system prune -a --force
   ```

---

#### Issue: Rollback Script Fails

**Symptoms:**

- `rollback.sh` cannot find previous image
- Rollback times out

**Diagnosis:**

```bash
# Check available images
docker images ghcr.io/<org>/restomarket-api

# Check if deploy.sh exists
ls -la /opt/app/deploy.sh
```

**Solutions:**

1. **If image not found locally:**

   ```bash
   # Pull image from registry
   docker pull ghcr.io/<org>/restomarket-api:<tag>

   # Then run rollback
   ./rollback.sh <tag> <env>
   ```

2. **If deploy.sh missing:**
   ```bash
   # Download script
   curl -o deploy.sh https://raw.githubusercontent.com/<org>/restomarket-app/main/infrastructure/scripts/deploy.sh
   chmod +x deploy.sh
   ```

---

#### Issue: High Memory Usage

**Symptoms:**

- API container using >90% memory
- Application becomes unresponsive

**Diagnosis:**

```bash
# Check container memory usage
docker stats --no-stream api-green

# Check memory leaks in logs
docker logs api-green | grep -i "memory\|heap"
```

**Solutions:**

1. **Restart container:**

   ```bash
   docker restart api-green
   ```

2. **Scale vertically (if persistent):**

   ```bash
   # Resize droplet in DigitalOcean Console
   # Droplets → restomarket-staging-01 → Resize
   # Choose larger plan (e.g., s-2vcpu-4gb → s-4vcpu-8gb)
   ```

3. **Investigate memory leak:**
   ```bash
   # Review recent code changes
   # Check for memory leak patterns (unclosed connections, large arrays)
   # Add memory profiling to application
   ```

---

## Monitoring and Alerts

### Health Check Monitoring

**Load Balancer Health Checks:**

- Configured to check `/health` endpoint every 10 seconds
- Removes droplet from LB if 3 consecutive checks fail
- Re-adds droplet if 2 consecutive checks pass

**Manual Health Check:**

```bash
# Staging
curl -f https://staging-api.example.com/health

# Expected response:
# {"status":"healthy","uptime":12345,"timestamp":"...","services":{"database":"connected","redis":"connected"}}

# Production
curl -f https://api.example.com/health
```

---

### DigitalOcean Monitoring Alerts

**Configured Alerts (Staging):**

1. **CPU Alert**: Triggers if CPU > 80% for 5 minutes
2. **Memory Alert**: Triggers if memory > 85% for 5 minutes
3. **Disk Alert**: Triggers if disk > 90%
4. **Load Average Alert**: Triggers if load > 3 for 5 minutes

**Alert Channels:**

- Email: [Your email]
- Slack: `#alerts` channel (if configured)

**Viewing Alerts:**

```bash
# Via DigitalOcean Console:
# Monitoring → Alerts
# See active alerts and alert history

# Via CLI (if doctl installed):
doctl monitoring alert list
```

---

### Application Logs

**View Real-Time Logs:**

```bash
# SSH to droplet
ssh deploy@<droplet-ip>

# View API logs (current container)
docker logs api-green -f --tail 100

# View API logs (all containers)
docker logs -f $(docker ps --filter "name=api-" --format "{{.Names}}" | head -1)
```

**Search Logs for Errors:**

```bash
# Last 500 lines with errors
docker logs api-green --tail 500 | grep -i error

# Last hour of errors with timestamp
docker logs api-green --since 1h | grep -i error | head -20

# Count error types
docker logs api-green --tail 1000 | grep -i error | awk '{print $5}' | sort | uniq -c | sort -rn
```

**Download Logs for Analysis:**

```bash
# Download last 10,000 lines
ssh deploy@<droplet-ip> 'docker logs api-green --tail 10000' > api-logs-$(date +%Y%m%d-%H%M%S).log
```

---

### Monitoring Dashboards

**DigitalOcean Metrics:**

- Go to: DigitalOcean Console → Droplets → [Droplet] → Graphs
- Available metrics: CPU, Memory, Disk, Network

**Load Balancer Metrics:**

- Go to: DigitalOcean Console → Load Balancers → restomarket-staging-lb → Graphs
- Available metrics: Requests/sec, Response times, Health status

**Database Metrics:**

- Go to: DigitalOcean Console → Databases → restomarket-staging-db → Metrics & Logs
- Available metrics: Connections, Queries/sec, Replication lag (if HA)

**Redis Metrics:**

- Go to: DigitalOcean Console → Databases → restomarket-staging-redis → Metrics & Logs
- Available metrics: Memory usage, Connections, Commands/sec, Evictions

---

## Post-Deployment Verification

### Verification Checklist

After every deployment, verify:

- [ ] Health endpoint returns 200 OK
- [ ] Database connection successful (check health response)
- [ ] Redis connection successful (check health response)
- [ ] Application logs show no errors in last 5 minutes
- [ ] Key API endpoints respond correctly (smoke tests)
- [ ] Response times within normal range (<500ms p95)
- [ ] No spike in error rates (<1% error rate)
- [ ] Monitoring alerts silent (no active alerts)
- [ ] Slack deployment notification received
- [ ] Load balancer shows all droplets healthy (if staging)

---

### Smoke Tests

**Manual Smoke Tests:**

```bash
# Test health endpoint
curl -f https://staging-api.example.com/health

# Test API version endpoint (if available)
curl -I https://staging-api.example.com/api/v1 | grep -i "x-api-version"

# Test authentication endpoint
curl -X POST https://staging-api.example.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'

# Test public endpoints (adjust as needed)
curl https://staging-api.example.com/api/v1/products?limit=5
```

**Automated Smoke Tests (CI/CD):**

- Smoke tests run automatically after staging deployment
- Located in: `.github/workflows/ci-cd.yml` → `deploy-staging` job
- Tests verify health endpoint and response structure

---

### Performance Verification

**Response Time Check:**

```bash
# Measure response time
time curl -s https://staging-api.example.com/health

# Expected: <200ms for health endpoint
# Expected: <500ms for typical API endpoints
```

**Load Test (Optional):**

```bash
# Simple load test with Apache Bench (if installed)
ab -n 1000 -c 10 https://staging-api.example.com/health

# Expected: >100 requests/sec, 0% failed requests
```

---

## Contact Information

### Escalation Path

1. **On-Call Engineer**: [Your on-call rotation schedule]
2. **DevOps Lead**: [Name], [Email], [Phone/Slack]
3. **Engineering Manager**: [Name], [Email], [Phone/Slack]
4. **CTO**: [Name], [Email], [Phone/Slack]

### Communication Channels

- **Slack Channels**:
  - `#deployments` - Deployment notifications
  - `#incidents` - Critical incidents and outages
  - `#alerts` - Monitoring alerts
  - `#devops` - General DevOps discussion

- **Email Distribution Lists**:
  - `devops@example.com` - DevOps team
  - `engineering@example.com` - Engineering team

### External Resources

- **GitHub Repository**: https://github.com/{org}/restomarket-app
- **GitHub Actions**: https://github.com/{org}/restomarket-app/actions
- **DigitalOcean Console**: https://cloud.digitalocean.com
- **Monitoring Dashboard**: [Your monitoring dashboard URL]
- **Status Page**: [Your status page URL]

### Documentation Links

- [Infrastructure README](../README.md)
- [Terraform Documentation](../terraform/README.md)
- [Ansible Documentation](../ansible/README.md)
- [Secrets Management Guide](../../docs/SECRETS_MANAGEMENT.md)
- [Docker Documentation](../docker/README.md)

---

## Appendix: Command Reference

### Quick Command Reference

```bash
# === Deployment ===
# GitHub Actions (push to develop)
git push origin develop

# Manual SSH deployment
ssh deploy@<ip> 'cd /opt/app && ./deploy.sh <image> <env>'

# Ansible deployment
ansible-playbook playbooks/update-api.yml -i inventory/staging.yml -e "image_tag=<tag>" -e "environment=staging"

# === Rollback ===
# Fast rollback
ssh deploy@<ip> 'cd /opt/app && ./rollback.sh <previous-sha> <env>'

# List available versions
ssh deploy@<ip> 'cd /opt/app && ./rollback.sh --list'

# === Health Checks ===
# Check API health
curl -f https://staging-api.example.com/health

# Check from droplet
ssh deploy@<ip> 'curl http://localhost:3001/health'

# === Logs ===
# View real-time logs
ssh deploy@<ip> 'docker logs api-green -f --tail 100'

# Search for errors
ssh deploy@<ip> 'docker logs api-green --tail 500 | grep -i error'

# === Container Management ===
# List running containers
ssh deploy@<ip> 'docker ps --filter "name=api-"'

# Restart container
ssh deploy@<ip> 'docker restart api-green'

# View container stats
ssh deploy@<ip> 'docker stats --no-stream'

# === Image Management ===
# List local images
ssh deploy@<ip> 'docker images ghcr.io/<org>/restomarket-api'

# Clean up old images
ssh deploy@<ip> 'cd /opt/app && ./cleanup-images.sh --keep 5'

# Pull specific image
ssh deploy@<ip> 'docker pull ghcr.io/<org>/restomarket-api:<tag>'

# === System Health ===
# Check disk space
ssh deploy@<ip> 'df -h'

# Check memory
ssh deploy@<ip> 'free -h'

# Check CPU load
ssh deploy@<ip> 'uptime'

# === Database ===
# Test database connection
psql $DATABASE_URL -c "SELECT 1;"

# Run migrations
ssh deploy@<ip> 'docker exec api-green pnpm --filter api db:migrate'

# === Load Balancer (Staging) ===
# Check LB health
curl https://<load-balancer-ip>/health

# View LB status (DigitalOcean Console)
# Load Balancers → restomarket-staging-lb
```

---

**Document Version:** 1.0
**Last Reviewed:** 2026-01-29
**Next Review:** 2026-02-29
