import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import * as schema from '@repo/shared';

/**
 * Database Cleaner - Handles cleanup of test database tables
 *
 * Features:
 * - Cleans all tables in the correct order (respecting foreign keys)
 * - Option to truncate (fast) or delete (slower but safer)
 * - Resets sequences to ensure predictable IDs in tests
 * - Can exclude specific tables from cleanup
 */
export class DatabaseCleaner {
  constructor(private readonly db: PostgresJsDatabase<typeof schema>) {}

  /**
   * Clean all tables in the database
   * Uses TRUNCATE for better performance (faster than DELETE)
   *
   * @param options.exclude - Table names to exclude from cleanup
   * @param options.cascade - Whether to cascade truncate to dependent tables
   * @param options.restartIdentity - Whether to reset auto-increment sequences
   */
  async cleanAll(
    options: {
      exclude?: string[];
      cascade?: boolean;
      restartIdentity?: boolean;
    } = {},
  ): Promise<void> {
    const { exclude = [], cascade = true, restartIdentity = true } = options;

    // Get all table names from the database (not from schema)
    const existingTables = await this.getExistingTableNames();
    const tableNames = existingTables.filter(name => !exclude.includes(name));

    if (tableNames.length === 0) {
      return;
    }

    // Build TRUNCATE statement - order matters: CASCADE must come last
    const restartClause = restartIdentity ? 'RESTART IDENTITY' : '';
    const cascadeClause = cascade ? 'CASCADE' : '';

    const sqlCommand =
      `TRUNCATE TABLE ${tableNames.map(t => `"${t}"`).join(', ')} ${restartClause} ${cascadeClause}`.trim();

    const truncateStatement = sql.raw(sqlCommand);

    try {
      await this.db.execute(truncateStatement);
    } catch (error) {
      console.error('Failed to truncate tables:', sqlCommand, error);
      throw error;
    }
  }

  /**
   * Clean specific tables only
   * Useful when you only need to clean certain tables between tests
   *
   * @param tableNames - Array of table names to clean
   * @param restartIdentity - Whether to reset auto-increment sequences
   */
  async cleanTables(tableNames: string[], restartIdentity = true): Promise<void> {
    if (tableNames.length === 0) {
      return;
    }

    const restartClause = restartIdentity ? 'RESTART IDENTITY' : '';

    const truncateStatement = sql.raw(
      `TRUNCATE TABLE ${tableNames.map(t => `"${t}"`).join(', ')} ${restartClause} CASCADE`.trim(),
    );

    await this.db.execute(truncateStatement);
  }

  /**
   * Delete all records from specific tables (slower but safer than truncate)
   * Use this when you need to preserve table structure and constraints
   *
   * @param tableNames - Array of table names to delete from
   */
  async deleteFromTables(tableNames: string[]): Promise<void> {
    for (const tableName of tableNames) {
      const table = this.getTableByName(tableName);
      if (table) {
        await this.db.delete(table);
      }
    }
  }

  /**
   * Get all table names from the database
   */
  private async getExistingTableNames(): Promise<string[]> {
    const result: any = await this.db.execute(sql`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);

    // drizzle returns an array directly
    return Array.isArray(result) ? result.map((row: any) => row.tablename) : [];
  }

  /**
   * Get all table names from the schema
   */
  private getTableNames(): string[] {
    const tables: string[] = [];

    for (const [key, value] of Object.entries(schema)) {
      // Check if it's a Drizzle table
      if (value && typeof value === 'object') {
        // Try multiple ways to get the table name
        const tableName =
          (value as any)[Symbol.for('drizzle:Name')] ??
          (value as any)._?.name ??
          (value as any)[Symbol.for('drizzle:PgInlineForeignKeys')] ??
          key;

        // Drizzle tables have specific properties
        if (
          tableName &&
          typeof tableName === 'string' &&
          ((value as any)[Symbol.for('drizzle:Columns')] ||
            (value as any)[Symbol.for('drizzle:Table')])
        ) {
          tables.push(tableName);
        }
      }
    }

    // Fallback to hardcoded table names if auto-detection fails
    if (tables.length === 0) {
      tables.push('users');
    }

    return tables;
  }

  /**
   * Get a table object by its name
   */
  private getTableByName(tableName: string): any {
    for (const [, value] of Object.entries(schema)) {
      if (value && typeof value === 'object') {
        const name = (value as any)[Symbol.for('drizzle:Name')] ?? (value as any)._.name;
        if (name === tableName) {
          return value;
        }
      }
    }
    return null;
  }

  /**
   * Reset all sequences to 1
   * Useful for ensuring predictable IDs in tests
   */
  async resetSequences(): Promise<void> {
    await this.db.execute(sql`
      DO $$
      DECLARE
        seq_record RECORD;
      BEGIN
        FOR seq_record IN
          SELECT sequence_name
          FROM information_schema.sequences
          WHERE sequence_schema = 'public'
        LOOP
          EXECUTE 'ALTER SEQUENCE ' || seq_record.sequence_name || ' RESTART WITH 1';
        END LOOP;
      END $$;
    `);
  }
}
