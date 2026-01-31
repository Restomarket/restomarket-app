#!/bin/bash

################################################################################
# Zero-Downtime Deployment Script
#
# This script performs blue-green deployment of Docker containers to ensure
# zero downtime during updates. It pulls a new image, starts it alongside the
# current container, health checks the new container, and only switches traffic
# once the new container is verified healthy.
#
# Usage:
#   ./deploy.sh <image_tag> <environment>
#
# Examples:
#   ./deploy.sh ghcr.io/owner/restomarket-api:sha-abc1234 staging
#   ./deploy.sh ghcr.io/owner/restomarket-api:main production
#
# Environment Variables (optional):
#   HEALTH_CHECK_URL      - Health check endpoint (default: http://localhost:3000/health)
#   HEALTH_CHECK_TIMEOUT  - Max seconds to wait for health (default: 60)
#   HEALTH_CHECK_INTERVAL - Seconds between health checks (default: 5)
#   CONTAINER_PORT        - Container port (default: 3000)
#   HOST_PORT             - Host port (default: 3000)
#   STARTUP_WAIT          - Initial startup wait in seconds (default: 10)
#
# Application Environment Variables (passed to container):
#   DATABASE_URL          - PostgreSQL connection string (REQUIRED)
#   REDIS_URL             - Redis connection string (optional)
#   CORS_ORIGINS          - Comma-separated list of allowed origins
#   LOG_LEVEL             - Logging level (fatal, error, warn, info, debug, trace)
#   API_PREFIX            - API route prefix (default: v1)
#   EXTRA_ENV_VARS        - Additional environment variables (format: "KEY1=value1 KEY2=value2")
################################################################################

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
HEALTH_CHECK_URL="${HEALTH_CHECK_URL:-http://localhost:3000/health}"
HEALTH_CHECK_TIMEOUT="${HEALTH_CHECK_TIMEOUT:-60}"
HEALTH_CHECK_INTERVAL="${HEALTH_CHECK_INTERVAL:-5}"
CONTAINER_PORT="${CONTAINER_PORT:-3000}"
HOST_PORT="${HOST_PORT:-3000}"
STARTUP_WAIT="${STARTUP_WAIT:-10}"

# Logging functions
log_info() {
  echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warning() {
  echo -e "${YELLOW}[WARNING]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Usage information
usage() {
  cat << EOF
Usage: $0 <image_tag> <environment>

Arguments:
  image_tag     Full Docker image tag (e.g., ghcr.io/owner/restomarket-api:sha-abc1234)
  environment   Deployment environment (dev, staging, production)

Environment Variables:
  HEALTH_CHECK_URL       Health check endpoint (default: http://localhost:3000/health)
  HEALTH_CHECK_TIMEOUT   Max seconds to wait for health (default: 60)
  HEALTH_CHECK_INTERVAL  Seconds between health checks (default: 5)
  CONTAINER_PORT         Container port (default: 3000)
  HOST_PORT              Host port (default: 3000)
  STARTUP_WAIT           Initial startup wait in seconds (default: 10)

Examples:
  $0 ghcr.io/owner/restomarket-api:sha-abc1234 staging
  $0 ghcr.io/owner/restomarket-api:main production
EOF
  exit 1
}

# Validate arguments
if [ $# -ne 2 ]; then
  log_error "Invalid number of arguments"
  usage
fi

IMAGE_TAG="$1"
ENVIRONMENT="$2"

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|production)$ ]]; then
  log_error "Invalid environment: $ENVIRONMENT (must be dev, staging, or production)"
  exit 1
fi

# Container names
BLUE_CONTAINER="restomarket-api-blue"
GREEN_CONTAINER="restomarket-api-green"
CURRENT_CONTAINER=""

# Determine current running container
log_info "Checking current deployment state..."
if docker ps --filter "name=${GREEN_CONTAINER}" --format "{{.Names}}" | grep -q "${GREEN_CONTAINER}"; then
  CURRENT_CONTAINER="$GREEN_CONTAINER"
  NEW_CONTAINER="$BLUE_CONTAINER"
  log_info "Current container: ${GREEN_CONTAINER} (will deploy to ${BLUE_CONTAINER})"
elif docker ps --filter "name=${BLUE_CONTAINER}" --format "{{.Names}}" | grep -q "${BLUE_CONTAINER}"; then
  CURRENT_CONTAINER="$BLUE_CONTAINER"
  NEW_CONTAINER="$GREEN_CONTAINER"
  log_info "Current container: ${BLUE_CONTAINER} (will deploy to ${GREEN_CONTAINER})"
else
  # First deployment - no existing container
  NEW_CONTAINER="$GREEN_CONTAINER"
  log_info "No existing container found (first deployment)"
fi

# Cleanup function for rollback
cleanup_failed_deployment() {
  log_error "Deployment failed! Rolling back..."

  if [ -n "$NEW_CONTAINER" ]; then
    log_info "Stopping and removing new container: $NEW_CONTAINER"
    docker stop "$NEW_CONTAINER" 2>/dev/null || true
    docker rm "$NEW_CONTAINER" 2>/dev/null || true
  fi

  if [ -n "$CURRENT_CONTAINER" ] && docker ps -a --filter "name=${CURRENT_CONTAINER}" --format "{{.Names}}" | grep -q "${CURRENT_CONTAINER}"; then
    log_info "Current container $CURRENT_CONTAINER is still running - service not affected"
  else
    log_error "WARNING: No containers running! Service may be down!"
  fi

  exit 1
}

# Set up error handling
trap cleanup_failed_deployment ERR

# Step 1: Pull new Docker image
log_info "Pulling Docker image: $IMAGE_TAG"
if ! docker pull "$IMAGE_TAG"; then
  log_error "Failed to pull Docker image: $IMAGE_TAG"
  exit 1
fi
log_success "Successfully pulled image: $IMAGE_TAG"

# Step 2: Start new container (blue or green)
log_info "Starting new container: $NEW_CONTAINER"

# Check if container already exists (from previous failed deployment)
if docker ps -a --filter "name=${NEW_CONTAINER}" --format "{{.Names}}" | grep -q "${NEW_CONTAINER}"; then
  log_warning "Container $NEW_CONTAINER already exists, removing it first..."
  docker stop "$NEW_CONTAINER" 2>/dev/null || true
  docker rm "$NEW_CONTAINER" 2>/dev/null || true
fi

# Start new container with environment variables
# Note: Environment variables should be passed from the CI/CD workflow
log_info "Configuring container environment variables..."

# Build environment variable arguments
ENV_ARGS="-e NODE_ENV=$ENVIRONMENT"

# Add DATABASE_URL if provided
if [ -n "${DATABASE_URL:-}" ]; then
  ENV_ARGS="$ENV_ARGS -e DATABASE_URL=$DATABASE_URL"
  log_info "✓ DATABASE_URL configured"
else
  log_warning "DATABASE_URL not provided - container may fail to start!"
fi

# Add REDIS_URL if provided
if [ -n "${REDIS_URL:-}" ]; then
  ENV_ARGS="$ENV_ARGS -e REDIS_URL=$REDIS_URL"
  log_info "✓ REDIS_URL configured"
fi

# Add APP_PORT (should match CONTAINER_PORT)
ENV_ARGS="$ENV_ARGS -e APP_PORT=$CONTAINER_PORT"
log_info "✓ APP_PORT set to $CONTAINER_PORT"

# Add CORS_ORIGINS if provided
if [ -n "${CORS_ORIGINS:-}" ]; then
  ENV_ARGS="$ENV_ARGS -e CORS_ORIGINS=$CORS_ORIGINS"
  log_info "✓ CORS_ORIGINS configured"
fi

# Add LOG_LEVEL if provided
if [ -n "${LOG_LEVEL:-}" ]; then
  ENV_ARGS="$ENV_ARGS -e LOG_LEVEL=$LOG_LEVEL"
  log_info "✓ LOG_LEVEL set to $LOG_LEVEL"
fi

# Add API_PREFIX if provided (defaults to 'api' in the app)
if [ -n "${API_PREFIX:-}" ]; then
  ENV_ARGS="$ENV_ARGS -e API_PREFIX=$API_PREFIX"
fi

# Add any additional environment variables passed as EXTRA_ENV_VARS
# Format: "KEY1=value1 KEY2=value2"
if [ -n "${EXTRA_ENV_VARS:-}" ]; then
  for var in $EXTRA_ENV_VARS; do
    ENV_ARGS="$ENV_ARGS -e $var"
  done
  log_info "✓ Additional environment variables configured"
fi

# Start the container with all environment variables
if ! docker run -d \
  --name "$NEW_CONTAINER" \
  --restart unless-stopped \
  -p "${HOST_PORT}:${CONTAINER_PORT}" \
  $ENV_ARGS \
  "$IMAGE_TAG"; then
  log_error "Failed to start container: $NEW_CONTAINER"
  exit 1
fi

log_success "Started container: $NEW_CONTAINER"

# Step 3: Wait for initial startup
log_info "Waiting ${STARTUP_WAIT}s for container to initialize..."
sleep "$STARTUP_WAIT"

# Step 4: Health check loop
log_info "Starting health checks (timeout: ${HEALTH_CHECK_TIMEOUT}s, interval: ${HEALTH_CHECK_INTERVAL}s)..."
ELAPSED=0
HEALTHY=false

while [ $ELAPSED -lt "$HEALTH_CHECK_TIMEOUT" ]; do
  log_info "Health check attempt (${ELAPSED}s elapsed)..."

  # Check if container is still running
  if ! docker ps --filter "name=${NEW_CONTAINER}" --format "{{.Names}}" | grep -q "${NEW_CONTAINER}"; then
    log_error "Container $NEW_CONTAINER has stopped unexpectedly!"
    log_info "Container logs:"
    docker logs "$NEW_CONTAINER" --tail 50
    cleanup_failed_deployment
  fi

  # Perform health check
  if curl -f -s -o /dev/null -w "%{http_code}" "$HEALTH_CHECK_URL" | grep -q "200"; then
    log_success "Health check passed!"
    HEALTHY=true
    break
  else
    log_info "Health check failed, retrying in ${HEALTH_CHECK_INTERVAL}s..."
    sleep "$HEALTH_CHECK_INTERVAL"
    ELAPSED=$((ELAPSED + HEALTH_CHECK_INTERVAL))
  fi
done

# Check if health check succeeded
if [ "$HEALTHY" = false ]; then
  log_error "Health check failed after ${HEALTH_CHECK_TIMEOUT}s timeout"
  log_info "Container logs:"
  docker logs "$NEW_CONTAINER" --tail 50
  cleanup_failed_deployment
fi

# Step 5: Stop old container (if exists)
if [ -n "$CURRENT_CONTAINER" ]; then
  log_info "Stopping old container: $CURRENT_CONTAINER"

  if ! docker stop "$CURRENT_CONTAINER"; then
    log_warning "Failed to stop old container gracefully, forcing..."
    docker kill "$CURRENT_CONTAINER" || true
  fi

  log_success "Stopped old container: $CURRENT_CONTAINER"

  # Remove old container
  log_info "Removing old container: $CURRENT_CONTAINER"
  docker rm "$CURRENT_CONTAINER" || log_warning "Failed to remove old container (non-critical)"
fi

# Step 6: Cleanup old images (keep last 5)
log_info "Cleaning up old Docker images..."
OLD_IMAGES=$(docker images --filter "reference=*/restomarket-api" --format "{{.ID}}" | tail -n +6)
if [ -n "$OLD_IMAGES" ]; then
  log_info "Removing old images: $(echo "$OLD_IMAGES" | tr '\n' ' ')"
  echo "$OLD_IMAGES" | xargs docker rmi -f || log_warning "Some images could not be removed (may be in use)"
  log_success "Old images cleaned up"
else
  log_info "No old images to clean up"
fi

# Step 7: Verify deployment
log_info "Verifying deployment..."
if docker ps --filter "name=${NEW_CONTAINER}" --format "{{.Names}}" | grep -q "${NEW_CONTAINER}"; then
  log_success "✅ Deployment completed successfully!"
  log_success "Active container: $NEW_CONTAINER"
  log_success "Image: $IMAGE_TAG"
  log_success "Health check: $HEALTH_CHECK_URL"

  # Show container info
  log_info "Container details:"
  docker ps --filter "name=${NEW_CONTAINER}" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
else
  log_error "Deployment verification failed - container not running!"
  exit 1
fi

exit 0
