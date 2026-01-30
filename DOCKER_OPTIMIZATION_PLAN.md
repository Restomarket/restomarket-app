# Docker Infrastructure Optimization Plan

## Executive Summary

Current Docker setup is **85% correct** for a Turborepo monorepo with dev/staging environments. Main issues: duplicate outdated files and potential for further image size optimization.

## Critical Actions (MUST DO)

### 1. DELETE Outdated Docker Files ❌

**Files to remove:**

```bash
# Remove entire outdated docker directory
rm -rf apps/api/docker/

# Optionally remove empty infrastructure directory
rm -rf infrastructure/docker/api/
```

**Reason:**

- `apps/api/docker/Dockerfile` is OLD and single-package (doesn't work with monorepo)
- `apps/api/docker/docker-compose.yml` is incompatible with workspace structure
- These files will confuse developers and cause build failures

### 2. Update Documentation References

After deleting `apps/api/docker/`, update any documentation that references it:

```bash
# Search for references
grep -r "apps/api/docker" .
```

## Image Size Optimizations (RECOMMENDED)

### Current Dockerfile Analysis

**Strengths:**

- ✅ Multi-stage build (5 stages)
- ✅ Separate production dependencies
- ✅ Non-root user
- ✅ Healthcheck included
- ✅ dumb-init for signal handling
- ✅ Monorepo-aware

**Potential Improvements:**

#### Option A: Add turbo prune (RECOMMENDED for production)

Benefits:

- Reduces final image size by 30-50%
- Only includes files needed for api package
- Faster builds with better caching

Implementation:

```dockerfile
# New stage after dependencies
FROM base AS pruned
COPY --from=dependencies /app .
RUN pnpm turbo prune --scope=api --docker
```

#### Option B: Optimize layer caching

Current Dockerfile copies all package.json files separately - this is good!
But could improve by:

- Copying only necessary workspace configs
- Using BuildKit cache mounts for pnpm

### Estimated Image Sizes

| Configuration    | Estimated Size | Notes              |
| ---------------- | -------------- | ------------------ |
| Current          | ~180-250MB     | Good baseline      |
| + turbo prune    | ~120-150MB     | 30-40% reduction   |
| + BuildKit cache | Same size      | Faster builds only |
| Alpine + prune   | ~100-120MB     | Optimal            |

## .dockerignore Optimization

Current `.dockerignore` is **already excellent**! Key exclusions:

- ✅ `.git`, `.github`, `.husky` (CI/CD files)
- ✅ `test`, `__tests__`, `*.spec.ts` (test files)
- ✅ `.env`, `.env.*` (environment files)
- ✅ `infrastructure` (not needed in builds)
- ✅ `.turbo`, `dist`, `.next` (build artifacts)

**No changes needed here.**

## Environment Configuration

### Development Environment (docker-compose.yml)

**Current Setup:**

```yaml
api:
  target: dependencies
  volumes:
    - ./apps/api/src:/app/apps/api/src
    - ./packages:/app/packages
  command: pnpm --filter api dev
```

**Status:** ✅ Perfect for development

- Hot reload works
- Fast iteration
- Proper volume mounts

### Staging Environment (docker-compose.staging.yml)

**Current Setup:**

```yaml
api-staging:
  target: production
  # No volume mounts
  command: node apps/api/dist/main.js
```

**Status:** ✅ Perfect for testing production builds

- Tests actual production image
- No hot reload (as intended)
- Isolated from dev environment

## Build Performance Improvements

### Use BuildKit (Recommended)

Enable Docker BuildKit for faster, more efficient builds:

```bash
# Set in environment
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

# Or in docker-compose.yml
# Add to top of file:
# version: '3.8'
# services:
#   api:
#     build:
#       context: .
#       dockerfile: apps/api/Dockerfile
#       cache_from:
#         - restomarket-api:latest
```

### Parallel Builds

Current `docker-compose.yml` only builds API. If you add more services (web), build in parallel:

```bash
docker-compose build --parallel
```

## Multi-Platform Support (Future)

For production deployment to different architectures:

```dockerfile
# At top of Dockerfile
# Supports both AMD64 (servers) and ARM64 (Apple Silicon)
FROM --platform=$BUILDPLATFORM node:20.18.1-alpine AS base
```

Build command:

```bash
docker buildx build --platform linux/amd64,linux/arm64 \
  -f apps/api/Dockerfile \
  -t restomarket-api:latest .
```

## Security Improvements

Current Dockerfile **already includes** excellent security practices:

- ✅ Non-root user (nestjs:nodejs)
- ✅ Alpine base image (minimal attack surface)
- ✅ No secrets in image
- ✅ Healthcheck for container orchestration
- ✅ dumb-init for proper process management

**Additional optional hardening:**

```dockerfile
# Add at production stage
RUN apk --no-cache add ca-certificates && \
    rm -rf /var/cache/apk/*

# Drop capabilities
USER nestjs:nodejs
WORKDIR /app/apps/api

# Read-only root filesystem (advanced)
# Would require additional volume mounts for /tmp
```

## Recommended Action Items

### Immediate (This Week)

- [ ] **DELETE** `apps/api/docker/` directory
- [ ] Verify both docker-compose files work after deletion
- [ ] Update any documentation referencing old docker directory
- [ ] Test dev environment: `docker-compose up --build`
- [ ] Test staging environment: `docker-compose -f docker-compose.staging.yml up --build`

### Short-term (Next Sprint)

- [ ] Add turbo prune stage to Dockerfile for smaller images
- [ ] Enable BuildKit for faster builds
- [ ] Document expected image sizes and build times
- [ ] Create `.env.development.example` and `.env.staging.example` if missing

### Long-term (Future)

- [ ] Multi-platform builds for different architectures
- [ ] CI/CD integration for automated builds
- [ ] Layer caching in CI/CD with BuildKit
- [ ] Consider docker-compose.prod.yml for actual production (DigitalOcean App Platform)

## Testing Checklist

After making changes, verify:

```bash
# 1. Clean slate
docker-compose down -v
docker-compose -f docker-compose.staging.yml down -v

# 2. Build dev environment
docker-compose build --no-cache
docker-compose up -d

# 3. Verify dev API
curl http://localhost:3000/health
# Should show: {"status":"healthy",...}

# 4. Check hot reload
# Edit apps/api/src/modules/health/health.controller.ts
# Watch logs: docker-compose logs -f api
# Should see reload message

# 5. Stop dev
docker-compose down

# 6. Build staging environment
docker-compose -f docker-compose.staging.yml build --no-cache
docker-compose -f docker-compose.staging.yml up -d

# 7. Verify staging API
curl http://localhost:3002/health

# 8. Check image sizes
docker images restomarket-api

# 9. Check resource usage
docker stats --no-stream

# 10. Cleanup
docker-compose down
docker-compose -f docker-compose.staging.yml down -v
```

## Summary Table

| Component                    | Status       | Action Required           |
| ---------------------------- | ------------ | ------------------------- |
| `docker-compose.yml`         | ✅ Excellent | None                      |
| `docker-compose.staging.yml` | ✅ Excellent | None                      |
| `apps/api/Dockerfile`        | ✅ Good      | Optional: Add turbo prune |
| `apps/api/docker/*`          | ❌ DELETE    | **Remove immediately**    |
| `.dockerignore`              | ✅ Excellent | None                      |
| `infrastructure/docker/api/` | 🤷 Empty     | Optional: Remove          |
| Documentation                | ✅ Good      | Update after deletions    |

## Questions for Consideration

1. **Do you plan to add a web service to docker-compose?**
   - If yes, create `apps/web/Dockerfile` following same pattern

2. **Will you deploy to DigitalOcean App Platform?**
   - If yes, may need separate `docker-compose.prod.yml`
   - App Platform can auto-detect Dockerfile

3. **Do you need multi-platform builds?**
   - For ARM64 (Apple Silicon) dev machines?
   - For different production architectures?

4. **Image size priority?**
   - If < 150MB is important, implement turbo prune
   - Current ~180-250MB is already good for most cases

## Conclusion

**Overall Grade: A- (85/100)**

Your Docker setup is well-architected for a Turborepo monorepo with proper separation of dev/staging environments. Main issue is the presence of outdated duplicate files that should be deleted.

After removing `apps/api/docker/`, your grade would be: **A (90/100)**

With turbo prune optimization: **A+ (95/100)**
