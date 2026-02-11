# Multi-Stage Dockerfile for NestJS API
# Optimized for Turborepo monorepo with security best practices
# Uses turbo prune for minimal image size

# Build arguments
ARG NODE_VERSION=24.13.0
ARG PNPM_VERSION=9.10.0

# ============================================
# Stage 1: Base - Setup pnpm and dependencies
# ============================================
FROM node:${NODE_VERSION}-alpine AS base

ARG PNPM_VERSION

# Enable corepack and install pnpm
RUN corepack enable && \
    corepack prepare pnpm@${PNPM_VERSION} --activate && \
    pnpm --version

# Set working directory
WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init curl

# ============================================
# Stage 2: Dependencies - Install all dependencies
# ============================================
FROM base AS dependencies

# Copy workspace configuration
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy all package.json files for workspace
COPY packages/shared/package.json ./packages/shared/
COPY packages/ui/package.json ./packages/ui/
COPY packages/eslint-config/package.json ./packages/eslint-config/
COPY packages/jest-config/package.json ./packages/jest-config/
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY apps/api/package.json ./apps/api/

# Install all dependencies (including dev dependencies for build)
RUN pnpm install --frozen-lockfile --prefer-offline

# Copy source code and config files for development
COPY tsconfig.json ./
COPY turbo.json ./
COPY packages/typescript-config/*.json ./packages/typescript-config/
COPY packages/shared/src ./packages/shared/src
COPY packages/shared/drizzle.schema.ts ./packages/shared/
COPY packages/shared/drizzle.config.ts ./packages/shared/
COPY packages/shared/drizzle ./packages/shared/drizzle
COPY packages/shared/tsconfig.json ./packages/shared/
COPY apps/api/src ./apps/api/src
COPY apps/api/test ./apps/api/test
COPY apps/api/tsconfig*.json apps/api/nest-cli.json apps/api/eslint.config.mjs ./apps/api/

# ============================================
# Stage 3: Builder - Compile TypeScript
# ============================================
FROM dependencies AS builder

# Copy workspace configuration and global config files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml turbo.json ./
COPY tsconfig.json eslint.config.mjs ./

# Copy source code for shared packages (without overwriting node_modules)
COPY packages/shared/src ./packages/shared/src
COPY packages/shared/drizzle.schema.ts ./packages/shared/
COPY packages/shared/drizzle.config.ts ./packages/shared/
COPY packages/shared/drizzle ./packages/shared/drizzle
COPY packages/shared/tsconfig.json ./packages/shared/
COPY packages/typescript-config/*.json ./packages/typescript-config/

# Copy API source code and configuration
COPY apps/api/src ./apps/api/src
COPY apps/api/tsconfig*.json apps/api/nest-cli.json apps/api/eslint.config.mjs ./apps/api/

# Build the API using Turborepo
RUN pnpm turbo build --filter=@apps/api

# Verify build outputs exist
RUN ls -la /app/apps/api/dist/ || (echo "ERROR: Build failed - no output" && exit 1)

# ============================================
# Stage 4: Production Deploy - Use pnpm deploy for minimal production image
# ============================================
FROM base AS production-deploy

# Copy built application from builder
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

# Copy workspace and package configuration
COPY --from=builder /app/pnpm-workspace.yaml /app/package.json /app/pnpm-lock.yaml ./
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/typescript-config/package.json ./packages/typescript-config/
COPY --from=builder /app/packages/eslint-config/package.json ./packages/eslint-config/
COPY --from=builder /app/packages/jest-config/package.json ./packages/jest-config/
COPY --from=builder /app/apps/api/package.json ./apps/api/

# Use pnpm deploy to create a pruned production installation
# This installs only the API's production dependencies in an isolated directory
# Skip scripts to avoid husky/dev tools errors in production
RUN pnpm --filter=@apps/api deploy --prod --ignore-scripts /prod/api

# Copy built code to deployed location (pnpm deploy doesn't copy dist/)
RUN cp -r /app/apps/api/dist /prod/api/dist

# Copy shared package build output to deployed location if it exists
RUN if [ -d "/app/packages/shared/dist" ]; then \
      mkdir -p /prod/api/packages/shared && \
      cp -r /app/packages/shared/dist /prod/api/packages/shared/ && \
      cp /app/packages/shared/package.json /prod/api/packages/shared/; \
    fi

# ============================================
# Stage 5: Production - Final image
# ============================================
FROM node:${NODE_VERSION}-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init curl

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 -G nodejs

# Set working directory
WORKDIR /app

# Copy deployed API with production dependencies from pnpm deploy
COPY --from=production-deploy --chown=nestjs:nodejs /prod/api ./

# Switch to non-root user
USER nestjs

# Expose port (matches APP_PORT in production/staging)
EXPOSE 3002

# Set environment to production
ENV NODE_ENV=production

# Health check using /v1/health endpoint (versioned API)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3002/v1/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
# Path: /app/dist/apps/api/src/main.js (NestJS monorepo build structure)
CMD ["node", "dist/apps/api/src/main.js"]
