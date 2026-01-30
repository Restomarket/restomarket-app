#!/usr/bin/env bash
################################################################################
# GitHub Secrets Setup Helper for Staging Deployment
#
# This script helps you configure all required GitHub secrets for the
# staging deployment pipeline.
#
# Prerequisites:
#   - gh CLI installed and authenticated (gh auth login)
#   - Repository admin access
#   - SSH access to staging droplet
#
# Usage:
#   ./setup-github-secrets.sh
################################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== GitHub Secrets Setup for Staging Deployment ===${NC}"
echo ""

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo -e "${RED}✗ gh CLI is not installed${NC}"
    echo "Install it from: https://cli.github.com/"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo -e "${RED}✗ Not authenticated with GitHub${NC}"
    echo "Run: gh auth login"
    exit 1
fi

echo -e "${GREEN}✓ gh CLI is installed and authenticated${NC}"
echo ""

# Get repository info
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || true)
if [ -z "$REPO" ]; then
    echo -e "${RED}✗ Could not determine repository${NC}"
    echo "Make sure you're in a git repository or set GH_REPO=owner/repo"
    exit 1
fi

echo -e "${BLUE}Repository:${NC} $REPO"
echo ""

# List current secrets
echo -e "${BLUE}=== Current Repository Secrets ===${NC}"
gh secret list || { echo -e "${RED}Failed to list secrets${NC}"; exit 1; }
echo ""

# Function to check if secret exists
secret_exists() {
    gh secret list 2>/dev/null | grep -q "^${1}[[:space:]]"
}

# Function to prompt for secret value
prompt_secret() {
    local name=$1
    local description=$2
    local default=$3
    local is_file=${4:-false}

    echo -e "${YELLOW}=== Setting up: $name ===${NC}"
    echo -e "${BLUE}$description${NC}"
    echo ""

    if secret_exists "$name"; then
        echo -e "${GREEN}✓ Secret '$name' already exists${NC}"
        read -p "Do you want to update it? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo -e "${BLUE}Skipping $name${NC}"
            echo ""
            return
        fi
    fi

    if [ "$is_file" = true ]; then
        read -p "Enter path to SSH private key file [$default]: " key_path
        key_path=${key_path:-$default}

        if [ ! -f "$key_path" ]; then
            echo -e "${RED}✗ File not found: $key_path${NC}"
            echo "Skipping $name"
            echo ""
            return
        fi

        if gh secret set "$name" < "$key_path"; then
            echo -e "${GREEN}✓ Secret '$name' set successfully${NC}"
        else
            echo -e "${RED}✗ Failed to set secret '$name'${NC}"
        fi
    else
        if [ -n "$default" ]; then
            read -p "Enter value (default: $default): " value
            value=${value:-$default}
        else
            read -p "Enter value: " value
        fi

        if [ -z "$value" ]; then
            echo -e "${RED}✗ No value provided, skipping${NC}"
            echo ""
            return
        fi

        if echo -n "$value" | gh secret set "$name"; then
            echo -e "${GREEN}✓ Secret '$name' set successfully${NC}"
        else
            echo -e "${RED}✗ Failed to set secret '$name'${NC}"
        fi
    fi
    echo ""
}

# Setup secrets
echo -e "${BLUE}=== Required Secrets for Staging Deployment ===${NC}"
echo ""

# 1. STAGING_HOST
prompt_secret "STAGING_HOST" \
    "The IP address or hostname of the staging droplet

Frankfurt Infrastructure:
  - Droplet 1: 165.227.129.93
  - Droplet 2: 161.35.21.86
  - Load Balancer: 157.245.21.33 (not for SSH)

Recommended: Use Droplet 1 IP" \
    "165.227.129.93"

# 2. STAGING_USERNAME
prompt_secret "STAGING_USERNAME" \
    "The SSH username for connecting to the staging droplet

Recommended: 'deploy' (create dedicated user)
Alternative: 'root' (if deploy user not created yet)" \
    "deploy"

# 3. STAGING_SSH_KEY
echo -e "${YELLOW}=== Setting up: STAGING_SSH_KEY ===${NC}"
echo -e "${BLUE}The private SSH key for connecting to the staging droplet${NC}"
echo ""

if secret_exists "STAGING_SSH_KEY"; then
    echo -e "${GREEN}✓ Secret 'STAGING_SSH_KEY' already exists${NC}"
    read -p "Do you want to update it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}Skipping STAGING_SSH_KEY${NC}"
        echo ""
    else
        echo ""
        echo "Choose an option:"
        echo "  1) Use existing SSH key file"
        echo "  2) Generate new SSH key pair"
        echo "  3) Paste private key content"
        read -p "Enter choice (1-3): " -n 1 -r choice
        echo ""

        case $choice in
            1)
                prompt_secret "STAGING_SSH_KEY" \
                    "Path to existing SSH private key file" \
                    "$HOME/.ssh/id_ed25519" \
                    true
                ;;
            2)
                echo "Generating new Ed25519 SSH key pair..."
                key_path="$HOME/.ssh/restomarket_deploy"
                ssh-keygen -t ed25519 -C "github-actions-deploy" -f "$key_path" -N ""
                echo ""
                echo -e "${GREEN}✓ Generated new SSH key pair:${NC}"
                echo "  Private: $key_path"
                echo "  Public:  ${key_path}.pub"
                echo ""
                echo -e "${YELLOW}⚠ Next steps:${NC}"
                echo "1. Copy the public key to your staging droplet:"
                echo "   ssh-copy-id -i ${key_path}.pub deploy@165.227.129.93"
                echo ""
                echo "2. Press Enter to set the private key as a GitHub secret..."
                read

                if gh secret set "STAGING_SSH_KEY" < "$key_path"; then
                    echo -e "${GREEN}✓ Secret 'STAGING_SSH_KEY' set successfully${NC}"
                else
                    echo -e "${RED}✗ Failed to set secret 'STAGING_SSH_KEY'${NC}"
                fi
                ;;
            3)
                echo "Paste the private key content (Ctrl+D when done):"
                if gh secret set "STAGING_SSH_KEY"; then
                    echo -e "${GREEN}✓ Secret 'STAGING_SSH_KEY' set successfully${NC}"
                else
                    echo -e "${RED}✗ Failed to set secret 'STAGING_SSH_KEY'${NC}"
                fi
                ;;
            *)
                echo -e "${RED}Invalid choice, skipping${NC}"
                ;;
        esac
        echo ""
    fi
else
    echo "Choose an option:"
    echo "  1) Use existing SSH key file"
    echo "  2) Generate new SSH key pair"
    echo "  3) Paste private key content"
    read -p "Enter choice (1-3): " -n 1 -r choice
    echo ""

    case $choice in
        1)
            prompt_secret "STAGING_SSH_KEY" \
                "Path to existing SSH private key file" \
                "$HOME/.ssh/id_ed25519" \
                true
            ;;
        2)
            echo "Generating new Ed25519 SSH key pair..."
            key_path="$HOME/.ssh/restomarket_deploy"
            ssh-keygen -t ed25519 -C "github-actions-deploy" -f "$key_path" -N ""
            echo ""
            echo -e "${GREEN}✓ Generated new SSH key pair:${NC}"
            echo "  Private: $key_path"
            echo "  Public:  ${key_path}.pub"
            echo ""
            echo -e "${YELLOW}⚠ Next steps:${NC}"
            echo "1. Copy the public key to your staging droplet:"
            echo "   ssh-copy-id -i ${key_path}.pub deploy@165.227.129.93"
            echo ""
            echo "2. Press Enter to set the private key as a GitHub secret..."
            read

            if gh secret set "STAGING_SSH_KEY" < "$key_path"; then
                echo -e "${GREEN}✓ Secret 'STAGING_SSH_KEY' set successfully${NC}"
            else
                echo -e "${RED}✗ Failed to set secret 'STAGING_SSH_KEY'${NC}"
            fi
            ;;
        3)
            echo "Paste the private key content (Ctrl+D when done):"
            if gh secret set "STAGING_SSH_KEY"; then
                echo -e "${GREEN}✓ Secret 'STAGING_SSH_KEY' set successfully${NC}"
            else
                echo -e "${RED}✗ Failed to set secret 'STAGING_SSH_KEY'${NC}"
            fi
            ;;
        *)
            echo -e "${RED}Invalid choice, skipping${NC}"
            ;;
    esac
    echo ""
fi

# 4. SLACK_WEBHOOK (optional)
echo -e "${YELLOW}=== Setting up: SLACK_WEBHOOK (Optional) ===${NC}"
echo -e "${BLUE}Slack incoming webhook URL for deployment notifications${NC}"
echo ""
echo "This is optional. The deployment will work without it."
echo ""
read -p "Do you want to set up Slack notifications? (y/N): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    prompt_secret "SLACK_WEBHOOK" \
        "Slack incoming webhook URL (starts with https://hooks.slack.com/...)" \
        ""
else
    echo -e "${BLUE}Skipping SLACK_WEBHOOK${NC}"
    echo ""
fi

# Summary
echo -e "${BLUE}=== Setup Summary ===${NC}"
echo ""
echo "Checking configured secrets:"
echo ""

for secret in STAGING_HOST STAGING_USERNAME STAGING_SSH_KEY SLACK_WEBHOOK; do
    if secret_exists "$secret"; then
        echo -e "${GREEN}✓ $secret${NC}"
    else
        if [ "$secret" = "SLACK_WEBHOOK" ]; then
            echo -e "${YELLOW}⊘ $secret (optional)${NC}"
        else
            echo -e "${RED}✗ $secret (required)${NC}"
        fi
    fi
done

echo ""

# Check if all required secrets are set
missing_required=false
for secret in STAGING_HOST STAGING_USERNAME STAGING_SSH_KEY; do
    if ! secret_exists "$secret"; then
        missing_required=true
        break
    fi
done

if [ "$missing_required" = true ]; then
    echo -e "${RED}⚠ Some required secrets are missing!${NC}"
    echo "The deployment will fail until all required secrets are configured."
    echo ""
    echo "Run this script again to configure missing secrets."
else
    echo -e "${GREEN}✓ All required secrets are configured!${NC}"
    echo ""
    echo -e "${BLUE}Next steps:${NC}"
    echo "1. Verify SSH access to staging droplet:"
    echo "   ssh deploy@165.227.129.93"
    echo ""
    echo "2. Ensure /opt/app directory exists on droplet:"
    echo "   ssh deploy@165.227.129.93 'sudo mkdir -p /opt/app && sudo chown deploy:deploy /opt/app'"
    echo ""
    echo "3. Clone repository to /opt/app (or sync deployment scripts):"
    echo "   ssh deploy@165.227.129.93 'cd /opt/app && git clone https://github.com/$REPO.git .'"
    echo ""
    echo "4. Push to 'develop' branch to trigger staging deployment:"
    echo "   git checkout develop"
    echo "   git push origin develop"
    echo ""
    echo "5. Monitor the deployment:"
    echo "   gh run watch"
fi

echo ""
echo -e "${BLUE}=== Documentation ===${NC}"
echo "For more information, see:"
echo "  - infrastructure/docs/CICD_SETUP_GUIDE.md"
echo "  - infrastructure/FRANKFURT_QUICK_REFERENCE.md"
echo ""
