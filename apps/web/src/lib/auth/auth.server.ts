import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { auth } from './auth.config';
import type { AuthContext, AuthSessionData } from '@repo/shared/auth';

/**
 * Server-side Authentication Utilities
 *
 * These functions are for use in:
 * - Server Components
 * - Server Actions
 * - Route Handlers
 *
 * @example
 * ```tsx
 * // Server Component
 * import { getServerSession, requireAuth } from '@/lib/auth/auth.server';
 *
 * export default async function DashboardPage() {
 *   const session = await requireAuth();
 *   return <div>Welcome, {session.user.email}</div>;
 * }
 * ```
 */

// ============================================
// Get Session (Cached)
// ============================================

/**
 * Get the current session on the server
 * Uses React's cache() for request deduplication
 *
 * @returns Session data or null if not authenticated
 */
export const getServerSession = cache(async (): Promise<AuthSessionData | null> => {
  const headersList = await headers();
  const session = await auth.api.getSession({
    headers: headersList,
  });

  if (!session) {
    return null;
  }

  return session as unknown as AuthSessionData;
});

// ============================================
// Auth Guards
// ============================================

/**
 * Require authentication - redirects to login if not authenticated
 *
 * @param redirectTo - URL to redirect to after login (default: current page)
 * @returns Session data (guaranteed to exist)
 *
 * @example
 * ```tsx
 * export default async function ProtectedPage() {
 *   const session = await requireAuth();
 *   // User is guaranteed to be authenticated here
 * }
 * ```
 */
export async function requireAuth(redirectTo?: string): Promise<AuthSessionData> {
  const session = await getServerSession();

  if (!session) {
    const callbackUrl = redirectTo
      ? encodeURIComponent(redirectTo)
      : encodeURIComponent('/dashboard');
    redirect(`/login?callbackUrl=${callbackUrl}`);
  }

  return session;
}

/**
 * Require organization - redirects if no active organization
 *
 * @returns Session data with active organization
 *
 * @example
 * ```tsx
 * export default async function OrgDashboard() {
 *   const session = await requireOrganization();
 *   // User has an active organization
 * }
 * ```
 */
export async function requireOrganization(): Promise<
  AuthSessionData & { session: { activeOrganizationId: string } }
> {
  const session = await requireAuth();

  if (!session.session.activeOrganizationId) {
    redirect('/organizations/select');
  }

  return session as AuthSessionData & {
    session: { activeOrganizationId: string };
  };
}

// ============================================
// Permission Checking
// ============================================

/**
 * Check if user has a specific permission in the active organization
 *
 * @param permission - Permission to check (e.g., 'product:create')
 * @returns True if user has permission
 *
 * @example
 * ```tsx
 * if (await hasPermission('product:delete')) {
 *   // Show delete button
 * }
 * ```
 */
export async function hasPermission(permission: string): Promise<boolean> {
  const headersList = await headers();

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = auth.api as any;
    const result = await api.hasPermission({
      headers: headersList,
      body: {
        permission: permission as never, // Cast for strict typing
      },
    });

    return result?.success ?? false;
  } catch {
    return false;
  }
}

/**
 * Require permission - throws error if user doesn't have permission
 *
 * @param permission - Permission to check
 * @param errorMessage - Custom error message
 *
 * @example
 * ```tsx
 * await requirePermission('product:create');
 * // User has permission, continue...
 * ```
 */
export async function requirePermission(permission: string, errorMessage?: string): Promise<void> {
  const allowed = await hasPermission(permission);

  if (!allowed) {
    throw new Error(errorMessage || `Permission denied: ${permission}`);
  }
}

// ============================================
// User Context
// ============================================

/**
 * Get full auth context for the current user
 * Useful for passing to client components or APIs
 *
 * @returns AuthContext with user, session, and permissions
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  const session = await getServerSession();

  if (!session) {
    return null;
  }

  return {
    user: session.user,
    session: session.session,
    organizationId: session.session.activeOrganizationId ?? null,
    teamId: session.session.activeTeamId ?? null,
  };
}

// ============================================
// Organization Helpers
// ============================================

/**
 * Get the current user's active organization
 */
export async function getActiveOrganization() {
  const headersList = await headers();

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = auth.api as any;
    const result = await api.getFullOrganization({
      headers: headersList,
    });

    return result || null;
  } catch {
    return null;
  }
}

/**
 * Get all organizations the user belongs to
 */
export async function getUserOrganizations() {
  const headersList = await headers();

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = auth.api as any;
    const result = await api.listOrganizations({
      headers: headersList,
    });

    return result || [];
  } catch {
    return [];
  }
}

/**
 * Get current user's role in active organization
 */
export async function getUserRole(): Promise<string | null> {
  const headersList = await headers();

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = auth.api as any;
    const member = await api.getActiveMember({
      headers: headersList,
    });

    return member?.role ?? null;
  } catch {
    return null;
  }
}

// ============================================
// Token Generation (for API calls)
// ============================================

/**
 * Generate a bearer token for API authentication
 * Use this when calling NestJS API from server components/actions
 *
 * @returns Bearer token string
 *
 * @example
 * ```ts
 * const token = await generateBearerToken();
 *
 * fetch(API_URL, {
 *   headers: {
 *     Authorization: `Bearer ${token}`,
 *   },
 * });
 * ```
 */
export async function generateBearerToken(): Promise<string | null> {
  const session = await getServerSession();

  if (!session) {
    return null;
  }

  // The session token can be used as bearer token
  // Better Auth's bearer plugin validates this
  return session.session.token;
}
