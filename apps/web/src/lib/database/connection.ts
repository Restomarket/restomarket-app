import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@repo/shared';
import type { DatabaseConnection } from '@repo/shared';

declare global {
  var __db: DatabaseConnection | undefined;
  var __dbClient: ReturnType<typeof postgres> | undefined;
}

/**
 * Get database connection for Next.js Server Components and Server Actions
 *
 * Best Practices:
 * - Singleton pattern prevents connection exhaustion in development
 * - Connection pooling configured for serverless/edge environments
 * - Proper cleanup with global client reference
 * - Schema properly typed for Drizzle relational queries
 *
 * @throws Error if called on client side or DATABASE_URL is not defined
 */
export function getDatabase(): DatabaseConnection {
  // Ensure server-side only
  if (typeof window !== 'undefined') {
    throw new Error('Database can only be accessed on the server side');
  }

  // Return cached connection if available
  if (global.__db) {
    return global.__db;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not defined');
  }

  // Create postgres client with serverless-optimized settings
  const client = postgres(connectionString, {
    // Connection pool configuration
    max: process.env.DATABASE_POOL_MAX ? parseInt(process.env.DATABASE_POOL_MAX) : 1, // Conservative for serverless
    idle_timeout: 20, // Close idle connections after 20s
    connect_timeout: 10, // Timeout connection attempts after 10s
    max_lifetime: 60 * 30, // Recycle connections every 30 minutes

    // Performance optimizations
    prepare: false, // Required for Supabase/Neon pooler in transaction mode
    transform: {
      undefined: null, // Convert undefined to null for PostgreSQL
    },

    // Error handling
    onnotice: process.env.NODE_ENV === 'development' ? console.log : undefined,
  });

  // Create Drizzle instance with full schema
  const db = drizzle(client, {
    schema,
    logger: process.env.NODE_ENV === 'development',
  });

  // Cache connection globally (works in both dev and production)
  // Next.js handles module caching properly in production builds
  global.__db = db;
  global.__dbClient = client;

  // Cleanup on process exit (important for graceful shutdown)
  if (process.env.NODE_ENV !== 'test') {
    process.on('beforeExit', async () => {
      await global.__dbClient?.end({ timeout: 5 });
    });
  }

  return db;
}

/**
 * Close database connection
 * Use for manual cleanup (e.g., in tests or edge functions)
 */
export async function closeDatabase(): Promise<void> {
  if (global.__dbClient) {
    await global.__dbClient.end({ timeout: 5 });
    global.__db = undefined;
    global.__dbClient = undefined;
  }
}
