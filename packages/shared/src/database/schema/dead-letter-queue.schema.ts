import {
  pgTable,
  uuid,
  varchar,
  text,
  jsonb,
  integer,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';

/**
 * Dead Letter Queue Schema
 *
 * Stores permanently failed sync jobs after BullMQ retry exhaustion.
 * Allows manual retry or resolution with audit trail.
 *
 * Lifecycle:
 * - Job exhausts BullMQ retries → @OnQueueFailed → INSERT here
 * - Admin reviews → retry (re-enqueue to BullMQ) OR resolve (mark resolved)
 *
 * Retention: 30 days for resolved entries (via SyncCleanupService), indefinite for unresolved
 */

export const deadLetterQueue = pgTable(
  'dead_letter_queue',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    // Reference to original sync job (nullable if job was deleted)
    originalJobId: uuid('original_job_id'), // FK to sync_jobs (relation defined in sync-relations.ts)

    // Vendor identification
    vendorId: varchar('vendor_id', { length: 100 }).notNull(),

    // Operation type (e.g., 'create_order', 'reserve_stock')
    operation: varchar('operation', { length: 50 }).notNull(),

    // Original job payload (for retry)
    payload: jsonb('payload').notNull(),

    // Failure details
    failureReason: text('failure_reason').notNull(),
    failureStack: text('failure_stack'),

    // Retry tracking (manual retries via admin)
    attemptCount: integer('attempt_count').notNull().default(0),
    lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true, mode: 'date' }),

    // Resolution tracking
    resolved: boolean('resolved').notNull().default(false),
    resolvedAt: timestamp('resolved_at', { withTimezone: true, mode: 'date' }),
    resolvedBy: varchar('resolved_by', { length: 100 }), // Admin user identifier or API key

    // Timestamp
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  table => [
    // Index for vendor-based queries (admin dashboard filtering)
    index('dead_letter_queue_vendor_idx').on(table.vendorId),

    // Index for resolution status (unresolved entries query)
    index('dead_letter_queue_resolved_idx').on(table.resolved),

    // Index for cleanup queries (age-based deletion)
    index('dead_letter_queue_created_idx').on(table.createdAt),

    // Index for job reference lookups
    index('dead_letter_queue_job_id_idx').on(table.originalJobId),
  ],
);

// Relations defined in sync-relations.ts to avoid circular dependencies

// ============================================
// Type Exports
// ============================================
export type DeadLetterQueueEntry = typeof deadLetterQueue.$inferSelect;
export type NewDeadLetterQueueEntry = typeof deadLetterQueue.$inferInsert;
