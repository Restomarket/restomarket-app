import { type authUsers } from '../database/schema/index.js';

export type User = typeof authUsers.$inferSelect;
export type NewUser = typeof authUsers.$inferInsert;

// Connection type
export type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from '../database/schema/index.js';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
export type DatabaseConnection = PostgresJsDatabase<typeof schema>;
