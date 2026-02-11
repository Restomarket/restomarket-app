import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { getDatabase } from '../database/connection';
import * as schema from '@repo/shared';
import { createBetterAuthBaseConfig } from '@repo/shared/auth';
import { sendVerificationEmail, sendPasswordResetEmail } from '../email/index';

/**
 * Next.js Better Auth Configuration
 *
 * Uses shared configuration from @repo/shared with Next.js-specific features:
 * - Email/password + OAuth (Google)
 * - Email verification with Resend
 * - Organization lifecycle hooks
 * - Next.js cookie helpers
 *
 * Core configuration is shared with NestJS to ensure consistency.
 *
 * @see https://www.better-auth.com/docs
 */

// ============================================
// Database Connection Helper
// ============================================

/**
 * Get database connection with fallback for build time
 * During build time, DATABASE_URL may not be available.
 * Better Auth can handle initialization without a database connection.
 */
function getDatabaseSafe() {
  try {
    if (!process.env.DATABASE_URL) {
      console.warn('[Auth] DATABASE_URL not set, using placeholder for build');
      // Return a placeholder - Better Auth will handle the missing connection at runtime
      return null as unknown as ReturnType<typeof getDatabase>;
    }
    return getDatabase();
  } catch (error) {
    console.warn('[Auth] Failed to connect to database, using placeholder');
    console.error(error);
    return null as unknown as ReturnType<typeof getDatabase>;
  }
}

// ============================================
// Better Auth Configuration
// ============================================

// Get shared base configuration
const baseConfig = createBetterAuthBaseConfig();

export const auth = betterAuth({
  // Spread shared configuration
  ...baseConfig,

  // ============================================
  // Database Configuration (Drizzle + Supabase)
  // ============================================
  database: drizzleAdapter(getDatabaseSafe()!, {
    provider: 'pg',
    schema: {
      // Spread full schema - includes Better Auth model name aliases
      // (user, session, account, verification, rateLimit) plus all relations
      ...schema,
    },
  }),

  // ============================================
  // Base URL & Secret
  // ============================================
  baseURL:
    process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  secret: process.env.BETTER_AUTH_SECRET!,

  // ============================================
  // Next.js-Specific User Settings
  // ============================================
  user: {
    ...baseConfig.user,
    // Email change settings (Next.js only)
    changeEmail: {
      enabled: true,
      sendChangeEmailVerification: async ({
        user,
        newEmail,
        url,
      }: {
        user: { name: string };
        newEmail: string;
        url: string;
      }) => {
        // Send email change verification to the new email address
        await sendVerificationEmail({
          user: { email: newEmail, name: user.name },
          url,
        });
      },
    },
  },

  // ============================================
  // Next.js-Specific: Email & Password Authentication
  // ============================================
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: process.env.NODE_ENV === 'production',
    sendResetPassword: sendPasswordResetEmail,
    // Password requirements
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },

  // ============================================
  // Next.js-Specific: Email Verification
  // ============================================
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: sendVerificationEmail,
    expiresIn: 60 * 60 * 24, // 24 hours
  },

  // ============================================
  // Next.js-Specific: Social OAuth Providers
  // ============================================
  socialProviders: {
    // Google OAuth - conditionally enabled based on env vars
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            mapProfileToUser: profile => ({
              firstName: profile.given_name,
              lastName: profile.family_name,
            }),
          },
        }
      : {}),
  },

  // ============================================
  // Plugins (extend base config with Next.js-specific)
  // ============================================
  plugins: [
    // Include all base plugins
    ...(baseConfig.plugins || []),

    // Next.js Cookie Helper - MUST be last plugin
    // Automatically sets cookies in server actions
    nextCookies(),
  ],
});

// Export type for client inference
export type Auth = typeof auth;
