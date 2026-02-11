import { relations } from 'drizzle-orm';
import { authUsers, authSessions, authAccounts } from './auth.schema.js';
import { members, invitations, teamMembers } from './organization.schema.js';

/**
 * Auth User Relations (cross-schema)
 *
 * Defined in a separate file to avoid circular imports between
 * auth.schema.ts and organization.schema.ts.
 */
export const authUsersRelations = relations(authUsers, ({ many }) => ({
  sessions: many(authSessions),
  accounts: many(authAccounts),
  members: many(members),
  invitations: many(invitations),
  teamMembers: many(teamMembers),
}));
