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
 * Reconciliation Events Schema
 *
 * Audit log for ERP↔PostgreSQL reconciliation operations.
 * Tracks drift detection, binary search resolution, and sync summaries.
 *
 * Event types:
 * - incremental_sync: Agent pushed incremental changes
 * - full_checksum: Full catalog checksum comparison
 * - drift_detected: Hash mismatch between ERP and PostgreSQL
 * - drift_resolved: Conflicts resolved (ERP wins)
 *
 * Retention: 30 days (via SyncCleanupService)
 */

export const reconciliationEvents = pgTable(
  'reconciliation_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    // Vendor identification
    vendorId: varchar('vendor_id', { length: 100 }).notNull(),

    // Event type: 'incremental_sync', 'full_checksum', 'drift_detected', 'drift_resolved'
    eventType: varchar('event_type', { length: 30 }).notNull(),

    // Structured summary (e.g., { itemsCompared: 1234, driftsFound: 5, itemsResolved: 5 })
    summary: jsonb('summary').notNull(),

    // Optional detailed description (human-readable)
    details: text('details'),

    // Event timestamp (when reconciliation occurred)
    timestamp: timestamp('timestamp', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),

    // Operation duration (milliseconds)
    durationMs: integer('duration_ms').notNull().default(0),
  },
  table => [
    // Composite index for vendor + timestamp queries (reconciliation history)
    index('reconciliation_events_vendor_timestamp_idx').on(table.vendorId, table.timestamp),

    // Index for event type filtering (drift analytics)
    index('reconciliation_events_type_idx').on(table.eventType),

    // Index for cleanup queries (age-based deletion)
    index('reconciliation_events_timestamp_idx').on(table.timestamp),
  ],
);

// ============================================
// Type Exports
// ============================================
export type ReconciliationEvent = typeof reconciliationEvents.$inferSelect;
export type NewReconciliationEvent = typeof reconciliationEvents.$inferInsert;
