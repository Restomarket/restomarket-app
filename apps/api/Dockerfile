# Multi-Stage Dockerfile for NestJS API
# Optimized for Turborepo monorepo with security best practices
# Uses turbo prune for minimal image size

# Build arguments
ARG NODE_VERSION=20.18.1
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

# ============================================
# Stage 3: Builder - Compile TypeScript
# ============================================
FROM base AS builder

# Copy dependencies from previous stage
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/packages ./packages
COPY --from=dependencies /app/apps/api/node_modules ./apps/api/node_modules

# Copy workspace configuration
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml turbo.json ./

# Copy source code for shared packages
COPY packages/shared ./packages/shared
COPY packages/typescript-config ./packages/typescript-config

# Copy API source code
COPY apps/api ./apps/api

# Build the API using Turborepo (use full package name @apps/api)
RUN pnpm turbo build --filter=@apps/api

# ============================================
# Stage 4: Production Deploy
# ============================================
FROM base AS production-deploy

# Copy built application from builder
COPY --from=builder /app ./

# Use pnpm deploy to create a pruned production installation
# This installs only the API's production dependencies in an isolated directory
RUN pnpm --filter=@apps/api deploy --prod /prod/api

# Copy built code to deployed location (pnpm deploy doesn't copy dist/)
RUN cp -r /app/apps/api/dist /prod/api/dist

# Copy shared package build output to deployed location
RUN mkdir -p /prod/api/packages/shared && \
    cp -r /app/packages/shared/dist /prod/api/packages/shared/ && \
    cp /app/packages/shared/package.json /prod/api/packages/shared/

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

# Expose port
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production

# Health check using /v1/health endpoint (versioned API)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3002/v1/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application (NestJS outputs to dist/src/)
CMD ["node", "dist/src/main.js"]
