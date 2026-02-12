import { pgTable, uuid, varchar, boolean, timestamp, index } from 'drizzle-orm/pg-core';

/**
 * Agent Registry Schema
 *
 * Tracks ERP agent registrations, health status, and authentication.
 * Agents self-register and send periodic heartbeats for health monitoring.
 *
 * Status transitions:
 * - online: heartbeat received within 60s
 * - degraded: heartbeat stale > 60s but < 300s
 * - offline: heartbeat stale > 300s or no heartbeat
 *
 * Security: authTokenHash stores bcrypt hash of agent token (10 rounds)
 */

export const agentRegistry = pgTable(
  'agent_registry',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    // Unique vendor identifier (business key)
    vendorId: varchar('vendor_id', { length: 100 }).notNull().unique(),

    // Agent endpoint URL
    agentUrl: varchar('agent_url', { length: 500 }).notNull(),

    // ERP system type: 'ebp', 'sage', 'odoo', 'custom'
    erpType: varchar('erp_type', { length: 20 }).notNull(),

    // Agent status: 'online', 'offline', 'degraded'
    status: varchar('status', { length: 20 }).notNull().default('offline'),

    // Last heartbeat timestamp (used for staleness detection)
    lastHeartbeat: timestamp('last_heartbeat', { withTimezone: true, mode: 'date' }),

    // Agent version (for compatibility tracking)
    version: varchar('version', { length: 50 }),

    // Bcrypt hash of agent authentication token
    authTokenHash: varchar('auth_token_hash', { length: 256 }).notNull(),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  table => [
    // Index for status-based queries (health dashboard)
    index('agent_registry_status_idx').on(table.status),

    // Index for heartbeat staleness detection (health check scheduler)
    index('agent_registry_heartbeat_idx').on(table.lastHeartbeat),

    // Index for vendor lookups (auth guard)
    index('agent_registry_vendor_id_idx').on(table.vendorId),
  ],
);

// ============================================
// Type Exports
// ============================================
export type Agent = typeof agentRegistry.$inferSelect;
export type NewAgent = typeof agentRegistry.$inferInsert;
