#!/usr/bin/env bash
#
# init-backend.sh - Initialize Terraform Remote State Backend
#
# This script creates and configures a DigitalOcean Spaces bucket for storing
# Terraform remote state with versioning enabled.
#
# Usage:
#   ./init-backend.sh <environment> <bucket-name> <region>
#
# Example:
#   ./init-backend.sh dev restomarket-terraform-state nyc3
#   ./init-backend.sh staging restomarket-terraform-state-staging sfo3
#
# Prerequisites:
#   - AWS CLI installed (DigitalOcean Spaces uses S3-compatible API)
#   - DigitalOcean Spaces access key and secret key configured in:
#     ~/.aws/credentials or environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
#   - doctl CLI (optional, for verification)
#
# Environment Variables:
#   AWS_ACCESS_KEY_ID       - DigitalOcean Spaces access key
#   AWS_SECRET_ACCESS_KEY   - DigitalOcean Spaces secret key
#   DO_SPACES_ENDPOINT      - Optional custom endpoint (default: derived from region)
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Usage information
usage() {
    cat << EOF
Usage: $0 <environment> <bucket-name> <region>

Initialize Terraform remote state backend using DigitalOcean Spaces.

Arguments:
  environment    Environment name (dev, staging, production)
  bucket-name    Name of the Spaces bucket to create
  region         DigitalOcean Spaces region (nyc3, sfo3, sgp1, fra1, ams3)

Example:
  $0 dev restomarket-terraform-state nyc3
  $0 staging restomarket-terraform-state-staging sfo3

Prerequisites:
  - AWS CLI installed (for S3-compatible API)
  - DigitalOcean Spaces access key and secret key configured

Environment Variables:
  AWS_ACCESS_KEY_ID       - DigitalOcean Spaces access key
  AWS_SECRET_ACCESS_KEY   - DigitalOcean Spaces secret key

For more information, see infrastructure/terraform/environments/<env>/README.md
EOF
}

# Validate arguments
if [ $# -ne 3 ]; then
    log_error "Invalid number of arguments"
    usage
    exit 1
fi

ENVIRONMENT="$1"
BUCKET_NAME="$2"
REGION="$3"

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|production)$ ]]; then
    log_error "Invalid environment: $ENVIRONMENT. Must be dev, staging, or production."
    exit 1
fi

# Validate region
if [[ ! "$REGION" =~ ^(nyc3|sfo3|sgp1|fra1|ams3)$ ]]; then
    log_error "Invalid region: $REGION. Must be nyc3, sfo3, sgp1, fra1, or ams3."
    exit 1
fi

# DigitalOcean Spaces endpoint
SPACES_ENDPOINT="${DO_SPACES_ENDPOINT:-https://${REGION}.digitaloceanspaces.com}"

log_info "============================================"
log_info "Terraform Backend Initialization"
log_info "============================================"
log_info "Environment: $ENVIRONMENT"
log_info "Bucket Name: $BUCKET_NAME"
log_info "Region: $REGION"
log_info "Endpoint: $SPACES_ENDPOINT"
log_info "============================================"
echo

# Check prerequisites
log_info "Checking prerequisites..."

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    log_error "AWS CLI not found. Please install it first:"
    echo "  macOS: brew install awscli"
    echo "  Ubuntu: sudo apt-get install awscli"
    echo "  Manual: https://aws.amazon.com/cli/"
    exit 1
fi
log_success "AWS CLI found"

# Check credentials
if [ -z "${AWS_ACCESS_KEY_ID:-}" ] || [ -z "${AWS_SECRET_ACCESS_KEY:-}" ]; then
    if [ ! -f ~/.aws/credentials ]; then
        log_error "DigitalOcean Spaces credentials not found."
        echo
        echo "Please set environment variables or configure ~/.aws/credentials:"
        echo "  export AWS_ACCESS_KEY_ID='your-spaces-access-key'"
        echo "  export AWS_SECRET_ACCESS_KEY='your-spaces-secret-key'"
        echo
        echo "Or create ~/.aws/credentials with:"
        echo "  [default]"
        echo "  aws_access_key_id = your-spaces-access-key"
        echo "  aws_secret_access_key = your-spaces-secret-key"
        exit 1
    fi
fi
log_success "Credentials configured"

echo

# Check if bucket already exists
log_info "Checking if bucket '$BUCKET_NAME' exists..."
if aws s3api head-bucket --bucket "$BUCKET_NAME" --endpoint-url "$SPACES_ENDPOINT" 2>/dev/null; then
    log_warning "Bucket '$BUCKET_NAME' already exists. Skipping creation."
    BUCKET_EXISTS=true
else
    BUCKET_EXISTS=false
    log_info "Bucket does not exist. Creating..."
fi

# Create bucket if it doesn't exist
if [ "$BUCKET_EXISTS" = false ]; then
    log_info "Creating Spaces bucket: $BUCKET_NAME"
    if aws s3api create-bucket \
        --bucket "$BUCKET_NAME" \
        --endpoint-url "$SPACES_ENDPOINT" \
        --region "$REGION" \
        --acl private 2>/dev/null; then
        log_success "Bucket created successfully"
    else
        log_error "Failed to create bucket"
        exit 1
    fi
fi

echo

# Enable versioning
log_info "Enabling versioning on bucket '$BUCKET_NAME'..."
if aws s3api put-bucket-versioning \
    --bucket "$BUCKET_NAME" \
    --endpoint-url "$SPACES_ENDPOINT" \
    --versioning-configuration Status=Enabled 2>/dev/null; then
    log_success "Versioning enabled"
else
    log_error "Failed to enable versioning"
    exit 1
fi

echo

# Verify versioning
log_info "Verifying versioning configuration..."
VERSIONING_STATUS=$(aws s3api get-bucket-versioning \
    --bucket "$BUCKET_NAME" \
    --endpoint-url "$SPACES_ENDPOINT" \
    --query 'Status' \
    --output text 2>/dev/null || echo "None")

if [ "$VERSIONING_STATUS" = "Enabled" ]; then
    log_success "Versioning is enabled"
else
    log_warning "Versioning status: $VERSIONING_STATUS"
fi

echo

# Set lifecycle policy to clean up old versions (optional)
log_info "Setting lifecycle policy for old state versions..."
LIFECYCLE_POLICY=$(cat <<EOF
{
  "Rules": [
    {
      "ID": "DeleteOldVersions",
      "Status": "Enabled",
      "NoncurrentVersionExpiration": {
        "NoncurrentDays": 90
      }
    }
  ]
}
EOF
)

# Save lifecycle policy to temporary file
TEMP_POLICY_FILE=$(mktemp)
echo "$LIFECYCLE_POLICY" > "$TEMP_POLICY_FILE"

if aws s3api put-bucket-lifecycle-configuration \
    --bucket "$BUCKET_NAME" \
    --endpoint-url "$SPACES_ENDPOINT" \
    --lifecycle-configuration file://"$TEMP_POLICY_FILE" 2>/dev/null; then
    log_success "Lifecycle policy set (deletes versions older than 90 days)"
else
    log_warning "Failed to set lifecycle policy (non-critical)"
fi

# Clean up temporary file
rm -f "$TEMP_POLICY_FILE"

echo

# Generate Terraform backend configuration
log_info "Generating Terraform backend configuration..."

BACKEND_CONFIG_FILE="infrastructure/terraform/environments/$ENVIRONMENT/backend-config.tfvars"
BACKEND_CONFIG_CONTENT=$(cat <<EOF
# Terraform Backend Configuration
# Generated by init-backend.sh on $(date -u +"%Y-%m-%d %H:%M:%S UTC")
#
# Usage:
#   terraform init -backend-config=backend-config.tfvars

bucket   = "$BUCKET_NAME"
key      = "$ENVIRONMENT/terraform.tfstate"
region   = "$REGION"
endpoint = "$SPACES_ENDPOINT"

# Skip AWS-specific checks (DigitalOcean Spaces doesn't support these)
skip_credentials_validation = true
skip_metadata_api_check     = true
skip_region_validation      = true
EOF
)

# Determine the absolute path
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
BACKEND_CONFIG_PATH="$PROJECT_ROOT/$BACKEND_CONFIG_FILE"

# Create backend config file
mkdir -p "$(dirname "$BACKEND_CONFIG_PATH")"
echo "$BACKEND_CONFIG_CONTENT" > "$BACKEND_CONFIG_PATH"
log_success "Backend configuration saved to: $BACKEND_CONFIG_FILE"

echo

# Print next steps
log_success "============================================"
log_success "Backend Initialization Complete!"
log_success "============================================"
echo
echo "Next steps:"
echo
echo "1. Navigate to your Terraform environment:"
echo "   cd infrastructure/terraform/environments/$ENVIRONMENT"
echo
echo "2. Initialize Terraform with the remote backend:"
echo "   terraform init -backend-config=backend-config.tfvars"
echo
echo "3. Verify the backend configuration:"
echo "   terraform show"
echo
echo "4. (Optional) Migrate existing local state:"
echo "   terraform init -backend-config=backend-config.tfvars -migrate-state"
echo
echo "Backend Details:"
echo "  Bucket:   $BUCKET_NAME"
echo "  Key:      $ENVIRONMENT/terraform.tfstate"
echo "  Region:   $REGION"
echo "  Endpoint: $SPACES_ENDPOINT"
echo
log_info "Note: Keep your Spaces access keys secure and never commit them to git!"
echo
