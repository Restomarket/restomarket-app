import type { Config } from 'drizzle-kit';

export default {
  schema: './drizzle.schema.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    // Use direct connection for migrations (bypasses pooler)
    // Pooler in transaction mode can cause issues with DDL statements
    url: process.env.DATABASE_DIRECT_URL || process.env.DATABASE_URL || '',
  },
  verbose: true,
  strict: true,
  migrations: {
    table: '__drizzle_migrations__',
    schema: 'public',
  },
} satisfies Config;
