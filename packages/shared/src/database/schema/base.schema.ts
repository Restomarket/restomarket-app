import { uuid, timestamp } from 'drizzle-orm/pg-core';

/**
 * Base entity fields for all tables
 *
 * - id: Primary key (UUID v4)
 * - createdAt: Creation timestamp
 * - updatedAt: Last update timestamp (used for optimistic locking)
 * - deletedAt: Soft delete timestamp (null = not deleted)
 */
export const baseEntityFields = {
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
};
