import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { organization, bearer } from 'better-auth/plugins';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@repo/shared';

/**
 * Better Auth Instance for NestJS API
 *
 * This is a separate Better Auth instance that runs on the NestJS backend.
 * It shares the same database and schema as the Next.js frontend auth instance.
 *
 * The NestJS instance is primarily used for:
 * - Validating session tokens from the frontend
 * - Checking permissions for protected routes
 * - Handling API-specific authentication flows
 *
 * Note: The primary auth server runs on Next.js. This instance connects
 * to the same database for session validation.
 */

// Create database connection
const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);
const db = drizzle(client, { schema });

export const auth = betterAuth({
  // ============================================
  // Database Configuration (same as Next.js)
  // ============================================
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      // Core auth tables
      user: schema.authUsers,
      session: schema.authSessions,
      account: schema.authAccounts,
      verification: schema.authVerifications,
      // Organization tables
      organization: schema.organizations,
      member: schema.members,
      invitation: schema.invitations,
      team: schema.teams,
      teamMember: schema.teamMembers,
      organizationRole: schema.organizationRoles,
      // Include all schema for relations
      ...schema,
    },
  }),

  // ============================================
  // Base URL Configuration
  // ============================================
  baseURL:
    process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001',
  secret: process.env.BETTER_AUTH_SECRET!,

  // ============================================
  // Session Configuration
  // ============================================
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Update session every 24 hours
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // Cache for 5 minutes
    },
  },

  // ============================================
  // Plugins (must match Next.js configuration)
  // ============================================
  plugins: [
    // Bearer token for API authentication
    bearer(),

    // Organization management (multi-tenancy)
    organization({
      // Enable teams within organizations
      teams: {
        enabled: true,
        maximumTeams: 20,
      },
    }),
  ],

  // ============================================
  // Hooks (required for @thallesp/nestjs-better-auth)
  // ============================================
  hooks: {},

  // ============================================
  // Trusted Origins (CORS)
  // ============================================
  trustedOrigins: [
    process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  ].filter(Boolean) as string[],
});

// Export type for client inference
export type Auth = typeof auth;
