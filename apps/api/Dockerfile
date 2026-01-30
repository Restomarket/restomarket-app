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

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

# Set working directory
WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# ============================================
# Stage 2: Pruner - Extract minimal workspace for API
# ============================================
FROM base AS pruner

# Copy entire monorepo
COPY . .

# Prune workspace to only include API and its dependencies
# This creates a minimal subset in /app/out
RUN pnpm turbo prune --scope=api --docker

# ============================================
# Stage 3: Dependencies - Install all dependencies
# ============================================
FROM base AS dependencies

# Copy pruned workspace lockfile and package.json files
COPY --from=pruner /app/out/json/ ./
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml

# Install all dependencies (including dev dependencies for build)
RUN pnpm install --frozen-lockfile --prefer-offline

# ============================================
# Stage 4: Builder - Compile TypeScript
# ============================================
FROM base AS builder

# Copy dependencies from previous stage
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/packages ./packages
COPY --from=dependencies /app/apps/api/node_modules ./apps/api/node_modules

# Copy pruned source code
COPY --from=pruner /app/out/full/ ./

# Build the API using Turborepo
RUN pnpm turbo build --filter=api

# ============================================
# Stage 5: Production Dependencies
# ============================================
FROM base AS production-deps

# Copy pruned workspace lockfile and package.json files
COPY --from=pruner /app/out/json/ ./
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml

# Install only production dependencies
# Note: Workspace packages like @repo/shared have no prod deps, so their node_modules won't be created
# This is expected - we'll copy the built dist/ from the builder stage instead
RUN pnpm install --prod --frozen-lockfile --prefer-offline --ignore-scripts

# ============================================
# Stage 6: Production - Final image
# ============================================
FROM node:${NODE_VERSION}-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init curl

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 -G nodejs

# Set working directory
WORKDIR /app

# Copy production dependencies (hoisted to root by pnpm)
# pnpm workspaces hoist all dependencies to the root node_modules
COPY --from=production-deps --chown=nestjs:nodejs /app/node_modules ./node_modules

# Copy shared package (built output only - no source needed)
COPY --from=builder --chown=nestjs:nodejs /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder --chown=nestjs:nodejs /app/packages/shared/package.json ./packages/shared/

# Copy built API application
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/package.json ./apps/api/

# Set working directory to API
WORKDIR /app/apps/api

# Switch to non-root user
USER nestjs

# Expose port
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production

# Health check using /health endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/main.js"]
