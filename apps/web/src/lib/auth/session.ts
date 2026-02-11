import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from './auth.config';

/**
 * Server-Side Session Utilities
 *
 * These utilities provide secure session validation for:
 * - Server Components (RSC)
 * - Server Actions
 * - Route Handlers
 *
 * ⚠️ CRITICAL: Always use these in protected routes/actions
 * The proxy.ts only does optimistic checks - it doesn't validate sessions!
 */

/**
 * Get the current session (returns null if not authenticated)
 *
 * Usage in Server Components:
 * ```tsx
 * import { getSession } from '@/lib/auth/session';
 *
 * export default async function ProfilePage() {
 *   const session = await getSession();
 *   if (!session) {
 *     redirect('/login');
 *   }
 *   return <div>Welcome {session.user.name}</div>;
 * }
 * ```
 */
export async function getSession() {
  return await auth.api.getSession({
    headers: await headers(),
  });
}

/**
 * Require authentication - throws redirect if not authenticated
 *
 * Usage in Server Components:
 * ```tsx
 * import { requireAuth } from '@/lib/auth/session';
 *
 * export default async function DashboardPage() {
 *   const session = await requireAuth();
 *   return <div>Welcome {session.user.name}</div>;
 * }
 * ```
 *
 * Usage in Server Actions:
 * ```tsx
 * 'use server';
 * import { requireAuth } from '@/lib/auth/session';
 *
 * export async function updateProfile(data: FormData) {
 *   const session = await requireAuth();
 *   // ... update profile
 * }
 * ```
 */
export async function requireAuth() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  return session;
}

/**
 * Get current user (throws if not authenticated)
 */
export async function getCurrentUser() {
  const session = await requireAuth();
  return session.user;
}

/**
 * Check if user has specific role in organization
 *
 * Usage:
 * ```tsx
 * const hasAccess = await hasRole('admin');
 * if (!hasAccess) {
 *   redirect('/unauthorized');
 * }
 * ```
 */
export async function hasRole(role: string, organizationId?: string) {
  const session = await getSession();

  if (!session) {
    return false;
  }

  // Get active organization from session or use provided ID
  const orgId =
    organizationId ||
    ((session.session as Record<string, unknown>).activeOrganizationId as string | undefined);

  if (!orgId) {
    return false;
  }

  // Check user's role in the organization
  // This would need to query the member table
  // Implement based on your needs
  return true; // Placeholder
}

/**
 * Require specific role (throws redirect if not authorized)
 */
export async function requireRole(role: string, organizationId?: string) {
  const hasRequiredRole = await hasRole(role, organizationId);

  if (!hasRequiredRole) {
    redirect('/unauthorized');
  }
}
