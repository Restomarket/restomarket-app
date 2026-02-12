import { relations } from 'drizzle-orm';
import { syncJobs } from './sync-jobs.schema.js';
import { deadLetterQueue } from './dead-letter-queue.schema.js';
import { agentRegistry } from './agent-registry.schema.js';
import { erpCodeMappings } from './erp-code-mappings.schema.js';
import { reconciliationEvents } from './reconciliation-events.schema.js';

/**
 * Sync Schema Relations
 *
 * Defines Drizzle ORM relations between sync tables.
 * Separated from schema files to avoid circular dependencies.
 *
 * Note: Relations to `orders` table are commented out because the orders table
 * does not exist yet. Uncomment when orders module is implemented.
 */

// Sync Jobs Relations
export const syncJobsRelations = relations(syncJobs, ({ many }) => ({
  // Relation to orders table (uncomment when orders table exists)
  // order: one(orders, {
  //   fields: [syncJobs.postgresOrderId],
  //   references: [orders.id],
  // }),

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

// ERP Code Mappings Relations (no relations currently)
export const erpCodeMappingsRelations = relations(erpCodeMappings, () => ({}));

// Reconciliation Events Relations (no relations currently)
export const reconciliationEventsRelations = relations(reconciliationEvents, () => ({}));
