import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { randomBytes } from 'crypto';
import { Logger } from '@nestjs/common';
import {
  authUsers,
  authSessions,
  authAccounts,
  authVerifications,
  organizations,
  members,
  invitations,
  teams,
  teamMembers,
  organizationRoles,
} from '@repo/shared';
import { createBetterAuthBaseConfig } from '@repo/shared/auth';

/**
 * NestJS Better Auth Instance
 *
 * Uses shared configuration from @repo/shared to ensure consistency with Next.js.
 * This instance is used for:
 * - Validating session tokens from the frontend
 * - Checking permissions for protected routes
 * - Bearer token validation for API clients
 *
 * Configuration is automatically synchronized with Next.js via the shared config.
 *
 * @see https://www.better-auth.com/docs
 */

const logger = new Logger('BetterAuth');

// ============================================
// Database Connection (Singleton Pattern)
// ============================================

let dbInstance: ReturnType<typeof drizzle> | null = null;
let clientInstance: ReturnType<typeof postgres> | null = null;

/**
 * Get or create database connection using singleton pattern.
 * Prevents connection exhaustion in production.
 */
function getDatabase(): ReturnType<typeof drizzle> {
  if (dbInstance) return dbInstance;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  clientInstance = postgres(connectionString, {
    max: process.env.DATABASE_POOL_MAX ? parseInt(process.env.DATABASE_POOL_MAX, 10) : 10,
    idle_timeout: parseInt(process.env.DATABASE_IDLE_TIMEOUT || '20', 10),
    connect_timeout: parseInt(process.env.DATABASE_CONNECT_TIMEOUT || '10', 10),
    prepare: false, // Required for Supabase/Neon pooler
    onnotice: process.env.NODE_ENV === 'development' ? msg => logger.warn(msg) : undefined,
  });

  dbInstance = drizzle(clientInstance);

  // Graceful shutdown for Docker/Kubernetes
  if (process.env.NODE_ENV !== 'test') {
    const cleanup = async () => {
      logger.log('Closing database connections...');
      await clientInstance?.end({ timeout: 5 });
      process.exit(0);
    };

    process.on('SIGTERM', cleanup);
    process.on('SIGINT', cleanup);
  }

  return dbInstance;
}

// ============================================
// Secret Configuration
// ============================================

function getSecret(): string {
  if (process.env.BETTER_AUTH_SECRET) {
    return process.env.BETTER_AUTH_SECRET;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'BETTER_AUTH_SECRET is required in production. Generate one with: openssl rand -base64 32',
    );
  }

  const tempSecret = randomBytes(32).toString('hex');
  logger.warn('BETTER_AUTH_SECRET is not set — using temporary random secret');
  logger.warn('Sessions will be invalidated on restart');
  return tempSecret;
}

// ============================================
// Better Auth Instance
// ============================================

const baseConfig = createBetterAuthBaseConfig();

export const auth = betterAuth({
  ...baseConfig,

  database: drizzleAdapter(getDatabase(), {
    provider: 'pg',
    schema: {
      user: authUsers,
      session: authSessions,
      account: authAccounts,
      verification: authVerifications,
      organization: organizations,
      member: members,
      invitation: invitations,
      team: teams,
      teamMember: teamMembers,
      organizationRole: organizationRoles,
    },
  }),

  baseURL:
    process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  secret: getSecret(),
}) as ReturnType<typeof betterAuth>;

export type Auth = typeof auth;
