import { pgTable, varchar, boolean, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { baseEntityFields } from './base.schema';

export const users = pgTable(
  'users',
  {
    ...baseEntityFields,
    email: varchar('email', { length: 255 }).notNull().unique(),
    firstName: varchar('first_name', { length: 100 }).notNull(),
    lastName: varchar('last_name', { length: 100 }).notNull(),
    isActive: boolean('is_active').notNull().default(true),
  },
  table => [
    // Composite index for common query patterns (active users, sorted by creation date)
    index('users_active_query_idx').on(table.deletedAt, table.isActive, table.createdAt),
    // B-tree indexes for text search columns
    index('users_email_idx').on(table.email),
    index('users_name_idx').on(table.firstName, table.lastName),
    // Check constraints for data integrity
    check('users_email_length_check', sql`length(${table.email}) >= 3`),
    check('users_email_normalized_check', sql`${table.email} = lower(${table.email})`),
    check('users_first_name_length_check', sql`length(${table.firstName}) >= 1`),
    check('users_last_name_length_check', sql`length(${table.lastName}) >= 1`),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

/**
 * User relations for future use
 *
 * Example usage:
 * const userWithPosts = await db.query.users.findFirst({
 *   where: eq(users.id, userId),
 *   with: {
 *     posts: true,
 *     comments: true,
 *   },
 * });
 */
// import { relations } from 'drizzle-orm';
// export const usersRelations = relations(users, ({ many }) => ({
//   posts: many(posts),
//   comments: many(comments),
//   // Add more relations as needed
// }));
