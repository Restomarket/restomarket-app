import { pgTable, text, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { authUsers } from './auth.schema.js';

/**
 * Better Auth Organization Schema
 *
 * These tables are required by Better Auth's organization plugin.
 * They enable multi-tenancy, team management, and role-based access control.
 *
 * @see https://www.better-auth.com/docs/plugins/organization
 */

// ============================================
// Organization Table
// ============================================
export const organizations = pgTable(
  'organization',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    logo: text('logo'),
    metadata: text('metadata'), // JSON string for additional data
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  table => [
    uniqueIndex('organization_slug_idx').on(table.slug),
    index('organization_created_at_idx').on(table.createdAt),
  ],
);

// ============================================
// Member Table (Organization Membership)
// ============================================
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
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  table => [
    index('member_user_id_idx').on(table.userId),
    index('member_organization_id_idx').on(table.organizationId),
    uniqueIndex('member_user_org_unique_idx').on(table.userId, table.organizationId),
  ],
);

// ============================================
// Invitation Table
// ============================================
export const invitations = pgTable(
  'invitation',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('member'),
    status: text('status').notNull().default('pending'), // pending, accepted, rejected, cancelled
    inviterId: text('inviter_id')
      .notNull()
      .references(() => authUsers.id),
    teamId: text('team_id').references(() => teams.id, { onDelete: 'set null' }),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  table => [
    index('invitation_email_idx').on(table.email),
    index('invitation_organization_id_idx').on(table.organizationId),
    index('invitation_status_idx').on(table.status),
  ],
);

// ============================================
// Team Table
// ============================================
export const teams = pgTable(
  'team',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }),
  },
  table => [
    index('team_organization_id_idx').on(table.organizationId),
    index('team_name_idx').on(table.name),
  ],
);

// ============================================
// Team Member Table
// ============================================
export const teamMembers = pgTable(
  'team_member',
  {
    id: text('id').primaryKey(),
    teamId: text('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  table => [
    index('team_member_team_id_idx').on(table.teamId),
    index('team_member_user_id_idx').on(table.userId),
    uniqueIndex('team_member_unique_idx').on(table.teamId, table.userId),
  ],
);

// ============================================
// Organization Role Table (Dynamic Access Control)
// ============================================
export const organizationRoles = pgTable(
  'organization_role',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    permission: text('permission').notNull(), // JSON string of permissions
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  table => [
    index('organization_role_org_id_idx').on(table.organizationId),
    uniqueIndex('organization_role_unique_idx').on(table.organizationId, table.role),
  ],
);

// ============================================
// Relations
// ============================================

export const organizationsRelations = relations(organizations, ({ many }) => ({
  members: many(members),
  invitations: many(invitations),
  teams: many(teams),
  roles: many(organizationRoles),
}));

export const membersRelations = relations(members, ({ one }) => ({
  user: one(authUsers, {
    fields: [members.userId],
    references: [authUsers.id],
  }),
  organization: one(organizations, {
    fields: [members.organizationId],
    references: [organizations.id],
  }),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  organization: one(organizations, {
    fields: [invitations.organizationId],
    references: [organizations.id],
  }),
  inviter: one(authUsers, {
    fields: [invitations.inviterId],
    references: [authUsers.id],
  }),
  team: one(teams, {
    fields: [invitations.teamId],
    references: [teams.id],
  }),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [teams.organizationId],
    references: [organizations.id],
  }),
  members: many(teamMembers),
  invitations: many(invitations),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, {
    fields: [teamMembers.teamId],
    references: [teams.id],
  }),
  user: one(authUsers, {
    fields: [teamMembers.userId],
    references: [authUsers.id],
  }),
}));

export const organizationRolesRelations = relations(organizationRoles, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationRoles.organizationId],
    references: [organizations.id],
  }),
}));

// ============================================
// Type Exports
// ============================================
export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type Member = typeof members.$inferSelect;
export type NewMember = typeof members.$inferInsert;
export type Invitation = typeof invitations.$inferSelect;
export type NewInvitation = typeof invitations.$inferInsert;
export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type TeamMember = typeof teamMembers.$inferSelect;
export type NewTeamMember = typeof teamMembers.$inferInsert;
export type OrganizationRole = typeof organizationRoles.$inferSelect;
export type NewOrganizationRole = typeof organizationRoles.$inferInsert;
