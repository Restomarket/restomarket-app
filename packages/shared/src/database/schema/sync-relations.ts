import { relations } from 'drizzle-orm';
import { syncJobs } from './sync-jobs.schema.js';
import { deadLetterQueue } from './dead-letter-queue.schema.js';
import { agentRegistry } from './agent-registry.schema.js';
import { reconciliationEvents } from './reconciliation-events.schema.js';
import { orders } from './orders.schema.js';

/**
 * Sync Schema Relations
 *
 * Defines Drizzle ORM relations between sync tables.
 * Separated from schema files to avoid circular dependencies.
 */

// Sync Jobs Relations
export const syncJobsRelations = relations(syncJobs, ({ one, many }) => ({
  // Relation to orders table
  order: one(orders, {
    fields: [syncJobs.postgresOrderId],
    references: [orders.id],
  }),

  // One sync job can have one DLQ entry if it fails permanently
  deadLetterQueueEntries: many(deadLetterQueue),
}));

// Dead Letter Queue Relations
export const deadLetterQueueRelations = relations(deadLetterQueue, ({ one }) => ({
  // Reference back to original sync job
  originalJob: one(syncJobs, {
    fields: [deadLetterQueue.originalJobId],
    references: [syncJobs.id],
  }),
}));

// Agent Registry Relations (no relations currently)
export const agentRegistryRelations = relations(agentRegistry, () => ({}));

// ERP Code Mappings Relations → moved to reference-relations.ts

// Reconciliation Events Relations (no relations currently)
export const reconciliationEventsRelations = relations(reconciliationEvents, () => ({}));
