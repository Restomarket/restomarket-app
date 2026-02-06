import { createAuthClient } from 'better-auth/react';
import { organizationClient, inferAdditionalFields, adminClient } from 'better-auth/client/plugins';
import { useState, useEffect } from 'react';
import type { auth } from './auth.config';

/**
 * Better Auth Client
 *
 * Production-ready auth client with React hooks for:
 * - Email/password & OAuth authentication
 * - Session management
 * - Organization & team management
 * - Admin user management
 * - Permission checks
 *
 * @example
 * ```tsx
 * import { authClient, useSession } from '@/lib/auth/auth.client';
 *
 * // In a component
 * const { data: session } = useSession();
 *
 * // Sign in
 * await authClient.signIn.email({ email, password });
 * ```
 */
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  plugins: [
    // Infer additional fields from server auth config
    inferAdditionalFields<typeof auth>(),

    // Admin plugin client
    adminClient(),

    // Organization plugin for client
    organizationClient({
      teams: {
        enabled: true,
      },
    }),
  ],
});

// ============================================
// Export Individual Methods & Hooks
// ============================================

// Session hooks
export const useSession = authClient.useSession;

// Email/password methods
export const signIn = authClient.signIn;
export const signUp = authClient.signUp;
export const signOut = authClient.signOut;

// Password reset
export const forgotPassword =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (authClient as any).forgetPassword ??
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (authClient as any).forgotPassword ??
  authClient.resetPassword;
export const resetPassword = authClient.resetPassword;

// Email verification
export const sendVerificationEmail = authClient.sendVerificationEmail;
export const verifyEmail = authClient.verifyEmail;

// Organization methods
export const { organization } = authClient;

// Admin methods (for admin users only)
export const admin = authClient.admin;

// ============================================
// Type Exports
// ============================================

export type Session = typeof authClient.$Infer.Session;
export type User = typeof authClient.$Infer.Session.user;

// ============================================
// Utility Hooks
// ============================================

/**
 * Hook to get current active organization from session
 */
export function useOrganization() {
  const { isPending, error } = useSession();
  const activeOrg = authClient.useActiveOrganization();

  return {
    organization: activeOrg.data,
    isPending: isPending || activeOrg.isPending,
    error: error || activeOrg.error,
    // Switch organization
    setActiveOrganization: (organizationId: string) => organization.setActive({ organizationId }),
    // Organization CRUD
    createOrganization: organization.create,
    updateOrganization: organization.update,
    deleteOrganization: organization.delete,
  };
}

/**
 * Hook to get current user's role in active organization
 * Implements hierarchical role checks where higher roles include lower role permissions
 */
export function useRole() {
  const { data: session, isPending, error } = useSession();
  const { organization: activeOrg } = useOrganization();

  // Find member entry for current user in active org
  const member = activeOrg?.members?.find(
    (m: { userId: string }) => m.userId === session?.user?.id,
  );

  // Cast to string to avoid TypeScript narrowing issues with role comparisons
  const role = member?.role as string | undefined;

  // Define role hierarchy (higher number = more permissions)
  const roleHierarchy: Record<string, number> = {
    owner: 5,
    admin: 4,
    manager: 3,
    member: 2,
    viewer: 1,
  };

  const currentLevel = role ? roleHierarchy[role] || 0 : 0;

  return {
    role,
    isPending,
    error,
    // Hierarchical checks (includes higher roles)
    isOwner: currentLevel >= 5,
    isAdmin: currentLevel >= 4,
    isManager: currentLevel >= 3,
    isMember: currentLevel >= 2,
    isViewer: currentLevel >= 1,
    // Exact role checks (if needed)
    isExactlyOwner: role === 'owner',
    isExactlyAdmin: role === 'admin',
    isExactlyManager: role === 'manager',
    isExactlyMember: role === 'member',
    isExactlyViewer: role === 'viewer',
    // Helper function
    hasMinimumRole: (minRole: string) => {
      const minLevel = roleHierarchy[minRole] || 0;
      return currentLevel >= minLevel;
    },
  };
}

/**
 * Hook to manage team within organization
 */
export function useTeam() {
  const { data: session, isPending, error } = useSession();
  const activeTeamId = session?.session?.activeTeamId;

  return {
    activeTeamId,
    isPending,
    error,
    // Team CRUD
    createTeam: organization.createTeam,
    updateTeam: organization.updateTeam,
    removeTeam: organization.removeTeam,
    // Team members
    addTeamMember: organization.addTeamMember,
    removeTeamMember: organization.removeTeamMember,
    // Set active team
    setActiveTeam: organization.setActiveTeam,
  };
}

/**
 * Hook to check permissions with client-side caching
 * Cache is automatically cleared when organization changes
 *
 * @example
 * ```tsx
 * const { hasPermission, clearCache } = usePermissions();
 *
 * if (await hasPermission('product:create')) {
 *   // Show create button
 * }
 *
 * // Manually clear cache if needed
 * clearCache();
 * ```
 */
export function usePermissions() {
  const { data: session, isPending, error } = useSession();
  const [cache, setCache] = useState<Record<string, boolean>>({});

  // Clear cache when organization changes
  useEffect(() => {
    setCache({});
  }, [session?.session?.activeOrganizationId]);

  const hasPermission = async (permission: string): Promise<boolean> => {
    if (!session?.session?.activeOrganizationId) return false;

    // Check cache first
    if (cache[permission] !== undefined) {
      return cache[permission];
    }

    try {
      const result = await organization.hasPermission({
        permission: permission as never, // Cast due to strict typing
      });
      const allowed = result.data?.success ?? false;

      // Cache the result
      setCache(prev => ({ ...prev, [permission]: allowed }));

      return allowed;
    } catch {
      return false;
    }
  };

  const clearCache = () => {
    setCache({});
  };

  return {
    hasPermission,
    clearCache,
    isPending,
    error,
  };
}

/**
 * Hook for invitation management
 */
export function useInvitations() {
  return {
    // Send invitation
    inviteMember: organization.inviteMember,
    // Accept invitation
    acceptInvitation: organization.acceptInvitation,
    // Reject invitation
    rejectInvitation: organization.rejectInvitation,
    // Cancel invitation (sent by admin)
    cancelInvitation: organization.cancelInvitation,
    // Get invitation by ID
    getInvitation: organization.getInvitation,
  };
}

/**
 * Hook for member management
 */
export function useMembers() {
  return {
    // Get full member list (via getFullOrganization)
    getFullOrganization: organization.getFullOrganization,
    // Update member role
    updateMemberRole: organization.updateMemberRole,
    // Remove member
    removeMember: organization.removeMember,
    // Get active member (current user)
    getActiveMember: organization.getActiveMember,
  };
}

/**
 * Hook for admin user management
 * Only available to users with admin role
 *
 * @example
 * ```tsx
 * const { listUsers, setRole, impersonate } = useAdmin();
 *
 * // List all users
 * const users = await listUsers();
 *
 * // Set user role
 * await setRole({ userId: '123', role: 'admin' });
 *
 * // Impersonate user (for debugging)
 * await impersonate({ userId: '123' });
 * ```
 */
export function useAdmin() {
  return {
    // List all users
    listUsers: admin.listUsers,
    // Create user as admin
    createUser: admin.createUser,
    // Set user role
    setRole: admin.setRole,
    // Ban/unban user
    banUser: admin.banUser,
    unbanUser: admin.unbanUser,
    // Impersonate user (for support/debugging)
    impersonateUser: admin.impersonateUser,
    // Stop impersonation
    stopImpersonating: admin.stopImpersonating,
  };
}
