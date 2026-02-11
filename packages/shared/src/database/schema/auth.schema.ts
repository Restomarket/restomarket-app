import {
  pgTable,
  text,
  varchar,
  boolean,
  timestamp,
  integer,
  bigint,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

/**
 * Better Auth Core Schema
 *
 * These tables are required by Better Auth for authentication.
 * Schema follows Better Auth's expected structure with custom field mappings.
 *
 * @see https://www.better-auth.com/docs/concepts/database
 */

// ============================================
// User Table (Better Auth Core + Business Logic)
// ============================================
export const authUsers = pgTable(
  'user',
  {
    // Better Auth required fields
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    emailVerified: boolean('email_verified').notNull().default(false),
    image: text('image'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),

    // Custom fields for your application
    firstName: varchar('first_name', { length: 100 }),
    lastName: varchar('last_name', { length: 100 }),

    // Business logic fields (merged from users table)
    isActive: boolean('is_active').notNull().default(true),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  },
  table => [
    index('auth_users_email_idx').on(table.email),
    index('auth_users_created_at_idx').on(table.createdAt),
    // Index for active users query (soft delete + active status)
    index('auth_users_active_idx').on(table.isActive, table.deletedAt),
  ],
);

// ============================================
// Session Table (Better Auth Core)
// ============================================
export const authSessions = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),

    // Organization plugin fields
    // Note: These do NOT have FK constraints intentionally - Better Auth manages them
    // This prevents cascade deletion issues when orgs/teams are deleted
    // Better Auth will set these to null when the referenced entity is removed
    activeOrganizationId: text('active_organization_id'),
    activeTeamId: text('active_team_id'),

    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  table => [
    index('auth_sessions_user_id_idx').on(table.userId),
    index('auth_sessions_token_idx').on(table.token),
    index('auth_sessions_expires_at_idx').on(table.expiresAt),
  ],
);

// ============================================
// Account Table (Better Auth Core - OAuth/Credentials)
// ============================================
export const authAccounts = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', {
      withTimezone: true,
      mode: 'date',
    }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', {
      withTimezone: true,
      mode: 'date',
    }),
    scope: text('scope'),
    idToken: text('id_token'),
    password: text('password'), // For email/password auth (hashed)
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  table => [
    index('auth_accounts_user_id_idx').on(table.userId),
    index('auth_accounts_provider_idx').on(table.providerId, table.accountId),
  ],
);

// ============================================
// Verification Table (Better Auth Core - Email verification, password reset)
// ============================================
export const authVerifications = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  table => [index('auth_verifications_identifier_idx').on(table.identifier)],
);

// ============================================
// Rate Limit Table (Better Auth Core - Rate limiting)
// ============================================
export const authRateLimits = pgTable(
  'rate_limit',
  {
    key: text('key').primaryKey(),
    count: integer('count').notNull().default(0),
    lastRequest: bigint('last_request', { mode: 'number' }).notNull(),
  },
  table => [
    index('auth_rate_limits_key_idx').on(table.key),
    index('auth_rate_limits_last_request_idx').on(table.lastRequest),
  ],
);

// ============================================
// Relations (Required for Drizzle Joins - Better Auth 1.4+)
// ============================================
export const authUsersRelations = relations(authUsers, ({ many }) => ({
  sessions: many(authSessions),
  accounts: many(authAccounts),
}));

export const authSessionsRelations = relations(authSessions, ({ one }) => ({
  user: one(authUsers, {
    fields: [authSessions.userId],
    references: [authUsers.id],
  }),
}));

export const authAccountsRelations = relations(authAccounts, ({ one }) => ({
  user: one(authUsers, {
    fields: [authAccounts.userId],
    references: [authUsers.id],
  }),
}));

// ============================================
// Type Exports
// ============================================
export type AuthUser = typeof authUsers.$inferSelect;
export type NewAuthUser = typeof authUsers.$inferInsert;
export type AuthSession = typeof authSessions.$inferSelect;
export type NewAuthSession = typeof authSessions.$inferInsert;
export type AuthAccount = typeof authAccounts.$inferSelect;
export type NewAuthAccount = typeof authAccounts.$inferInsert;
export type AuthVerification = typeof authVerifications.$inferSelect;
export type NewAuthVerification = typeof authVerifications.$inferInsert;
export type AuthRateLimit = typeof authRateLimits.$inferSelect;
export type NewAuthRateLimit = typeof authRateLimits.$inferInsert;
