# Docker Development Environment

This directory contains Docker configuration for local development and staging-like testing.

## Quick Start

### Local Development with Hot Reload

1. **Copy environment variables:**

   ```bash
   cp .env.development.example .env.development
   ```

2. **Start all services:**

   ```bash
   docker-compose up -d
   ```

3. **View logs:**

   ```bash
   docker-compose logs -f api
   ```

4. **Stop services:**

   ```bash
   docker-compose down
   ```

5. **Stop and remove volumes (clean slate):**
   ```bash
   docker-compose down -v
   ```

## Services

### API (NestJS)

- **URL:** http://localhost:3001
- **Swagger Docs:** http://localhost:3001/api/docs
- **Health Check:** http://localhost:3001/health
- **Hot Reload:** Enabled via volume mounts

### PostgreSQL Database

- **Host:** localhost
- **Port:** 5432 (configurable via POSTGRES_PORT)
- **Database:** restomarket
- **User:** postgres
- **Password:** postgres (change in .env.development)

### Redis Cache

- **Host:** localhost
- **Port:** 6379 (configurable via REDIS_PORT)
- **Password:** redis (change in .env.development)

### Adminer (Database UI)

- **URL:** http://localhost:8080
- **Server:** postgres
- **Database:** restomarket
- **User:** postgres
- **Password:** (same as POSTGRES_PASSWORD)

## Useful Commands

### Database Operations

```bash
# Access PostgreSQL CLI
docker exec -it restomarket-postgres psql -U postgres -d restomarket

# Run migrations (from host)
pnpm --filter api db:migrate

# Generate migrations (from host)
pnpm --filter api db:generate

# Open Drizzle Studio (from host)
pnpm --filter api db:studio
```

### Redis Operations

```bash
# Access Redis CLI
docker exec -it restomarket-redis redis-cli -a redis

# Monitor Redis commands
docker exec -it restomarket-redis redis-cli -a redis MONITOR
```

### API Container Operations

```bash
# View API logs
docker logs -f restomarket-api

# Access API container shell
docker exec -it restomarket-api sh

# Restart API only
docker-compose restart api

# Rebuild API image
docker-compose build api
```

### Health Checks

```bash
# Check all service health
docker-compose ps

# Check API health endpoint
curl http://localhost:3001/health | jq

# Check PostgreSQL health
docker exec restomarket-postgres pg_isready -U postgres

# Check Redis health
docker exec restomarket-redis redis-cli -a redis ping
```

### Cleanup

```bash
# Remove stopped containers
docker-compose rm

# Remove all containers, networks, and volumes
docker-compose down -v

# Prune unused Docker resources
docker system prune -a --volumes
```

## Troubleshooting

### API won't start

1. **Check database connection:**

   ```bash
   docker logs restomarket-postgres
   docker logs restomarket-api
   ```

2. **Verify DATABASE_URL:**
   - Should be: `postgresql://postgres:postgres@postgres:5432/restomarket`
   - Host must be `postgres` (service name), not `localhost`

3. **Rebuild API container:**
   ```bash
   docker-compose build --no-cache api
   docker-compose up -d api
   ```

### Hot reload not working

1. **Verify volume mounts:**

   ```bash
   docker inspect restomarket-api | grep Mounts -A 20
   ```

2. **Check file permissions:**
   - Ensure source files are readable by the container user

3. **Restart API:**
   ```bash
   docker-compose restart api
   ```

### Database migrations fail

1. **Ensure database is healthy:**

   ```bash
   docker-compose ps postgres
   ```

2. **Run migrations from host:**
   ```bash
   # Database must be accessible on localhost:5432
   pnpm --filter api db:migrate
   ```

### Port conflicts

If ports are already in use, change them in `.env.development`:

```env
API_PORT=3002
POSTGRES_PORT=5433
REDIS_PORT=6380
ADMINER_PORT=8081
```

### Out of disk space

```bash
# Check Docker disk usage
docker system df

# Clean up unused resources
docker system prune -a --volumes
```

## Development Workflow

### Typical Development Session

1. **Start services:**

   ```bash
   docker-compose up -d
   ```

2. **Watch API logs:**

   ```bash
   docker-compose logs -f api
   ```

3. **Make code changes** - Hot reload will restart the API automatically

4. **Run migrations if needed:**

   ```bash
   pnpm --filter api db:migrate
   ```

5. **Test endpoints:**

   ```bash
   curl http://localhost:3001/health
   ```

6. **View database in Adminer:**
   - Open http://localhost:8080
   - Login with postgres credentials

7. **Stop when done:**
   ```bash
   docker-compose down
   ```

### Testing Database Changes

1. **Generate migration:**

   ```bash
   pnpm --filter api db:generate
   ```

2. **Apply migration:**

   ```bash
   pnpm --filter api db:migrate
   ```

3. **Verify in Adminer:**
   - Check tables and schema changes

4. **Rollback if needed:**
   - Reset database: `docker-compose down -v postgres`
   - Restart: `docker-compose up -d postgres`
   - Re-apply: `pnpm --filter api db:migrate`

## Network Architecture

All services run in a custom bridge network (`restomarket-network`):

- **Internal communication:** Services use service names (e.g., `postgres`, `redis`)
- **External access:** Services expose ports to localhost
- **Isolation:** Network is isolated from other Docker projects

## Volume Persistence

Data is stored in named volumes:

- `restomarket_postgres_data` - PostgreSQL data
- `restomarket_redis_data` - Redis data

These volumes persist across container restarts unless explicitly removed with `-v` flag.

## Security Notes

- **Default credentials are for development only**
- Change all passwords in `.env.development` for team environments
- Never commit `.env.development` to git (it's in `.gitignore`)
- Use `.env.development.example` as a template for team members

## Performance Tips

1. **Use named volumes** (already configured) for better I/O performance
2. **Increase Docker memory** if services are slow (Docker Desktop settings)
3. **Use Docker BuildKit** for faster builds:
   ```bash
   export DOCKER_BUILDKIT=1
   docker-compose build
   ```

## Next Steps

For staging-like testing without hot reload, see:

- `docker-compose.staging.yml` (coming in Task 6)
