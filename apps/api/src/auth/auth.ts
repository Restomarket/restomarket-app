import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { randomBytes } from 'crypto';
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
  createBetterAuthBaseConfig,
} from '@repo/shared';

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

// ============================================
// Database Connection (Singleton Pattern)
// ============================================

let dbInstance: ReturnType<typeof drizzle> | null = null;
let clientInstance: ReturnType<typeof postgres> | null = null;

/**
 * Get or create database connection using singleton pattern
 * This prevents connection exhaustion in production
 */
function getDatabase() {
  if (!dbInstance) {
    const connectionString = process.env.DATABASE_URL!;

    // Create postgres client with optimized settings
    clientInstance = postgres(connectionString, {
      max: process.env.DATABASE_POOL_MAX ? parseInt(process.env.DATABASE_POOL_MAX) : 10,
      idle_timeout: parseInt(process.env.DATABASE_IDLE_TIMEOUT || '20'),
      connect_timeout: parseInt(process.env.DATABASE_CONNECT_TIMEOUT || '10'),
      prepare: false, // Required for Supabase/Neon pooler
      onnotice: process.env.NODE_ENV === 'development' ? console.warn : undefined,
    });

    dbInstance = drizzle(clientInstance);

    // Cleanup on process exit (for Docker/Kubernetes compatibility)
    if (process.env.NODE_ENV !== 'test') {
      const cleanup = async () => {
        await clientInstance?.end({ timeout: 5 });
        process.exit(0);
      };

      process.on('SIGTERM', cleanup);
      process.on('SIGINT', cleanup);
    }
  }

  return dbInstance;
}

// ============================================
// Secret Configuration
// ============================================

// Get secret from environment or fail hard in production
const getSecret = (): string => {
  if (process.env.BETTER_AUTH_SECRET) {
    return process.env.BETTER_AUTH_SECRET;
  }

  // Hard error in production - sessions MUST be consistent across restarts
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'BETTER_AUTH_SECRET is required in production. Generate one with: openssl rand -base64 32',
    );
  }

  // Development/staging: warn but allow temporary secret
  const tempSecret = randomBytes(32).toString('hex');
  console.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.warn('⚠️  WARNING: BETTER_AUTH_SECRET is not set!');
  console.warn('⚠️  Using temporary random secret.');
  console.warn('⚠️  Sessions will be invalidated on restart.');
  console.warn('⚠️  Generate a secret: openssl rand -base64 32');
  console.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  return tempSecret;
};

const secret = getSecret();

// ============================================
// Better Auth Configuration
// ============================================

// Get shared base configuration
const baseConfig = createBetterAuthBaseConfig();

export const auth = betterAuth({
  // Spread shared configuration
  ...baseConfig,

  // ============================================
  // Database Configuration (same as Next.js)
  // ============================================
  database: drizzleAdapter(getDatabase(), {
    provider: 'pg',
    schema: {
      // Core auth tables
      user: authUsers,
      session: authSessions,
      account: authAccounts,
      verification: authVerifications,
      // Organization tables
      organization: organizations,
      member: members,
      invitation: invitations,
      team: teams,
      teamMember: teamMembers,
      organizationRole: organizationRoles,
    },
  }),

  // ============================================
  // Base URL & Secret Configuration
  // ============================================
  baseURL:
    process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  secret,
}) as ReturnType<typeof betterAuth>;

// Export type for client inference
export type Auth = typeof auth;
