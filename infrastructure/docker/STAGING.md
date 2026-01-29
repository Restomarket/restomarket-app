# Docker Compose Staging-like Testing

This guide explains how to use `docker-compose.staging.yml` to test production builds locally in a staging-like environment.

## Overview

The staging compose configuration differs from development:

| Feature          | Development (`docker-compose.yml`) | Staging (`docker-compose.staging.yml`)   |
| ---------------- | ---------------------------------- | ---------------------------------------- |
| **Docker Image** | `dependencies` stage (dev deps)    | `production` stage (runtime only)        |
| **Hot Reload**   | ✅ Enabled via volume mounts       | ❌ Disabled - testing production image   |
| **NODE_ENV**     | `development`                      | `production`                             |
| **Swagger Docs** | ✅ Enabled                         | ❌ Disabled                              |
| **Log Level**    | `debug`                            | `info`                                   |
| **Network**      | `restomarket-network`              | `restomarket-staging-network` (isolated) |
| **Ports**        | API: 3001, DB: 5432, Redis: 6379   | API: 3002, DB: 5433, Redis: 6380         |
| **Command**      | `pnpm --filter api dev`            | `node apps/api/dist/main.js`             |

## Quick Start

### 1. Create Environment File

```bash
# Copy the example file
cp .env.staging.example .env.staging

# Edit with your preferred editor
nano .env.staging  # or vim, code, etc.
```

### 2. Build Production Image

```bash
# Build the production image
docker-compose -f docker-compose.staging.yml build

# This will:
# - Run all 5 stages of the Dockerfile
# - Compile TypeScript with Turborepo
# - Install only production dependencies
# - Create minimal runtime image
```

### 3. Start Services

```bash
# Start all services in detached mode
docker-compose -f docker-compose.staging.yml up -d

# Or start with logs visible
docker-compose -f docker-compose.staging.yml up
```

### 4. Verify Deployment

```bash
# Check service status
docker-compose -f docker-compose.staging.yml ps

# Check API health
curl http://localhost:3002/health

# Expected response:
# {
#   "status": "healthy",
#   "uptime": 123,
#   "timestamp": "2026-01-29T...",
#   "services": {
#     "database": "connected",
#     "redis": "connected"
#   }
# }
```

## Common Operations

### View Logs

```bash
# All services
docker-compose -f docker-compose.staging.yml logs -f

# Specific service
docker-compose -f docker-compose.staging.yml logs -f api-staging

# Last 50 lines
docker-compose -f docker-compose.staging.yml logs --tail=50 api-staging
```

### Stop Services

```bash
# Stop all services (preserves data)
docker-compose -f docker-compose.staging.yml stop

# Stop specific service
docker-compose -f docker-compose.staging.yml stop api-staging
```

### Restart Services

```bash
# Restart all services
docker-compose -f docker-compose.staging.yml restart

# Restart API only
docker-compose -f docker-compose.staging.yml restart api-staging
```

### Cleanup

```bash
# Stop and remove containers (preserves volumes)
docker-compose -f docker-compose.staging.yml down

# Remove containers AND volumes (fresh start)
docker-compose -f docker-compose.staging.yml down -v

# Remove everything including images
docker-compose -f docker-compose.staging.yml down -v --rmi all
```

## Database Operations

### Access PostgreSQL

```bash
# Using Adminer web UI
open http://localhost:8081

# Credentials:
# System: PostgreSQL
# Server: postgres-staging
# Username: postgres
# Password: (from .env.staging)
# Database: restomarket_staging

# Using psql CLI
docker exec -it restomarket-postgres-staging psql -U postgres -d restomarket_staging
```

### Run Migrations

```bash
# Option 1: From host (recommended for development)
DATABASE_URL="postgresql://postgres:password@localhost:5433/restomarket_staging" \
  pnpm --filter api db:migrate

# Option 2: Inside container
docker exec -it restomarket-api-staging sh
# Then inside container:
pnpm --filter api db:migrate
```

### Backup Database

```bash
# Export to SQL file
docker exec -t restomarket-postgres-staging pg_dump -U postgres restomarket_staging > backup_staging.sql

# Restore from SQL file
cat backup_staging.sql | docker exec -i restomarket-postgres-staging psql -U postgres -d restomarket_staging
```

## Redis Operations

### Access Redis CLI

```bash
# Connect to Redis
docker exec -it restomarket-redis-staging redis-cli -a redis_staging

# Inside redis-cli:
> PING
PONG

> KEYS *
(list of all keys)

> GET some_key
(value)

> FLUSHALL  # Clear all data (use with caution!)
OK
```

## Testing Procedures

### Test Production Build

1. **Build the image**:

   ```bash
   docker-compose -f docker-compose.staging.yml build --no-cache
   ```

2. **Check image size**:

   ```bash
   docker images restomarket-api:staging
   # Should be < 200MB
   ```

3. **Start services**:

   ```bash
   docker-compose -f docker-compose.staging.yml up -d
   ```

4. **Verify health**:

   ```bash
   curl http://localhost:3002/health
   ```

5. **Test API endpoints**:
   ```bash
   # Note: Swagger is disabled in staging, test endpoints directly
   curl http://localhost:3002/api/v1/health
   curl http://localhost:3002/api/v1/users  # If exists
   ```

### Test Startup Time

```bash
# Clean start
docker-compose -f docker-compose.staging.yml down -v
docker-compose -f docker-compose.staging.yml up -d

# Monitor startup
docker-compose -f docker-compose.staging.yml logs -f api-staging

# Should be healthy within 60 seconds
```

### Test Zero-Downtime Updates

Simulate production deployment:

```bash
# 1. Initial deployment
docker-compose -f docker-compose.staging.yml up -d

# 2. Make code change and rebuild
docker-compose -f docker-compose.staging.yml build api-staging

# 3. Update with zero-downtime (rolling update)
docker-compose -f docker-compose.staging.yml up -d --no-deps api-staging

# 4. Verify health immediately
curl http://localhost:3002/health
```

## Troubleshooting

### API Container Exits Immediately

**Symptoms:**

```bash
docker-compose -f docker-compose.staging.yml ps
# Shows api-staging as "Exit 1"
```

**Solutions:**

1. Check build logs:

   ```bash
   docker-compose -f docker-compose.staging.yml logs api-staging
   ```

2. Verify production build works:

   ```bash
   docker-compose -f docker-compose.staging.yml build api-staging
   ```

3. Test image directly:
   ```bash
   docker run --rm restomarket-api:staging node --version
   ```

### Health Check Failing

**Symptoms:**

```bash
docker inspect restomarket-api-staging | jq '.[0].State.Health.Status'
# Shows "unhealthy"
```

**Solutions:**

1. Check if port is correct:

   ```bash
   docker-compose -f docker-compose.staging.yml exec api-staging curl localhost:3002/health
   ```

2. Verify database connectivity:

   ```bash
   docker-compose -f docker-compose.staging.yml exec api-staging sh
   # Inside container:
   curl http://localhost:3002/health | jq
   ```

3. Check logs for errors:
   ```bash
   docker-compose -f docker-compose.staging.yml logs api-staging | grep -i error
   ```

### Port Conflicts

**Symptoms:**

```
Error starting userland proxy: listen tcp4 0.0.0.0:3002: bind: address already in use
```

**Solutions:**

1. Change ports in `.env.staging`:

   ```bash
   API_PORT=3003
   POSTGRES_PORT=5434
   REDIS_PORT=6381
   ```

2. Or stop conflicting service:
   ```bash
   # Find process using port
   lsof -i :3002
   # Stop it
   kill <PID>
   ```

### Running Both Dev and Staging Simultaneously

You can run both environments at the same time since they use:

- Different networks
- Different ports
- Different container names

```bash
# Terminal 1: Dev environment
docker-compose up -d

# Terminal 2: Staging environment
docker-compose -f docker-compose.staging.yml up -d

# Dev API: http://localhost:3001
# Staging API: http://localhost:3002
```

## Performance Benchmarks

Expected performance metrics:

| Metric       | Target       | Command to Verify                       |
| ------------ | ------------ | --------------------------------------- |
| Image size   | < 200MB      | `docker images restomarket-api:staging` |
| Build time   | < 5 minutes  | Time the `docker-compose build` command |
| Startup time | < 60 seconds | Monitor logs until health check passes  |
| Memory usage | < 512MB      | `docker stats restomarket-api-staging`  |

## Differences from Real Staging

This local staging-like environment differs from actual DigitalOcean staging:

| Aspect        | Local Staging-like         | Real DigitalOcean Staging           |
| ------------- | -------------------------- | ----------------------------------- |
| Database      | Local PostgreSQL container | Managed PostgreSQL (HA)             |
| Redis         | Local Redis container      | Managed Redis                       |
| SSL/TLS       | ❌ HTTP only               | ✅ HTTPS with Let's Encrypt         |
| Load Balancer | ❌ None                    | ✅ DigitalOcean Load Balancer       |
| Monitoring    | ❌ Basic Docker logs       | ✅ DigitalOcean Monitoring + Alerts |
| Backups       | ❌ Manual only             | ✅ Automated daily backups          |
| Secrets       | `.env.staging` file        | DigitalOcean environment variables  |

## Best Practices

1. **Always test production builds** before deploying to real staging
2. **Clean volumes between tests** to ensure fresh state: `down -v`
3. **Monitor resource usage** with `docker stats`
4. **Test with production-like data** (sanitized copy of real data)
5. **Verify all health checks pass** before considering deployment successful
6. **Test rollback procedures** by switching between image versions

## Next Steps

After successful local staging testing:

1. Deploy to real DigitalOcean staging (Task 21 in implementation plan)
2. Run smoke tests against staging environment
3. Monitor for 24 hours before promoting to production
4. Document any issues discovered during testing

## Related Documentation

- [Local Development Guide](./README.md)
- [Deployment Runbook](../docs/deployment-runbook.md) (when created)
- [Rollback Procedures](../docs/rollback-runbook.md) (when created)
- [Infrastructure Overview](../README.md)
