import { type authUsers } from '../database/schema/index.js';

// User types
export type User = typeof authUsers.$inferSelect;
export type NewUser = typeof authUsers.$inferInsert;

// Re-export sync types from schema (to avoid duplication)
export type {
  SyncJob,
  NewSyncJob,
  Agent,
  NewAgent,
  ErpCodeMapping,
  NewErpCodeMapping,
  DeadLetterQueueEntry,
  NewDeadLetterQueueEntry,
  ReconciliationEvent,
  NewReconciliationEvent,
} from '../database/schema/index.js';

// Connection type
export type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from '../database/schema/index.js';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
export type DatabaseConnection = PostgresJsDatabase<typeof schema>;
