import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { organization, bearer } from 'better-auth/plugins';
import { nextCookies } from 'better-auth/next-js';
import { createAccessControl } from 'better-auth/plugins/access';
import { getDatabase } from '../database/connection';
import * as schema from '@repo/shared';
import { statements, rolePermissions } from '@repo/shared';

/**
 * Create Access Control with our custom statements
 */
const ac = createAccessControl(statements);

/**
 * Define roles using Better Auth's access control system
 */
const roles = {
  owner: ac.newRole(rolePermissions.owner),
  admin: ac.newRole(rolePermissions.admin),
  manager: ac.newRole(rolePermissions.manager),
  member: ac.newRole(rolePermissions.member),
  viewer: ac.newRole(rolePermissions.viewer),
};

/**
 * Get database connection with fallback for build time
 * During build time, DATABASE_URL may not be available.
 * Better Auth can handle initialization without a database connection.
 */
function getDatabaseSafe() {
  try {
    // During build time, DATABASE_URL may not be available
    if (!process.env.DATABASE_URL) {
      console.warn('[Auth] DATABASE_URL not set, using placeholder for build');
      // Return undefined - Better Auth will handle this gracefully during build
      return undefined;
    }
    return getDatabase();
  } catch (error) {
    console.warn('[Auth] Failed to connect to database, using placeholder');
    console.error(error);
    return undefined;
  }
}

/**
 * Better Auth Configuration
 *
 * This is the main authentication configuration for the application.
 * It handles:
 * - Email/password authentication
 * - Social OAuth providers
 * - Session management
 * - Organization management (multi-tenancy)
 * - Team management
 * - Role-based access control
 * - Token generation for API access
 *
 * @see https://www.better-auth.com/docs/installation
 */
export const auth = betterAuth({
  // ============================================
  // Database Configuration (Drizzle + Supabase)
  // ============================================
  database: getDatabaseSafe()
    ? drizzleAdapter(getDatabaseSafe()!, {
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
      })
    : undefined,

  // ============================================
  // Base URL Configuration
  // ============================================
  baseURL:
    process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
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
  // Email & Password Authentication
  // ============================================
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: process.env.NODE_ENV === 'production',
    sendResetPassword: async ({ user, url }) => {
      // TODO: Implement with your email provider (Resend, SendGrid, etc.)
      console.log(`[Auth] Password reset email for ${user.email}: ${url}`);
    },
  },

  // ============================================
  // Email Verification
  // ============================================
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      // TODO: Implement with your email provider
      console.log(`[Auth] Verification email for ${user.email}: ${url}`);
    },
  },

  // ============================================
  // Social OAuth Providers
  // ============================================
  socialProviders: {
    // Google OAuth
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
    // GitHub OAuth
    ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
      ? {
          github: {
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
            mapProfileToUser: profile => ({
              firstName: profile.name?.split(' ')[0] || '',
              lastName: profile.name?.split(' ').slice(1).join(' ') || '',
            }),
          },
        }
      : {}),
  },

  // ============================================
  // User Schema Extension
  // ============================================
  user: {
    additionalFields: {
      firstName: {
        type: 'string',
        required: false,
      },
      lastName: {
        type: 'string',
        required: false,
      },
    },
  },

  // ============================================
  // Plugins
  // ============================================
  plugins: [
    // Bearer token for API authentication (NestJS)
    bearer(),

    // Organization management (multi-tenancy)
    organization({
      // Access Control with custom roles
      ac,
      roles,

      // Organization settings
      allowUserToCreateOrganization: true,
      creatorRole: 'owner',
      membershipLimit: 100,
      invitationExpiresIn: 60 * 60 * 48, // 48 hours

      // Enable teams within organizations
      teams: {
        enabled: true,
        maximumTeams: 20,
      },

      // Dynamic access control (create roles at runtime)
      dynamicAccessControl: {
        enabled: true,
        maximumRolesPerOrganization: 50,
      },

      // Email verification for invitations
      requireEmailVerificationOnInvitation: process.env.NODE_ENV === 'production',

      // Invitation email handler
      async sendInvitationEmail(data) {
        const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${data.id}`;
        // TODO: Send with your email provider
        console.log(`[Auth] Invitation email to ${data.email}: ${inviteLink}`);
      },

      // Organization lifecycle hooks
      organizationHooks: {
        afterCreateOrganization: async ({ organization, user }) => {
          console.log(`[Auth] Organization created: ${organization.name} by ${user.email}`);
          // TODO: Setup default resources, Stripe customer, etc.
        },
        afterAddMember: async ({ user, organization }) => {
          console.log(`[Auth] ${user.email} joined ${organization.name}`);
          // TODO: Send welcome email, setup default permissions, etc.
        },
        afterRemoveMember: async ({ user, organization }) => {
          console.log(`[Auth] ${user.email} left ${organization.name}`);
          // TODO: Cleanup resources, revoke access, etc.
        },
      },
    }),

    // Next.js Cookie Helper - MUST be last plugin
    // Automatically sets cookies in server actions
    nextCookies(),
  ],

  // ============================================
  // Advanced Configuration
  // ============================================
  advanced: {
    database: {
      // Use crypto.randomUUID() for ID generation
      generateId: () => crypto.randomUUID(),
    },
  },

  // ============================================
  // Rate Limiting
  // ============================================
  rateLimit: {
    enabled: true,
    window: 60, // 1 minute
    max: 100, // 100 requests per minute
  },

  // ============================================
  // Experimental Features
  // ============================================
  experimental: {
    joins: true, // Enable Drizzle joins for better performance
  },

  // ============================================
  // Database Hooks
  // ============================================
  databaseHooks: {
    user: {
      create: {
        after: async user => {
          console.log(`[Auth] New user created: ${user.email}`);
          // TODO: Send welcome email, create default org, etc.
        },
      },
    },
    session: {
      create: {
        before: async session => {
          // Optionally set default active organization on login
          return {
            data: {
              ...session,
              // activeOrganizationId can be set here if needed
            },
          };
        },
      },
    },
  },

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
