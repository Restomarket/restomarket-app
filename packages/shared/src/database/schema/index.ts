export * from './base.schema.js';
export * from './auth.schema.js';
export * from './organization.schema.js';

// ============================================
// Backward Compatibility
// ============================================
// Export authUsers as 'users' for backward compatibility
// This allows existing code to continue working without changes
export { authUsers as users } from './auth.schema.js';

// ============================================
// Better Auth Model Name Aliases
// ============================================
// Better Auth with experimental.joins expects db.query keys to match
// model names (user, session, account, verification, rateLimit).
// These aliases ensure the Drizzle query object has the correct keys.
export {
  authUsers as user,
  authSessions as session,
  authAccounts as account,
  authVerifications as verification,
  authRateLimits as rateLimit,
} from './auth.schema.js';

// Organization plugin model name aliases (singular forms)
export {
  organizations as organization,
  members as member,
  invitations as invitation,
  teams as team,
  teamMembers as teamMember,
  organizationRoles as organizationRole,
} from './organization.schema.js';

// Note: User and NewUser types are exported from types/database.types.ts
// which now infers from authUsers (via the 'users' alias above)
//
// Note: users.schema.js is now deprecated - all user data is in auth.schema.js
