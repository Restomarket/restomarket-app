import { type users } from '../database/schema/index.js';

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

// Connection type
export type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from '../database/schema/index.js';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
export type DatabaseConnection = PostgresJsDatabase<typeof schema>;
