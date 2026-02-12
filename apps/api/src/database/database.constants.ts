/**
 * Database injection tokens - extracted to avoid circular dependency
 * between database.module and adapters (adapters need the token, module imports adapters).
 */
export const DATABASE_CONNECTION = 'DATABASE_CONNECTION';
export const POSTGRES_CLIENT = 'POSTGRES_CLIENT';
