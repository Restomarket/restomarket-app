/**
 * Shared Auth Types for Turborepo
 *
 * These types are shared between Next.js and NestJS apps
 * to ensure consistent authentication handling.
 *
 * Note: For Drizzle schema types (AuthUser, AuthSession, Organization, etc.),
 * import from '@repo/shared' directly - they're exported from schemas.
 */

// ============================================
// Auth Context (for NestJS)
// ============================================

/**
 * Auth context attached to requests in NestJS
 * Contains the current user, session, and organization context
 */
export interface AuthContext {
  user: {
    id: string;
    email: string;
    name: string;
    image?: string | null;
    emailVerified: boolean;
    role?: string | null;
    banned?: boolean | null;
    banReason?: string | null;
    banExpires?: number | null;
    firstName?: string | null;
    lastName?: string | null;
    isActive?: boolean;
    deletedAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
  };
  session: {
    id: string;
    userId: string;
    token: string;
    expiresAt: Date;
    ipAddress?: string | null;
    userAgent?: string | null;
    activeOrganizationId?: string | null;
    activeTeamId?: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  organizationId: string | null;
  teamId: string | null;
}

/**
 * Session data returned from Better Auth
 */
export interface AuthSessionData {
  session: AuthContext['session'];
  user: AuthContext['user'];
}

// ============================================
// Auth Result Types
// ============================================

/**
 * Standard result wrapper for auth operations
 */
export interface AuthResult<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

// ============================================
// Organization Context Types
// ============================================

/**
 * Full organization data (from Better Auth API)
 */
export interface FullOrganizationData {
  organization: {
    id: string;
    name: string;
    slug: string;
    logo?: string | null;
    metadata?: Record<string, unknown> | null;
    createdAt: Date;
  };
  members: Array<{
    id: string;
    userId: string;
    organizationId: string;
    role: string;
    createdAt: Date;
    user: AuthContext['user'];
  }>;
  invitations: Array<{
    id: string;
    email: string;
    organizationId: string;
    role: string;
    status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
    expiresAt: Date;
    inviterId: string;
    teamId?: string | null;
    createdAt: Date;
  }>;
  teams?: Array<{
    id: string;
    name: string;
    organizationId: string;
    createdAt: Date;
    updatedAt?: Date | null;
  }>;
}

// ============================================
// Role & Permission Types (from permissions.js)
// ============================================

// Re-export from permissions module
export type { Role, Permission } from './permissions.js';
