# Multi-Stage Dockerfile for NestJS API
# Optimized for Turborepo monorepo with security best practices

# ============================================
# Stage 1: Base - Setup pnpm and dependencies
# ============================================
FROM node:20.18.1-alpine AS base

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@9.10.0 --activate

# Set working directory
WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

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
COPY pnpm-workspace.yaml package.json turbo.json ./

# Copy source code for shared packages
COPY packages/shared ./packages/shared
COPY packages/typescript-config ./packages/typescript-config

# Copy API source code
COPY apps/api ./apps/api

# Build the API using Turborepo
RUN pnpm turbo build --filter=api

# ============================================
# Stage 4: Production Dependencies
# ============================================
FROM base AS production-deps

# Copy workspace configuration
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy package.json files for production
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

# Install only production dependencies
RUN pnpm install --prod --frozen-lockfile --prefer-offline --ignore-scripts

# ============================================
# Stage 5: Production - Final image
# ============================================
FROM node:20.18.1-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init curl

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 -G nodejs

# Set working directory
WORKDIR /app

# Copy production dependencies
COPY --from=production-deps --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=production-deps --chown=nestjs:nodejs /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=production-deps --chown=nestjs:nodejs /app/apps/api/node_modules ./apps/api/node_modules

# Copy shared package (built)
COPY --from=builder --chown=nestjs:nodejs /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder --chown=nestjs:nodejs /app/packages/shared/package.json ./packages/shared/

# Copy built application
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
