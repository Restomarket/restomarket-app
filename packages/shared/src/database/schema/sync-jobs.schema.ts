import {
  pgTable,
  uuid,
  varchar,
  text,
  jsonb,
  integer,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';

/**
 * Sync Jobs Schema
 *
 * Tracks job lifecycle for ERP synchronization operations (primarily outbound Order→ERP).
 * Jobs are queued via BullMQ and tracked here for persistence, retry management, and audit trail.
 *
 * Lifecycle: pending → processing → completed|failed|cancelled
 * Retention: 24h for completed, 7 days for failed/pending (via SyncCleanupService)
 */

export const syncJobs = pgTable(
  'sync_jobs',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    // Reference to the PostgreSQL order (nullable because job might not be order-related in future)
    postgresOrderId: uuid('postgres_order_id'), // FK to orders table (relation defined in sync-relations.ts)

    // Vendor identification
    vendorId: varchar('vendor_id', { length: 100 }).notNull(),

    // Operation type (e.g., 'create_order', 'reserve_stock', 'update_order')
    operation: varchar('operation', { length: 50 }).notNull(),

    // Job status: pending, processing, completed, failed, cancelled
    status: varchar('status', { length: 20 }).notNull().default('pending'),

    // Job payload (sent to agent)
    payload: jsonb('payload').notNull(),

    // Retry tracking
    retryCount: integer('retry_count').notNull().default(0),
    maxRetries: integer('max_retries').notNull().default(5),
    nextRetryAt: timestamp('next_retry_at', { withTimezone: true, mode: 'date' }),

    // Error tracking
    errorMessage: text('error_message'),
    errorStack: text('error_stack'),

    // ERP reference (populated on completion via agent callback)
    erpReference: varchar('erp_reference', { length: 100 }),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'date' }),
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(), // Default to NOW(), updated by service
  },
  table => [
    // Composite index for vendor + status queries (admin dashboard)
    index('sync_jobs_vendor_status_idx').on(table.vendorId, table.status),

    // Index for status-based queries (pending job polling)
    index('sync_jobs_status_idx').on(table.status),

    // Index for retry scheduling (BullMQ processor)
    index('sync_jobs_next_retry_idx').on(table.nextRetryAt),

    // Index for expiry cleanup (SyncCleanupService)
    index('sync_jobs_expires_idx').on(table.expiresAt),

    // Index for order lookups
    index('sync_jobs_postgres_order_id_idx').on(table.postgresOrderId),
  ],
);

// Relations defined in sync-relations.ts to avoid circular dependencies

// ============================================
// Type Exports
// ============================================
export type SyncJob = typeof syncJobs.$inferSelect;
export type NewSyncJob = typeof syncJobs.$inferInsert;
