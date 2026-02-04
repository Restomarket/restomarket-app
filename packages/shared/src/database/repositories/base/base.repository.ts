import { type PgTableWithColumns } from 'drizzle-orm/pg-core';
import { type SQL, sql } from 'drizzle-orm';
import { type DatabaseConnection } from '../../../types/database.types.js';
import { mapDatabaseError, type DatabaseError } from '../../../utils/error-handler.js';
import { type IRepository, type ILogger, ConsoleLogger } from './repository.interface.js';

export abstract class BaseRepository<
  TTable extends PgTableWithColumns<any>,
> implements IRepository {
  protected readonly tableName: string;
  protected readonly logger: ILogger;

  constructor(
    protected readonly db: DatabaseConnection,
    protected readonly table: TTable,
    logger?: ILogger,
  ) {
    this.tableName =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (table as any)[Symbol.for('drizzle:Name')] ?? (table as any)._?.name ?? 'unknown';
    this.logger = logger ?? new ConsoleLogger(this.tableName);
  }

  async transaction<T>(callback: (tx: DatabaseConnection) => Promise<T>): Promise<T> {
    try {
      return await this.db.transaction(callback);
    } catch (error) {
      this.logger.error('Transaction failed', { error, table: this.tableName });
      throw error;
    }
  }

  protected handleError(
    operation: string,
    error: unknown,
    context?: Record<string, unknown>,
  ): DatabaseError {
    const dbError = mapDatabaseError(operation, error, this.tableName, context);
    this.logger.error(`Database operation failed: ${operation}`, {
      code: dbError.code,
      message: dbError.message,
      table: dbError.table,
      context: dbError.context,
    });
    return dbError;
  }

  protected getUpdatedTimestamp(): SQL<Date> {
    return sql`now()`;
  }
}
