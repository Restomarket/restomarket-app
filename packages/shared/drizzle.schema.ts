/**
 * Schema file for drizzle-kit
 * Re-exports all schemas without .js extensions for compatibility with drizzle-kit
 *
 * Note: users table has been merged into authUsers in auth.schema
 */
export * from './src/database/schema/base.schema';
export * from './src/database/schema/auth.schema';
export * from './src/database/schema/organization.schema';
