#!/usr/bin/env bash

#######################################
# Rollback Script - One-Command Rollback to Previous Version
#
# Usage:
#   ./rollback.sh --list                    # List recent deployments
#   ./rollback.sh <git-sha> <environment>   # Rollback to specific version
#   ./rollback.sh <image-tag> <environment> # Rollback to specific tag
#
# Examples:
#   ./rollback.sh --list
#   ./rollback.sh abc1234 staging
#   ./rollback.sh sha-abc1234 production
#   ./rollback.sh main-abc1234 staging
#
# Environment:
#   REGISTRY_URL - Docker registry URL (default: ghcr.io)
#   IMAGE_NAME - Docker image name (default: restomarket-api)
#   REGISTRY_USERNAME - Registry username (default: github account)
#   GITHUB_TOKEN - Registry authentication token (required for private repos)
#
#######################################

set -euo pipefail

# Color codes for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m' # No Color

# Configuration with defaults
readonly REGISTRY_URL="${REGISTRY_URL:-ghcr.io}"
readonly IMAGE_NAME="${IMAGE_NAME:-restomarket-api}"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly DEPLOY_SCRIPT="${SCRIPT_DIR}/deploy.sh"
readonly LOG_FILE="/var/log/rollback-$(date +%Y%m%d-%H%M%S).log"

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $*" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $*" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $*" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $*" | tee -a "$LOG_FILE"
}

# Show usage
show_usage() {
    cat << EOF
Rollback Script - One-Command Rollback to Previous Version

Usage:
    $0 --list                        List recent deployments
    $0 <git-sha> <environment>       Rollback to specific version
    $0 <image-tag> <environment>     Rollback to specific tag

Arguments:
    --list, -l              List recent deployments with their image tags
    <git-sha>              Git commit SHA (e.g., abc1234)
    <image-tag>            Full image tag (e.g., sha-abc1234, main-abc1234)
    <environment>          Target environment (dev, staging, production)

Examples:
    $0 --list
    $0 abc1234 staging
    $0 sha-abc1234 production
    $0 main-abc1234 staging

Environment Variables:
    REGISTRY_URL           Docker registry URL (default: ghcr.io)
    IMAGE_NAME            Docker image name (default: restomarket-api)
    REGISTRY_USERNAME     Registry username (for authentication)
    GITHUB_TOKEN          Registry token (required for private repos)

Notes:
    - Uses deploy.sh for zero-downtime rollback
    - Verifies deployment with health checks
    - Logs all rollback actions to /var/log/rollback-*.log
    - Lists last 10 deployments when using --list

EOF
    exit 0
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check if deploy.sh exists
    if [[ ! -f "$DEPLOY_SCRIPT" ]]; then
        log_error "Deploy script not found: $DEPLOY_SCRIPT"
        log_error "Rollback requires deploy.sh to be present in the same directory"
        exit 1
    fi

    # Check if deploy.sh is executable
    if [[ ! -x "$DEPLOY_SCRIPT" ]]; then
        log_warning "Deploy script is not executable, making it executable..."
        chmod +x "$DEPLOY_SCRIPT"
    fi

    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed or not in PATH"
        exit 1
    fi

    # Check if Docker daemon is running
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running"
        exit 1
    fi

    log_success "All prerequisites satisfied"
}

# Get registry URL with owner
get_full_registry_url() {
    local registry="${1:-$REGISTRY_URL}"
    local image_name="${2:-$IMAGE_NAME}"

    # If registry is ghcr.io, we need the username
    if [[ "$registry" == "ghcr.io" ]]; then
        if [[ -n "${REGISTRY_USERNAME:-}" ]]; then
            echo "${registry}/${REGISTRY_USERNAME}/${image_name}"
        else
            # Try to get from git remote
            local git_owner
            git_owner=$(git remote get-url origin 2>/dev/null | sed -n 's/.*github.com[:/]\([^/]*\)\/.*/\1/p' | tr '[:upper:]' '[:lower:]')
            if [[ -n "$git_owner" ]]; then
                echo "${registry}/${git_owner}/${image_name}"
            else
                log_error "Cannot determine registry owner. Set REGISTRY_USERNAME environment variable."
                exit 1
            fi
        fi
    else
        echo "${registry}/${image_name}"
    fi
}

# List recent deployments
list_recent_deployments() {
    log_info "Listing recent deployments..."

    local full_registry_url
    full_registry_url=$(get_full_registry_url)

    echo ""
    echo "Recent Deployments (Last 10 Images):"
    echo "====================================="

    # Try to list local images first
    log_info "Checking local Docker images..."
    if docker images "${full_registry_url}" --format "table {{.Tag}}\t{{.CreatedAt}}\t{{.Size}}" | head -11; then
        echo ""
        log_info "Showing local images. To see all available images in registry, use: docker search ${full_registry_url}"
    else
        log_warning "No local images found for ${full_registry_url}"
        log_info "You may need to pull images or authenticate with the registry"
    fi

    echo ""
    echo "Currently Running Container:"
    echo "==========================="

    # Show currently running container
    local running_container
    running_container=$(docker ps --filter "ancestor=${full_registry_url}" --format "table {{.Names}}\t{{.Image}}\t{{.Status}}" 2>/dev/null || echo "")

    if [[ -n "$running_container" ]]; then
        echo "$running_container"
    else
        log_warning "No running containers found for image ${full_registry_url}"
    fi

    echo ""
    echo "To rollback to a specific version, use:"
    echo "  $0 <git-sha> <environment>"
    echo ""
    echo "Examples:"
    echo "  $0 abc1234 staging         # Using Git SHA"
    echo "  $0 sha-abc1234 staging     # Using image tag"
    echo "  $0 main-abc1234 staging    # Using branch tag"
    echo ""
}

# Normalize image tag (convert git SHA to proper tag format if needed)
normalize_image_tag() {
    local input_tag="$1"

    # If it's already a proper tag format, return as-is
    if [[ "$input_tag" =~ ^(sha-|main-|develop-|latest) ]]; then
        echo "$input_tag"
        return 0
    fi

    # If it's a short SHA (6-8 chars), convert to sha- prefix
    if [[ "$input_tag" =~ ^[a-f0-9]{6,8}$ ]]; then
        echo "sha-${input_tag}"
        return 0
    fi

    # Otherwise, assume it's a branch or custom tag
    echo "$input_tag"
}

# Verify image exists
verify_image_exists() {
    local image_tag="$1"
    local full_registry_url
    full_registry_url=$(get_full_registry_url)
    local full_image="${full_registry_url}:${image_tag}"

    log_info "Verifying image exists: ${full_image}"

    # Try to pull image to verify it exists
    if docker pull "$full_image" &> /dev/null; then
        log_success "Image verified: ${full_image}"
        return 0
    else
        log_error "Image not found: ${full_image}"
        log_error "Please check:"
        log_error "  1. Image tag is correct"
        log_error "  2. You have access to the registry"
        log_error "  3. You are authenticated (docker login ${REGISTRY_URL})"
        return 1
    fi
}

# Perform rollback
perform_rollback() {
    local target_tag="$1"
    local environment="$2"

    log_info "=========================================="
    log_info "Starting rollback to: ${target_tag}"
    log_info "Environment: ${environment}"
    log_info "=========================================="

    # Normalize the tag
    local normalized_tag
    normalized_tag=$(normalize_image_tag "$target_tag")
    log_info "Normalized image tag: ${normalized_tag}"

    # Verify image exists
    if ! verify_image_exists "$normalized_tag"; then
        log_error "Rollback aborted: Image verification failed"
        exit 1
    fi

    # Get full image reference
    local full_registry_url
    full_registry_url=$(get_full_registry_url)
    local full_image="${full_registry_url}:${normalized_tag}"

    log_info "Rolling back to: ${full_image}"

    # Call deploy.sh with the target image
    log_info "Executing zero-downtime deployment with rollback image..."
    if "$DEPLOY_SCRIPT" "$full_image" "$environment"; then
        log_success "=========================================="
        log_success "Rollback completed successfully!"
        log_success "=========================================="
        log_success "Environment: ${environment}"
        log_success "Image: ${full_image}"
        log_success "Timestamp: $(date)"
        log_success "Log file: ${LOG_FILE}"

        # Show current running containers
        echo ""
        log_info "Current running containers:"
        docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"

        return 0
    else
        log_error "=========================================="
        log_error "Rollback failed!"
        log_error "=========================================="
        log_error "The deployment script returned an error"
        log_error "Check the logs above for details"
        log_error "Log file: ${LOG_FILE}"
        return 1
    fi
}

# Validate environment
validate_environment() {
    local env="$1"

    if [[ ! "$env" =~ ^(dev|staging|production)$ ]]; then
        log_error "Invalid environment: $env"
        log_error "Must be one of: dev, staging, production"
        exit 1
    fi
}

# Main function
main() {
    # Show usage if no arguments
    if [[ $# -eq 0 ]]; then
        show_usage
    fi

    # Handle --help
    if [[ "$1" == "--help" ]] || [[ "$1" == "-h" ]]; then
        show_usage
    fi

    # Check prerequisites
    check_prerequisites

    # Handle --list
    if [[ "$1" == "--list" ]] || [[ "$1" == "-l" ]]; then
        list_recent_deployments
        exit 0
    fi

    # Rollback requires 2 arguments: image tag and environment
    if [[ $# -lt 2 ]]; then
        log_error "Insufficient arguments"
        echo ""
        show_usage
    fi

    local target_tag="$1"
    local environment="$2"

    # Validate environment
    validate_environment "$environment"

    # Confirm rollback
    log_warning "You are about to rollback ${environment} environment to: ${target_tag}"
    log_warning "This will replace the currently running version with the specified version"

    read -p "Are you sure you want to proceed? (yes/no): " -r confirmation
    echo ""

    if [[ ! "$confirmation" =~ ^[Yy][Ee][Ss]$ ]]; then
        log_info "Rollback cancelled by user"
        exit 0
    fi

    # Perform rollback
    if perform_rollback "$target_tag" "$environment"; then
        exit 0
    else
        exit 1
    fi
}

# Run main function
main "$@"
