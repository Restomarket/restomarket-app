/**
 * Auth Module Barrel Export
 *
 * Re-exports all auth utilities for convenient importing:
 *
 * @example
 * ```ts
 * import { auth, getServerSession, requireAuth, hasPermission } from '@/lib/auth';
 * ```
 */

// Server-side auth config
export { auth } from './auth.config';
export type { Auth } from './auth.config';

// Server utilities
export {
  getServerSession,
  requireAuth,
  requireOrganization,
  hasPermission,
  requirePermission,
  getAuthContext,
  getActiveOrganization,
  getUserOrganizations,
  getUserRole,
  generateBearerToken,
} from './auth.server';

// Re-export shared types (only types that exist in @repo/shared)
export type { AuthContext, AuthSessionData } from '@repo/shared';

// Re-export Drizzle schema types
export type { AuthUser, AuthSession, Organization, Member, Team } from '@repo/shared';
