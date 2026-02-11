import { uuid, timestamp } from 'drizzle-orm/pg-core';

/**
 * Base entity fields for business tables (NON-AUTH tables only)
 *
 * IMPORTANT: DO NOT use for Better Auth tables (user, session, organization, etc.)
 * Better Auth requires text('id') for all its tables, not uuid('id').
 *
 * Use this for your custom business tables like:
 * - products
 * - orders
 * - customers
 * - etc.
 *
 * Fields included:
 * - id: Primary key (UUID v4) - Note: Better Auth uses text IDs
 * - createdAt: Creation timestamp
 * - updatedAt: Last update timestamp (used for optimistic locking)
 * - deletedAt: Soft delete timestamp (null = not deleted)
 *
 * @example
 * ```ts
 * export const products = pgTable('products', {
 *   ...baseEntityFields,
 *   name: text('name').notNull(),
 *   price: numeric('price').notNull(),
 * });
 * ```
 */
export const baseEntityFields = {
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
};
