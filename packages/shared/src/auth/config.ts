import type { BetterAuthOptions } from 'better-auth';
import { bearer } from 'better-auth/plugins/bearer';
import { admin } from 'better-auth/plugins/admin';
import { organization as organizationPlugin } from 'better-auth/plugins/organization';
import { createAccessControl } from 'better-auth/plugins/access';
import { statements, rolePermissions } from './permissions.js';

/**
 * Shared Better Auth Configuration
 *
 * This configuration is shared between the Next.js frontend and NestJS backend
 * to ensure consistent authentication behavior across both applications.
 *
 * IMPORTANT: Any changes here affect both apps. Test thoroughly after modifications.
 *
 * @see https://www.better-auth.com/docs
 */

/**
 * Create the base Better Auth configuration shared by both apps
 * This prevents configuration drift between Next.js and NestJS
 */
export function createBetterAuthBaseConfig(): Partial<BetterAuthOptions> {
  // ============================================
  // Access Control Setup
  // ============================================
  const ac = createAccessControl(statements);

  const roles = {
    owner: ac.newRole(rolePermissions.owner),
    admin: ac.newRole(rolePermissions.admin),
    manager: ac.newRole(rolePermissions.manager),
    member: ac.newRole(rolePermissions.member),
    viewer: ac.newRole(rolePermissions.viewer),
  };

  return {
    // ============================================
    // Application Metadata
    // ============================================
    appName: 'RestoMarket',

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
    // User Schema Extension
    // ============================================
    user: {
      // Additional custom fields
      additionalFields: {
        firstName: {
          type: 'string',
          required: false,
          input: true,
        },
        lastName: {
          type: 'string',
          required: false,
          input: true,
        },
        // Business logic fields (merged from old users table)
        isActive: {
          type: 'boolean',
          required: false,
          defaultValue: true,
        },
        deletedAt: {
          type: 'date',
          required: false,
        },
      },

      // Email change settings
      changeEmail: {
        enabled: true,
      },

      // User deletion settings
      deleteUser: {
        enabled: true,
      },
    },

    // ============================================
    // Account Settings
    // ============================================
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ['google'],
      },
    },

    // ============================================
    // Plugins (shared between both apps)
    // ============================================
    plugins: [
      // Bearer token for API authentication
      bearer(),

      // Admin plugin for user management
      admin({
        defaultRole: 'member',
      }),

      // Organization management (multi-tenancy)
      organizationPlugin({
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
      }),
    ],

    // ============================================
    // Advanced Configuration
    // ============================================
    advanced: {
      // Use secure cookies in production
      useSecureCookies: process.env.NODE_ENV === 'production',

      // Cross subdomain cookies
      crossSubDomainCookies: {
        enabled: false, // Enable if using app.restomarket.com, api.restomarket.com
      },

      // Database settings
      database: {
        // Use crypto.randomUUID() for ID generation
        generateId: () => crypto.randomUUID(),
      },

      // IP address detection (for behind proxy/load balancer)
      ipAddress: {
        ipAddressHeaders: ['x-forwarded-for', 'x-real-ip'],
      },
    },

    // ============================================
    // Rate Limiting (distributed-safe)
    // ============================================
    rateLimit: {
      enabled: true,
      window: 60, // 1 minute
      max: 100, // 100 requests per minute
      storage: 'database', // Database storage for distributed systems
    },

    // ============================================
    // Experimental Features
    // ============================================
    // Note: experimental.joins is intentionally disabled.
    // It requires each table to appear exactly once in the Drizzle schema,
    // which conflicts with alias exports needed for backward compatibility.
    // Standard queries perform well for auth operations.

    // ============================================
    // Database Hooks (data consistency)
    // ============================================
    databaseHooks: {
      user: {
        create: {
          before: async user => {
            // Ensure name is set (required by Better Auth)
            if (!user.name && (user.firstName || user.lastName)) {
              return {
                data: {
                  ...user,
                  name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
                },
              };
            }
            return { data: user };
          },
          after: async user => {
            console.log(`[Auth] New user created: ${user.email}`);
            // TODO: Send welcome email, create default org, track analytics, etc.
          },
        },
        update: {
          before: async user => {
            // Keep name in sync with firstName/lastName
            if (user.firstName || user.lastName) {
              return {
                data: {
                  ...user,
                  name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
                },
              };
            }
            return { data: user };
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
      process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002',
    ].filter(Boolean) as string[],
  };
}
