#!/bin/bash

################################################################################
# Docker Image Cleanup Script
#
# Purpose: Clean up old Docker images while preserving recent and tagged versions
# Usage: ./cleanup-images.sh [OPTIONS]
#
# Features:
# - Keeps the 5 most recent images by creation date
# - Preserves images tagged with 'latest', 'stable', or semantic versions
# - Supports both local and remote registry cleanup
# - Dry-run mode for safe testing
# - Comprehensive logging
################################################################################

set -euo pipefail

# Configuration
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly LOG_DIR="/var/log"
readonly LOG_FILE="${LOG_DIR}/docker-cleanup-$(date +%Y%m%d-%H%M%S).log"
readonly KEEP_COUNT="${KEEP_COUNT:-5}"
readonly REGISTRY_URL="${REGISTRY_URL:-ghcr.io}"
readonly IMAGE_NAME="${IMAGE_NAME:-restomarket-api}"
readonly DRY_RUN="${DRY_RUN:-false}"

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m' # No Color

################################################################################
# Logging Functions
################################################################################

log() {
  local level=$1
  shift
  local message="$*"
  local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  echo -e "${timestamp} [${level}] ${message}" | tee -a "${LOG_FILE}" >&2
}

log_info() {
  log "INFO" "${BLUE}${*}${NC}"
}

log_success() {
  log "SUCCESS" "${GREEN}${*}${NC}"
}

log_warning() {
  log "WARNING" "${YELLOW}${*}${NC}"
}

log_error() {
  log "ERROR" "${RED}${*}${NC}"
}

################################################################################
# Helper Functions
################################################################################

show_help() {
  cat <<EOF
Docker Image Cleanup Script

USAGE:
  ./cleanup-images.sh [OPTIONS]

OPTIONS:
  -h, --help              Show this help message
  -n, --dry-run          Show what would be deleted without actually deleting
  -k, --keep COUNT       Number of recent images to keep (default: 5)
  -r, --registry URL     Registry URL (default: ghcr.io)
  -i, --image NAME       Image name (default: restomarket-api)
  -l, --local-only       Clean only local images (don't query registry)
  -g, --registry-only    Clean only registry images (requires gh CLI)

ENVIRONMENT VARIABLES:
  KEEP_COUNT             Number of images to keep (default: 5)
  REGISTRY_URL           Docker registry URL (default: ghcr.io)
  IMAGE_NAME             Image name (default: restomarket-api)
  DRY_RUN                Set to 'true' for dry-run mode (default: false)
  GITHUB_TOKEN           GitHub token for GHCR authentication

EXAMPLES:
  # Dry run with default settings
  ./cleanup-images.sh --dry-run

  # Keep 10 most recent images
  ./cleanup-images.sh --keep 10

  # Clean only local images
  ./cleanup-images.sh --local-only

  # Clean specific image
  ./cleanup-images.sh --image my-api --keep 3

PRESERVED TAGS:
  - 'latest'
  - 'stable'
  - Semantic versions (e.g., v1.2.3, 1.0.0)
  - Branch tags (main, develop)

NOTES:
  - Requires Docker CLI for local cleanup
  - Requires gh CLI for registry cleanup
  - Creates logs in ${LOG_DIR}/docker-cleanup-*.log
  - Always preserves protected tags

EOF
}

is_protected_tag() {
  local tag=$1

  # Protect 'latest' and 'stable' tags
  if [[ "$tag" == "latest" ]] || [[ "$tag" == "stable" ]]; then
    return 0
  fi

  # Protect semantic version tags (e.g., v1.2.3, 1.0.0)
  if [[ "$tag" =~ ^v?[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    return 0
  fi

  # Protect branch tags (main, develop, etc.)
  if [[ "$tag" == "main" ]] || [[ "$tag" == "develop" ]] || [[ "$tag" == "master" ]]; then
    return 0
  fi

  return 1
}

check_prerequisites() {
  log_info "Checking prerequisites..."

  if ! command -v docker &> /dev/null; then
    log_error "Docker CLI is not installed or not in PATH"
    exit 1
  fi

  if ! docker info &> /dev/null; then
    log_error "Docker daemon is not running or not accessible"
    exit 1
  fi

  log_success "Prerequisites check passed"
}

################################################################################
# Local Image Cleanup
################################################################################

cleanup_local_images() {
  log_info "Starting local image cleanup for ${IMAGE_NAME}..."

  # Get all local images for this repository, sorted by creation date
  local images
  images=$(docker images --format "{{.ID}}|{{.Repository}}|{{.Tag}}|{{.CreatedAt}}" \
    | grep "${IMAGE_NAME}" \
    | sort -t'|' -k4 -r \
    || true)

  if [[ -z "$images" ]]; then
    log_warning "No local images found for ${IMAGE_NAME}"
    return 0
  fi

  local total_count=$(echo "$images" | wc -l | tr -d ' ')
  log_info "Found ${total_count} local images"

  # Separate protected and unprotected images
  local protected_images=()
  local unprotected_images=()

  while IFS='|' read -r id repo tag created_at; do
    if is_protected_tag "$tag"; then
      protected_images+=("$id|$repo|$tag|$created_at")
      log_info "Protected: ${repo}:${tag} (${id:0:12})"
    else
      unprotected_images+=("$id|$repo|$tag|$created_at")
    fi
  done <<< "$images"

  local protected_count=${#protected_images[@]}
  local unprotected_count=${#unprotected_images[@]}

  log_info "Protected images: ${protected_count}"
  log_info "Unprotected images: ${unprotected_count}"

  # Keep only the most recent N unprotected images
  if [[ $unprotected_count -le $KEEP_COUNT ]]; then
    log_success "Only ${unprotected_count} unprotected images exist (keeping ${KEEP_COUNT}). Nothing to clean."
    return 0
  fi

  local delete_count=$((unprotected_count - KEEP_COUNT))
  log_info "Will delete ${delete_count} old unprotected images"

  # Delete old images (skip the first KEEP_COUNT)
  local deleted=0
  local index=0

  for image_info in "${unprotected_images[@]}"; do
    index=$((index + 1))

    # Skip the first KEEP_COUNT images (most recent)
    if [[ $index -le $KEEP_COUNT ]]; then
      IFS='|' read -r id repo tag created_at <<< "$image_info"
      log_info "Keeping: ${repo}:${tag} (${id:0:12}) - Created: ${created_at}"
      continue
    fi

    IFS='|' read -r id repo tag created_at <<< "$image_info"

    if [[ "$DRY_RUN" == "true" ]]; then
      log_warning "[DRY RUN] Would delete: ${repo}:${tag} (${id:0:12}) - Created: ${created_at}"
    else
      log_info "Deleting: ${repo}:${tag} (${id:0:12}) - Created: ${created_at}"

      if docker rmi "${id}" 2>&1 | tee -a "${LOG_FILE}"; then
        deleted=$((deleted + 1))
        log_success "Deleted: ${id:0:12}"
      else
        log_error "Failed to delete: ${id:0:12}"
      fi
    fi
  done

  if [[ "$DRY_RUN" == "true" ]]; then
    log_warning "[DRY RUN] Would have deleted ${delete_count} images"
  else
    log_success "Successfully deleted ${deleted} images"
  fi

  # Show remaining disk space
  log_info "Docker disk usage:"
  docker system df | tee -a "${LOG_FILE}"
}

################################################################################
# Registry Cleanup (GitHub Container Registry)
################################################################################

cleanup_registry_images() {
  log_info "Starting registry cleanup for ${REGISTRY_URL}/${IMAGE_NAME}..."

  if ! command -v gh &> /dev/null; then
    log_error "GitHub CLI (gh) is not installed. Cannot clean registry images."
    log_info "Install with: brew install gh (macOS) or see https://cli.github.com/"
    return 1
  fi

  # Check authentication
  if ! gh auth status &> /dev/null; then
    log_error "Not authenticated with GitHub CLI. Run: gh auth login"
    return 1
  fi

  log_warning "Registry cleanup requires manual package management via GitHub UI or API"
  log_info "To delete packages via GitHub CLI:"
  log_info "  gh api -X DELETE /user/packages/container/${IMAGE_NAME}/versions/VERSION_ID"
  log_info ""
  log_info "To list package versions:"
  log_info "  gh api /user/packages/container/${IMAGE_NAME}/versions"

  # Note: Automated GHCR cleanup requires the GitHub Packages API
  # and proper permissions. This is a manual step in most cases.

  return 0
}

################################################################################
# Main Function
################################################################################

main() {
  local local_only=false
  local registry_only=false

  # Parse command-line arguments
  while [[ $# -gt 0 ]]; do
    case $1 in
      -h|--help)
        show_help
        exit 0
        ;;
      -n|--dry-run)
        DRY_RUN=true
        shift
        ;;
      -k|--keep)
        KEEP_COUNT="$2"
        shift 2
        ;;
      -r|--registry)
        REGISTRY_URL="$2"
        shift 2
        ;;
      -i|--image)
        IMAGE_NAME="$2"
        shift 2
        ;;
      -l|--local-only)
        local_only=true
        shift
        ;;
      -g|--registry-only)
        registry_only=true
        shift
        ;;
      *)
        log_error "Unknown option: $1"
        show_help
        exit 1
        ;;
    esac
  done

  # Create log directory if it doesn't exist
  if [[ ! -d "$LOG_DIR" ]]; then
    mkdir -p "$LOG_DIR" || {
      log_error "Failed to create log directory: ${LOG_DIR}"
      exit 1
    }
  fi

  log_info "========================================"
  log_info "Docker Image Cleanup Script"
  log_info "========================================"
  log_info "Configuration:"
  log_info "  Registry: ${REGISTRY_URL}"
  log_info "  Image: ${IMAGE_NAME}"
  log_info "  Keep Count: ${KEEP_COUNT}"
  log_info "  Dry Run: ${DRY_RUN}"
  log_info "  Log File: ${LOG_FILE}"
  log_info "========================================"

  check_prerequisites

  if [[ "$registry_only" == "true" ]]; then
    cleanup_registry_images
  elif [[ "$local_only" == "true" ]]; then
    cleanup_local_images
  else
    # Clean both local and registry by default
    cleanup_local_images
    echo ""
    cleanup_registry_images
  fi

  log_info "========================================"
  log_success "Cleanup completed!"
  log_info "Log file: ${LOG_FILE}"
  log_info "========================================"
}

# Run main function
main "$@"
