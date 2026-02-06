# Better Auth Implementation Guide for Turborepo

## Complete Authentication & Authorization Architecture

**RestoMarket - Next.js 16 + NestJS + Drizzle ORM + Supabase**

---

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Package Structure](#package-structure)
3. [Shared Package Setup](#shared-package-setup)
4. [Next.js App Setup](#nextjs-app-setup)
5. [NestJS API Setup](#nestjs-api-setup)
6. [Database Schema](#database-schema)
7. [Access Control & Permissions](#access-control--permissions)
8. [Organizations & Teams](#organizations--teams)
9. [API Protection Patterns](#api-protection-patterns)
10. [Best Practices](#best-practices)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              TURBOREPO MONOREPO                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │                        packages/shared                                     │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐           │  │
│  │  │  Auth Schema    │  │  Permissions    │  │  Shared Types   │           │  │
│  │  │  (Drizzle)      │  │  & Access Ctrl  │  │  & Utilities    │           │  │
│  │  │                 │  │                 │  │                 │           │  │
│  │  │ • user          │  │ • statements    │  │ • AuthSession   │           │  │
│  │  │ • session       │  │ • roles         │  │ • Permission    │           │  │
│  │  │ • account       │  │ • permissions   │  │ • Role          │           │  │
│  │  │ • verification  │  │ • ac controller │  │ • Organization  │           │  │
│  │  │ • organization  │  │                 │  │                 │           │  │
│  │  │ • member        │  │                 │  │                 │           │  │
│  │  │ • invitation    │  │                 │  │                 │           │  │
│  │  │ • team          │  │                 │  │                 │           │  │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘           │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                    ▲                                            │
│                    ┌───────────────┴───────────────┐                            │
│                    │                               │                            │
│  ┌─────────────────▼─────────────────┐  ┌─────────▼─────────────────────────┐  │
│  │         apps/web (Next.js)        │  │       apps/api (NestJS)           │  │
│  │                                   │  │                                   │  │
│  │  ┌─────────────────────────────┐  │  │  ┌─────────────────────────────┐  │  │
│  │  │      Better Auth Server     │  │  │  │    Auth Guard/Decorator    │  │  │
│  │  │  /api/auth/*                │  │  │  │                             │  │  │
│  │  │                             │  │  │  │  • Validate session tokens  │  │  │
│  │  │  • Email/Password           │  │  │  │  • Check permissions        │  │  │
│  │  │  • OAuth (Google, GitHub)   │  │  │  │  • Extract user context     │  │  │
│  │  │  • Session management       │  │  │  │  • Organization context     │  │  │
│  │  │  • Organization management  │  │  │  │                             │  │  │
│  │  │  • Member/Role management   │  │  │  └──────────────▲──────────────┘  │  │
│  │  └──────────────▲──────────────┘  │  │                 │                 │  │
│  │                 │                 │  │  ┌──────────────┴──────────────┐  │  │
│  │  ┌──────────────┴──────────────┐  │  │  │    Protected Endpoints      │  │  │
│  │  │    Better Auth Client       │  │  │  │                             │  │  │
│  │  │                             │  │  │  │  • /users/* (CRUD)          │  │  │
│  │  │  • useSession()             │  │  │  │  • /orders/* (CRUD)         │  │  │
│  │  │  • useActiveOrganization()  │  │  │  │  • /products/* (CRUD)       │  │  │
│  │  │  • signIn/signUp/signOut    │  │  │  │  • /admin/* (Admin only)    │  │  │
│  │  │  • organization.* methods   │  │  │  │                             │  │  │
│  │  └─────────────────────────────┘  │  │  └─────────────────────────────┘  │  │
│  │                                   │  │                                   │  │
│  │  ┌─────────────────────────────┐  │  │  ┌─────────────────────────────┐  │  │
│  │  │     Server Components       │  │  │  │      Auth Module            │  │  │
│  │  │                             │  │  │  │                             │  │  │
│  │  │  • Validate session         │  │  │  │  • BetterAuthService        │  │  │
│  │  │  • Check permissions        │  │  │  │  • AuthGuard                │  │  │
│  │  │  • Protect pages            │  │  │  │  • RolesGuard               │  │  │
│  │  │                             │  │  │  │  • PermissionsGuard         │  │  │
│  │  └─────────────────────────────┘  │  │  └─────────────────────────────┘  │  │
│  └───────────────────────────────────┘  └───────────────────────────────────┘  │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Authentication Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │────▶│  Next.js    │────▶│ Better Auth │────▶│  Supabase   │
│   Client    │     │  Frontend   │     │   Server    │     │  PostgreSQL │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │
       │                   │                   │ Session/Bearer Token
       │                   │                   ▼
       │            ┌──────┴──────┐     ┌─────────────┐
       └───────────▶│   NestJS    │────▶│   Validate  │
         API Call   │     API     │     │   Session   │
         + Token    └─────────────┘     └─────────────┘
```

---

## Package Structure

```
restomarket-app/
├── packages/
│   └── shared/
│       └── src/
│           ├── auth/
│           │   ├── index.ts
│           │   ├── auth.types.ts           # Shared auth types
│           │   ├── permissions.ts          # Access control statements & roles
│           │   └── session.types.ts        # Session types
│           └── database/
│               └── schema/
│                   ├── auth.schema.ts      # Better Auth core schema
│                   ├── organization.schema.ts  # Organization tables
│                   └── index.ts
├── apps/
│   ├── web/
│   │   └── src/
│   │       └── lib/
│   │           └── auth/
│   │               ├── auth.config.ts      # Better Auth server config
│   │               ├── auth-client.ts      # Better Auth client
│   │               ├── auth.actions.ts     # Server actions
│   │               └── middleware.ts       # Next.js middleware
│   └── api/
│       └── src/
│           └── auth/
│               ├── auth.module.ts          # NestJS auth module
│               ├── auth.service.ts         # Token validation service
│               ├── auth.guard.ts           # Global auth guard
│               ├── permissions.guard.ts    # Permission-based guard
│               └── decorators/
│                   ├── current-user.decorator.ts
│                   ├── roles.decorator.ts
│                   └── permissions.decorator.ts
```

---

## Shared Package Setup

### 1. Install Dependencies

```bash
# In packages/shared
pnpm add better-auth drizzle-orm

# In apps/web
pnpm add better-auth

# In apps/api
pnpm add better-auth @thallesp/nestjs-better-auth
```

### 2. Access Control & Permissions (`packages/shared/src/auth/permissions.ts`)

```typescript
import { createAccessControl } from 'better-auth/plugins/access';
import {
  defaultStatements,
  adminAc,
  ownerAc,
  memberAc,
} from 'better-auth/plugins/organization/access';

/**
 * RestoMarket Permission Statements
 *
 * Define all resources and their possible actions.
 * Use `as const` for TypeScript inference.
 */
export const statements = {
  // Include Better Auth default organization statements
  ...defaultStatements,

  // Custom RestoMarket resources
  product: ['create', 'read', 'update', 'delete', 'publish', 'archive'],
  order: ['create', 'read', 'update', 'delete', 'fulfill', 'refund', 'cancel'],
  customer: ['create', 'read', 'update', 'delete', 'export'],
  report: ['read', 'export', 'create'],
  settings: ['read', 'update'],
  billing: ['read', 'update', 'manage'],
  team: ['create', 'read', 'update', 'delete'],
} as const;

// Create the access controller
export const ac = createAccessControl(statements);

/**
 * Role Definitions
 *
 * Each role defines what permissions it has for each resource.
 */

// Owner: Full access to everything
export const owner = ac.newRole({
  ...ownerAc.statements,
  product: ['create', 'read', 'update', 'delete', 'publish', 'archive'],
  order: ['create', 'read', 'update', 'delete', 'fulfill', 'refund', 'cancel'],
  customer: ['create', 'read', 'update', 'delete', 'export'],
  report: ['read', 'export', 'create'],
  settings: ['read', 'update'],
  billing: ['read', 'update', 'manage'],
  team: ['create', 'read', 'update', 'delete'],
});

// Admin: Full access except billing management and org deletion
export const admin = ac.newRole({
  ...adminAc.statements,
  product: ['create', 'read', 'update', 'delete', 'publish', 'archive'],
  order: ['create', 'read', 'update', 'delete', 'fulfill', 'refund', 'cancel'],
  customer: ['create', 'read', 'update', 'delete', 'export'],
  report: ['read', 'export', 'create'],
  settings: ['read', 'update'],
  billing: ['read'],
  team: ['create', 'read', 'update', 'delete'],
});

// Manager: Can manage products, orders, and customers
export const manager = ac.newRole({
  ...memberAc.statements,
  product: ['create', 'read', 'update', 'publish'],
  order: ['create', 'read', 'update', 'fulfill'],
  customer: ['read', 'update'],
  report: ['read'],
  settings: ['read'],
  team: ['read'],
});

// Member: Basic read access with limited write
export const member = ac.newRole({
  ...memberAc.statements,
  product: ['read'],
  order: ['read', 'create'],
  customer: ['read'],
  report: ['read'],
  team: ['read'],
});

// Viewer: Read-only access
export const viewer = ac.newRole({
  product: ['read'],
  order: ['read'],
  customer: ['read'],
});

// Export roles for use in auth config
export const roles = {
  owner,
  admin,
  manager,
  member,
  viewer,
};

// Type exports
export type Role = keyof typeof roles;
export type Statement = typeof statements;
export type Permission = {
  [K in keyof Statement]?: Statement[K][number][];
};
```

### 3. Auth Types (`packages/shared/src/auth/auth.types.ts`)

```typescript
/**
 * Shared Auth Types for Turborepo
 */

import type { Permission, Role } from './permissions';

// ============================================
// Session Types
// ============================================

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  image?: string | null;
  emailVerified: boolean;
  firstName?: string | null;
  lastName?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthSession {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  ipAddress?: string | null;
  userAgent?: string | null;
  activeOrganizationId?: string | null;
  activeTeamId?: string | null;
}

export interface AuthSessionData {
  session: AuthSession;
  user: AuthUser;
}

// ============================================
// Organization Types
// ============================================

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
}

export interface OrganizationMember {
  id: string;
  userId: string;
  organizationId: string;
  role: Role;
  createdAt: Date;
}

export interface OrganizationInvitation {
  id: string;
  email: string;
  organizationId: string;
  role: Role;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  expiresAt: Date;
  inviterId: string;
}

export interface Team {
  id: string;
  name: string;
  organizationId: string;
  createdAt: Date;
}

// ============================================
// Auth Context (for NestJS)
// ============================================

export interface AuthContext {
  user: AuthUser;
  session: AuthSession;
  organization?: Organization | null;
  member?: OrganizationMember | null;
  permissions: Permission;
}

// ============================================
// Auth Response Types
// ============================================

export interface AuthResult<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

// ============================================
// Utility Functions
// ============================================

export { type Role, type Permission };
export { roles, ac, statements } from './permissions';
```

---

## Next.js App Setup

### 1. Better Auth Server Configuration (`apps/web/src/lib/auth/auth.config.ts`)

```typescript
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { organization, bearer } from 'better-auth/plugins';
import { getDatabase } from '../database/connection';
import * as schema from '@repo/shared';
import { ac, roles } from '@repo/shared';

export const auth = betterAuth({
  // ============================================
  // Database Configuration
  // ============================================
  database: drizzleAdapter(getDatabase(), {
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
    },
  }),

  // ============================================
  // Base Configuration
  // ============================================
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
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
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      // TODO: Implement with your email provider
      console.log(`[Auth] Password reset for ${user.email}: ${url}`);
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
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      mapProfileToUser: profile => ({
        firstName: profile.given_name,
        lastName: profile.family_name,
      }),
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      mapProfileToUser: profile => ({
        firstName: profile.name?.split(' ')[0] || '',
        lastName: profile.name?.split(' ').slice(1).join(' ') || '',
      }),
    },
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
    // Bearer token for API authentication
    bearer(),

    // Organization management
    organization({
      // Access Control
      ac,
      roles,

      // Organization settings
      allowUserToCreateOrganization: true,
      creatorRole: 'owner',
      membershipLimit: 100,
      invitationExpiresIn: 60 * 60 * 48, // 48 hours

      // Enable teams
      teams: {
        enabled: true,
        maximumTeams: 20,
      },

      // Dynamic access control (runtime role creation)
      dynamicAccessControl: {
        enabled: true,
        maximumRolesPerOrganization: 50,
      },

      // Invitation email
      async sendInvitationEmail(data) {
        const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${data.id}`;
        // TODO: Send with your email provider
        console.log(`[Auth] Invitation email to ${data.email}: ${inviteLink}`);
      },

      // Organization hooks
      organizationHooks: {
        afterCreateOrganization: async ({ organization, member, user }) => {
          console.log(`[Auth] Organization created: ${organization.name} by ${user.email}`);
          // Setup default resources, Stripe customer, etc.
        },
        afterAddMember: async ({ member, user, organization }) => {
          console.log(`[Auth] ${user.email} joined ${organization.name}`);
        },
      },
    }),
  ],

  // ============================================
  // Advanced Configuration
  // ============================================
  advanced: {
    database: {
      generateId: () => crypto.randomUUID(),
    },
  },

  // ============================================
  // Rate Limiting
  // ============================================
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
  },

  // ============================================
  // Experimental Features
  // ============================================
  experimental: {
    joins: true,
  },

  // ============================================
  // Trusted Origins
  // ============================================
  trustedOrigins: [
    process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  ],
});

export type Auth = typeof auth;
```

### 2. Auth Client (`apps/web/src/lib/auth/auth-client.ts`)

```typescript
import { createAuthClient } from 'better-auth/react';
import { organizationClient, inferOrgAdditionalFields } from 'better-auth/client/plugins';
import { ac, roles } from '@repo/shared';
import type { Auth } from './auth.config';

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',

  plugins: [
    organizationClient({
      ac,
      roles,
      teams: {
        enabled: true,
      },
      dynamicAccessControl: {
        enabled: true,
      },
      schema: inferOrgAdditionalFields<Auth>(),
    }),
  ],
});

// Export commonly used functions
export const {
  signIn,
  signUp,
  signOut,
  useSession,
  useActiveOrganization,
  useListOrganizations,
  organization,
  getSession,
} = authClient;
```

### 3. API Route Handler (`apps/web/app/api/auth/[...all]/route.ts`)

```typescript
import { auth } from '@/lib/auth/auth.config';
import { toNextJsHandler } from 'better-auth/next-js';

export const { GET, POST } = toNextJsHandler(auth);
```

### 4. Server-side Auth Helpers (`apps/web/src/lib/auth/auth.server.ts`)

```typescript
import { headers } from 'next/headers';
import { auth } from './auth.config';
import type { AuthSessionData } from '@repo/shared';

/**
 * Get the current session on the server
 */
export async function getServerSession(): Promise<AuthSessionData | null> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session;
}

/**
 * Require authentication - throws if not authenticated
 */
export async function requireAuth(): Promise<AuthSessionData> {
  const session = await getServerSession();
  if (!session) {
    throw new Error('Authentication required');
  }
  return session;
}

/**
 * Get the current user's active organization
 */
export async function getActiveOrganization() {
  const result = await auth.api.getFullOrganization({
    headers: await headers(),
  });
  return result;
}

/**
 * Check if user has permission
 */
export async function hasPermission(permissions: Record<string, string[]>): Promise<boolean> {
  try {
    const result = await auth.api.hasPermission({
      headers: await headers(),
      body: { permissions },
    });
    return result?.hasPermission ?? false;
  } catch {
    return false;
  }
}
```

### 5. Middleware (`apps/web/src/middleware.ts`)

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Public routes that don't require authentication
const publicRoutes = [
  '/',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/invite',
];

// Auth routes (should redirect to dashboard if authenticated)
const authRoutes = ['/login', '/signup'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip API routes and static files
  if (pathname.startsWith('/api') || pathname.startsWith('/_next') || pathname.includes('.')) {
    return NextResponse.next();
  }

  // Check session cookie
  const sessionCookie = request.cookies.get('better-auth.session_token');
  const isAuthenticated = !!sessionCookie;

  // Check if route is public
  const isPublicRoute = publicRoutes.some(
    route => pathname === route || pathname.startsWith(`${route}/`),
  );

  // Check if route is auth route
  const isAuthRoute = authRoutes.includes(pathname);

  // Redirect authenticated users away from auth routes
  if (isAuthenticated && isAuthRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Redirect unauthenticated users to login
  if (!isAuthenticated && !isPublicRoute) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

---

## NestJS API Setup

### 1. Auth Module (`apps/api/src/auth/auth.module.ts`)

```typescript
import { Module, Global } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { BetterAuthService } from './better-auth.service';
import { AuthGuard } from './auth.guard';
import { PermissionsGuard } from './permissions.guard';

@Global()
@Module({
  providers: [
    BetterAuthService,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    PermissionsGuard,
  ],
  exports: [BetterAuthService],
})
export class AuthModule {}
```

### 2. Better Auth Service (`apps/api/src/auth/better-auth.service.ts`)

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthContext, AuthSessionData } from '@repo/shared';

@Injectable()
export class BetterAuthService {
  private readonly betterAuthUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.betterAuthUrl = this.configService.getOrThrow('BETTER_AUTH_URL');
  }

  /**
   * Validate a session token by calling the Better Auth server
   */
  async validateSession(token: string): Promise<AuthSessionData> {
    try {
      const response = await fetch(`${this.betterAuthUrl}/api/auth/get-session`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new UnauthorizedException('Invalid session');
      }

      const data = await response.json();

      if (!data?.session || !data?.user) {
        throw new UnauthorizedException('Invalid session data');
      }

      return data as AuthSessionData;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Failed to validate session');
    }
  }

  /**
   * Get the full organization context for the current user
   */
  async getOrganizationContext(token: string): Promise<AuthContext> {
    const session = await this.validateSession(token);

    // If user has an active organization, fetch it
    if (session.session.activeOrganizationId) {
      const orgResponse = await fetch(
        `${this.betterAuthUrl}/api/auth/organization/get-full-organization`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (orgResponse.ok) {
        const orgData = await orgResponse.json();
        return {
          ...session,
          organization: orgData?.organization ?? null,
          member: orgData?.activeMember ?? null,
          permissions: orgData?.permissions ?? {},
        };
      }
    }

    return {
      ...session,
      organization: null,
      member: null,
      permissions: {},
    };
  }

  /**
   * Check if user has specific permissions
   */
  async hasPermission(token: string, permissions: Record<string, string[]>): Promise<boolean> {
    try {
      const response = await fetch(`${this.betterAuthUrl}/api/auth/organization/has-permission`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ permissions }),
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      return data?.hasPermission ?? false;
    } catch {
      return false;
    }
  }
}
```

### 3. Auth Guard (`apps/api/src/auth/auth.guard.ts`)

```typescript
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { BetterAuthService } from './better-auth.service';
import { IS_PUBLIC_KEY } from './decorators/public.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly betterAuthService: BetterAuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Missing authentication token');
    }

    try {
      const authContext = await this.betterAuthService.getOrganizationContext(token);

      // Attach auth context to request
      request.user = authContext.user;
      request.session = authContext.session;
      request.organization = authContext.organization;
      request.member = authContext.member;
      request.permissions = authContext.permissions;
      request.authContext = authContext;

      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private extractToken(request: any): string | undefined {
    // Try Bearer token first
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Try session cookie
    const sessionCookie = request.cookies?.['better-auth.session_token'];
    if (sessionCookie) {
      return sessionCookie;
    }

    return undefined;
  }
}
```

### 4. Permissions Guard (`apps/api/src/auth/permissions.guard.ts`)

```typescript
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY, type RequiredPermissions } from './decorators/permissions.decorator';
import { BetterAuthService } from './better-auth.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly betterAuthService: BetterAuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<RequiredPermissions>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const token = request.headers.authorization?.substring(7);

    if (!token) {
      throw new ForbiddenException('Missing authentication token');
    }

    const hasPermission = await this.betterAuthService.hasPermission(token, requiredPermissions);

    if (!hasPermission) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
```

### 5. Decorators

**Public Decorator (`apps/api/src/auth/decorators/public.decorator.ts`):**

```typescript
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

**Current User Decorator (`apps/api/src/auth/decorators/current-user.decorator.ts`):**

```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthUser, AuthContext } from '@repo/shared';

export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthUser;

    return data ? user?.[data] : user;
  },
);

export const CurrentOrganization = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return request.organization;
});

export const CurrentMember = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return request.member;
});

export const Auth = createParamDecorator((data: unknown, ctx: ExecutionContext): AuthContext => {
  const request = ctx.switchToHttp().getRequest();
  return request.authContext;
});
```

**Permissions Decorator (`apps/api/src/auth/decorators/permissions.decorator.ts`):**

```typescript
import { SetMetadata, UseGuards, applyDecorators } from '@nestjs/common';
import { PermissionsGuard } from '../permissions.guard';
import type { Permission } from '@repo/shared';

export const PERMISSIONS_KEY = 'permissions';
export type RequiredPermissions = Record<string, string[]>;

/**
 * Require specific permissions to access a route
 *
 * @example
 * @RequirePermissions({ product: ['create', 'update'] })
 * @Post()
 * createProduct() {}
 */
export const RequirePermissions = (permissions: RequiredPermissions) =>
  applyDecorators(SetMetadata(PERMISSIONS_KEY, permissions), UseGuards(PermissionsGuard));

/**
 * Shorthand permission decorators for common resources
 */
export const CanReadProducts = () => RequirePermissions({ product: ['read'] });
export const CanWriteProducts = () => RequirePermissions({ product: ['create', 'update'] });
export const CanDeleteProducts = () => RequirePermissions({ product: ['delete'] });

export const CanReadOrders = () => RequirePermissions({ order: ['read'] });
export const CanWriteOrders = () => RequirePermissions({ order: ['create', 'update'] });
export const CanFulfillOrders = () => RequirePermissions({ order: ['fulfill'] });
```

### 6. Example Protected Controller

```typescript
import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { CurrentUser, CurrentOrganization, Auth } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { RequirePermissions, CanWriteProducts } from '../auth/decorators/permissions.decorator';
import type { AuthUser, Organization, AuthContext } from '@repo/shared';

@Controller('products')
export class ProductsController {
  // Public endpoint
  @Public()
  @Get('featured')
  getFeaturedProducts() {
    return { products: [] };
  }

  // Requires authentication only
  @Get()
  async getProducts(@CurrentUser() user: AuthUser) {
    console.log(`User ${user.email} is fetching products`);
    return { products: [] };
  }

  // Requires specific permissions
  @Post()
  @RequirePermissions({ product: ['create'] })
  async createProduct(
    @CurrentUser() user: AuthUser,
    @CurrentOrganization() org: Organization,
    @Body() createProductDto: any,
  ) {
    console.log(`User ${user.email} creating product in org ${org.name}`);
    return { product: {} };
  }

  // Using shorthand decorator
  @Post(':id/publish')
  @CanWriteProducts()
  async publishProduct(@Param('id') id: string, @Auth() auth: AuthContext) {
    console.log(`Publishing product ${id} by ${auth.user.email}`);
    return { success: true };
  }

  // Multiple permissions
  @Post(':id/archive')
  @RequirePermissions({ product: ['update', 'archive'] })
  async archiveProduct(@Param('id') id: string) {
    return { success: true };
  }
}
```

---

## Database Schema

### Core Auth Schema (`packages/shared/src/database/schema/auth.schema.ts`)

This schema is auto-generated by Better Auth CLI but here's the structure:

```typescript
import { pgTable, text, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// User table
export const authUsers = pgTable(
  'user',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    emailVerified: boolean('email_verified').notNull().default(false),
    image: text('image'),
    firstName: text('first_name'),
    lastName: text('last_name'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  t => [index('user_email_idx').on(t.email)],
);

// Session table
export const authSessions = pgTable('session', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => authUsers.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  activeOrganizationId: text('active_organization_id'),
  activeTeamId: text('active_team_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Account table (OAuth providers)
export const authAccounts = pgTable('account', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => authUsers.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  scope: text('scope'),
  idToken: text('id_token'),
  password: text('password'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Verification table
export const authVerifications = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

### Organization Schema (`packages/shared/src/database/schema/organization.schema.ts`)

```typescript
import { pgTable, text, timestamp, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { authUsers } from './auth.schema';

// Organization table
export const organizations = pgTable(
  'organization',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    logo: text('logo'),
    metadata: text('metadata'), // JSON string
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  t => [index('organization_slug_idx').on(t.slug)],
);

// Member table
export const members = pgTable(
  'member',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('member'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  t => [index('member_user_idx').on(t.userId), index('member_org_idx').on(t.organizationId)],
);

// Invitation table
export const invitations = pgTable('invitation', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  role: text('role').notNull().default('member'),
  status: text('status').notNull().default('pending'),
  inviterId: text('inviter_id')
    .notNull()
    .references(() => authUsers.id),
  teamId: text('team_id'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Team table
export const teams = pgTable('team', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
});

// Team member table
export const teamMembers = pgTable('team_member', {
  id: text('id').primaryKey(),
  teamId: text('team_id')
    .notNull()
    .references(() => teams.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => authUsers.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Organization role table (for dynamic access control)
export const organizationRoles = pgTable('organization_role', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  permission: text('permission').notNull(), // JSON string
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Relations
export const organizationsRelations = relations(organizations, ({ many }) => ({
  members: many(members),
  invitations: many(invitations),
  teams: many(teams),
}));

export const membersRelations = relations(members, ({ one }) => ({
  user: one(authUsers, { fields: [members.userId], references: [authUsers.id] }),
  organization: one(organizations, {
    fields: [members.organizationId],
    references: [organizations.id],
  }),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [teams.organizationId],
    references: [organizations.id],
  }),
  members: many(teamMembers),
}));
```

---

## Environment Variables

```env
# Better Auth (Next.js)
BETTER_AUTH_SECRET=your-secret-key-min-32-chars
BETTER_AUTH_URL=http://localhost:3000

# Next.js URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3001

# OAuth Providers
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# Supabase Database
DATABASE_URL=postgresql://postgres:password@db.xxx.supabase.co:5432/postgres

# NestJS API
PORT=3001
```

---

## CLI Commands

```bash
# Generate Better Auth schema for Drizzle
pnpm dlx @better-auth/cli generate

# Run Drizzle migrations
pnpm --filter @repo/shared db:generate
pnpm --filter @repo/shared db:migrate

# Or push directly (development)
pnpm --filter @repo/shared db:push
```

---

## Best Practices

### 1. **Single Source of Truth**

- Keep all auth schema in `packages/shared`
- Export types and permissions from shared package
- Both Next.js and NestJS import from shared

### 2. **Bearer Token Pattern**

- Next.js manages sessions via cookies
- NestJS validates tokens by calling Better Auth API
- Use `bearer()` plugin for API token support

### 3. **Permission Checks**

- Use `hasPermission` API for server-side checks
- Use `checkRolePermission` for client-side (static roles only)
- Always validate permissions on both frontend and backend

### 4. **Organization Context**

- Store `activeOrganizationId` in session
- Pass organization context to all API calls
- Use guards to enforce organization membership

### 5. **Error Handling**

- Return standardized error responses
- Log authentication failures
- Implement rate limiting

### 6. **Security**

- Always use HTTPS in production
- Set secure cookie options
- Validate all inputs
- Implement CSRF protection

---

## Quick Start Checklist

- [ ] Install dependencies in all packages
- [ ] Set up environment variables
- [ ] Create shared schema files
- [ ] Configure Better Auth in Next.js
- [ ] Set up auth client
- [ ] Create API route handler
- [ ] Configure middleware
- [ ] Set up NestJS auth module
- [ ] Create guards and decorators
- [ ] Run database migrations
- [ ] Test authentication flow
- [ ] Test organization features
- [ ] Test permission checks

---

## Resources

- [Better Auth Documentation](https://www.better-auth.com/docs)
- [Better Auth Organization Plugin](https://www.better-auth.com/docs/plugins/organization)
- [Drizzle ORM Documentation](https://orm.drizzle.team/docs/overview)
- [NestJS Documentation](https://docs.nestjs.com)
- [Next.js App Router](https://nextjs.org/docs/app)
