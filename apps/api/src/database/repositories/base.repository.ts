import { type PgTableWithColumns } from 'drizzle-orm/pg-core';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { type PinoLogger } from 'nestjs-pino';
import { type SQL, sql } from 'drizzle-orm';
import { DatabaseException } from '@common/exceptions';
import { mapDatabaseError } from '../helpers/error-handler.helper';
import type * as schema from '../schema';

/**
 * Base repository providing core database operations
 *
 * Philosophy: Keep it minimal and focused
 * - Only truly shared functionality
 * - No over-abstraction
 * - Child repositories implement their own query logic
 */
export abstract class BaseRepository<TTable extends PgTableWithColumns<unknown>> {
  protected readonly tableName: string;

  constructor(
    protected readonly db: PostgresJsDatabase<typeof schema>,
    protected readonly table: TTable,
    protected readonly logger: PinoLogger,
  ) {
    this.tableName =
      (table as unknown)[Symbol.for('drizzle:Name')] ?? (table as unknown)._?.name ?? 'unknown';
  }

  /**
   * Execute a database transaction
   * Provides automatic error handling and logging
   */
  async transaction<T>(
    callback: (tx: PostgresJsDatabase<typeof schema>) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.db.transaction(callback);
    } catch (error) {
      this.logger.error({ error, table: this.tableName }, 'Transaction failed');
      throw new DatabaseException('TRANSACTION_FAILED', 'Transaction failed', {
        table: this.tableName,
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  /**
   * Handle database errors with proper logging and exception mapping
   * Should be called in catch blocks to standardize error handling
   */
  protected handleError(
    operation: string,
    error: unknown,
    context?: Record<string, unknown>,
  ): never {
    this.logger.error(
      { error, operation, table: this.tableName, ...context },
      `Database operation failed: ${operation}`,
    );

    throw mapDatabaseError(operation, error, this.tableName, context);
  }

  /**
   * Get current timestamp for updates
   * Ensures consistent timestamp handling across operations
   */
  protected getUpdatedTimestamp(): SQL<Date> {
    return sql`now()`;
  }
}
