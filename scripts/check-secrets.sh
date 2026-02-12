#!/usr/bin/env bash

# check-secrets.sh
# Scans the codebase for potential leaked secrets
# Exit code 0 = no secrets found, 1 = secrets detected

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔍 Checking for potentially leaked secrets..."
echo ""

# Track if any secrets are found
FOUND=0

# Patterns to search for (case-insensitive)
# These are common patterns that indicate secrets
PATTERNS=(
  "password\s*=\s*['\"][^'\"]{3,}"
  "api[_-]?key\s*=\s*['\"][^'\"]{10,}"
  "secret\s*=\s*['\"][^'\"]{10,}"
  "token\s*=\s*['\"][^'\"]{10,}"
  "auth[_-]?token\s*=\s*['\"][^'\"]{10,}"
  "private[_-]?key\s*=\s*['\"]-----BEGIN"
  "aws[_-]?access[_-]?key[_-]?id\s*=\s*['\"]AKIA"
  "DATABASE_URL\s*=\s*['\"]postgres.*:.*@"
  "BETTER_AUTH_SECRET\s*=\s*['\"][^'\"]+((?!your_32_char|generate_with|example|dummy|test|changeme)[^'\"]{20,})['\"]"
  "AGENT_SECRET\s*=\s*['\"][^'\"]+((?!your_agent|generate_with|example|dummy|test|changeme)[^'\"]{16,})['\"]"
  "API_SECRET\s*=\s*['\"][^'\"]+((?!your_api|generate_with|example|dummy|test|changeme|minimum_32)[^'\"]{32,})['\"]"
  "SUPABASE_ANON_KEY\s*=\s*['\"]eyJ[A-Za-z0-9_-]{30,}['\"]"
  "SLACK_WEBHOOK_URL\s*=\s*['\"]https://hooks.slack.com/services/[A-Z0-9]{9,}/[A-Z0-9]{9,}/[A-Za-z0-9]{24,}['\"]"
)

# Files/directories to exclude from search
EXCLUDE_ARGS=(
  --exclude-dir=node_modules
  --exclude-dir=.git
  --exclude-dir=dist
  --exclude-dir=build
  --exclude-dir=.next
  --exclude-dir=.turbo
  --exclude-dir=coverage
  --exclude-dir=out
  --exclude="*.log"
  --exclude="*.lock"
  --exclude="pnpm-lock.yaml"
  --exclude="package-lock.json"
  --exclude="yarn.lock"
  --exclude=".env.example"
  --exclude=".env.prod.example"
  --exclude="check-secrets.sh"
  --exclude="secrets-guide.md"
)

# Function to check for a pattern
check_pattern() {
  local pattern=$1
  local description=$2

  # Use grep to search for the pattern
  # -r = recursive
  # -i = case-insensitive
  # -n = show line numbers
  # -E = extended regex
  # -I = ignore binary files
  local results=$(grep -rniE "${EXCLUDE_ARGS[@]}" "$pattern" . 2>/dev/null || true)

  if [ ! -z "$results" ]; then
    echo -e "${RED}❌ Found potential secret: $description${NC}"
    echo "$results"
    echo ""
    FOUND=1
  fi
}

# Check each pattern
check_pattern "${PATTERNS[0]}" "Hardcoded password"
check_pattern "${PATTERNS[1]}" "API key"
check_pattern "${PATTERNS[2]}" "Secret value"
check_pattern "${PATTERNS[3]}" "Token"
check_pattern "${PATTERNS[4]}" "Auth token"
check_pattern "${PATTERNS[5]}" "Private key (PEM format)"
check_pattern "${PATTERNS[6]}" "AWS access key"
check_pattern "${PATTERNS[7]}" "Database URL with credentials"
check_pattern "${PATTERNS[8]}" "Better Auth secret (real value)"
check_pattern "${PATTERNS[9]}" "Agent secret (real value)"
check_pattern "${PATTERNS[10]}" "API secret (real value)"
check_pattern "${PATTERNS[11]}" "Supabase anon key (real JWT)"
check_pattern "${PATTERNS[12]}" "Slack webhook URL (real)"

# Check for committed .env files (except examples)
echo "🔍 Checking for committed .env files..."
ENV_FILES=$(find . -type f \( -name ".env" -o -name ".env.local" -o -name ".env.development" -o -name ".env.production" -o -name ".env.staging" \) 2>/dev/null | grep -v node_modules || true)

if [ ! -z "$ENV_FILES" ]; then
  echo -e "${RED}❌ Found committed .env files (should be in .gitignore):${NC}"
  echo "$ENV_FILES"
  echo ""
  FOUND=1
fi

# Check for long base64-encoded strings (potential secrets)
echo "🔍 Checking for suspicious base64-encoded strings..."
BASE64_RESULTS=$(grep -rniE "${EXCLUDE_ARGS[@]}" "eyJ[A-Za-z0-9_-]{50,}" . 2>/dev/null | grep -v ".env.example" | grep -v ".env.prod.example" || true)

if [ ! -z "$BASE64_RESULTS" ]; then
  echo -e "${YELLOW}⚠️  Found potential JWT tokens or base64-encoded secrets:${NC}"
  echo "$BASE64_RESULTS"
  echo ""
  echo -e "${YELLOW}Note: Review these manually - they may be legitimate or examples${NC}"
  echo ""
fi

# Final result
echo ""
if [ $FOUND -eq 0 ]; then
  echo -e "${GREEN}✅ No secrets detected! Codebase is clean.${NC}"
  exit 0
else
  echo -e "${RED}❌ Potential secrets detected! Please review and remove them before committing.${NC}"
  echo ""
  echo "Tips:"
  echo "  - Move secrets to .env files (never commit .env)"
  echo "  - Use .env.example with dummy values"
  echo "  - Use environment variables via process.env or ConfigService"
  echo "  - Review git history: git log --all --full-history -- path/to/file"
  echo "  - If secrets were committed, rotate them immediately"
  exit 1
fi
