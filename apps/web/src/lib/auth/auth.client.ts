import { createAuthClient } from 'better-auth/react';
import { organizationClient, inferAdditionalFields } from 'better-auth/client/plugins';
import type { auth } from './auth.config';

/**
 * Better Auth Client
 *
 * This client provides React hooks and methods for authentication
 * on the client-side. Use this for:
 * - Login/logout
 * - Session management
 * - Organization switching
 * - Team management
 *
 * @example
 * ```tsx
 * import { authClient } from '@/lib/auth/auth.client';
 *
 * // In a component
 * const { data: session } = authClient.useSession();
 *
 * // Sign in
 * await authClient.signIn.email({ email, password });
 *
 * // Sign out
 * await authClient.signOut();
 * ```
 */
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  plugins: [
    // Infer additional fields from server auth config
    inferAdditionalFields<typeof auth>(),
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
// Note: The method name may vary between better-auth versions

export const forgotPassword =
  (authClient as any).forgetPassword ??
  (authClient as any).forgotPassword ??
  authClient.resetPassword;
export const resetPassword = authClient.resetPassword;

// Email verification
export const sendVerificationEmail = authClient.sendVerificationEmail;
export const verifyEmail = authClient.verifyEmail;

// Organization methods
export const { organization } = authClient;

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

  return {
    role,
    isPending,
    error,
    isOwner: role === 'owner',
    isAdmin: role === 'admin' || role === 'owner',
    isManager: role === 'manager' || role === 'admin' || role === 'owner',
    isMember: role === 'member',
    isViewer: role === 'viewer',
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
 * Hook to check permissions
 *
 * @example
 * ```tsx
 * const { hasPermission } = usePermissions();
 *
 * if (hasPermission('product:create')) {
 *   // Show create button
 * }
 * ```
 */
export function usePermissions() {
  const { data: session, isPending, error } = useSession();

  const hasPermission = async (permission: string) => {
    if (!session?.session?.activeOrganizationId) return false;

    try {
      const result = await organization.hasPermission({
        permission: permission as never, // Cast due to strict typing
      });
      return result.data?.success ?? false;
    } catch {
      return false;
    }
  };

  return {
    hasPermission,
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
