import type { PostgresError } from 'postgres';
import { DatabaseException } from '@common/exceptions';

/**
 * PostgreSQL error codes
 */
export const PG_ERROR_CODES = {
  UNIQUE_VIOLATION: '23505',
  FOREIGN_KEY_VIOLATION: '23503',
  NOT_NULL_VIOLATION: '23502',
  CHECK_VIOLATION: '23514',
  INVALID_TEXT_REPRESENTATION: '22P02',
  DEADLOCK_DETECTED: '40P01',
} as const;

/**
 * Type guard to check if error is a PostgreSQL error
 */
export function isPostgresError(err: unknown): err is PostgresError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    typeof (err as Record<string, unknown>).code === 'string'
  );
}

/**
 * Map PostgreSQL error to DatabaseException with proper context
 *
 * @param operation - The operation being performed (e.g., 'FIND_BY_ID', 'CREATE')
 * @param error - The error that occurred
 * @param tableName - The table name where the error occurred
 * @param context - Additional context for debugging
 * @returns DatabaseException with appropriate error code and message
 *
 * @example
 * ```typescript
 * try {
 *   await this.db.insert(users).values(data);
 * } catch (error) {
 *   throw mapDatabaseError('CREATE', error, 'users', { email: data.email });
 * }
 * ```
 */
export function mapDatabaseError(
  operation: string,
  error: unknown,
  tableName: string,
  context?: Record<string, unknown>,
): DatabaseException {
  // Preserve original error in cause chain for debugging
  const baseContext = {
    table: tableName,
    ...context,
  };

  if (isPostgresError(error)) {
    const pgError = error;

    // Unique constraint violation (23505)
    if (pgError.code === PG_ERROR_CODES.UNIQUE_VIOLATION) {
      return new DatabaseException(
        'UNIQUE_CONSTRAINT_VIOLATION',
        'A record with this value already exists',
        {
          ...baseContext,
          constraint: pgError.constraint_name,
          detail: pgError.detail,
          column: pgError.column_name,
        },
      );
    }

    // Foreign key violation (23503)
    if (pgError.code === PG_ERROR_CODES.FOREIGN_KEY_VIOLATION) {
      return new DatabaseException('FOREIGN_KEY_VIOLATION', 'Referenced record does not exist', {
        ...baseContext,
        constraint: pgError.constraint_name,
        detail: pgError.detail,
      });
    }

    // Not null violation (23502)
    if (pgError.code === PG_ERROR_CODES.NOT_NULL_VIOLATION) {
      return new DatabaseException('NOT_NULL_VIOLATION', 'Required field is missing', {
        ...baseContext,
        column: pgError.column_name,
      });
    }

    // Check constraint violation (23514)
    if (pgError.code === PG_ERROR_CODES.CHECK_VIOLATION) {
      return new DatabaseException('CHECK_CONSTRAINT_VIOLATION', 'Data validation failed', {
        ...baseContext,
        constraint: pgError.constraint_name,
        detail: pgError.detail,
      });
    }

    // Invalid text representation (22P02) - e.g., invalid UUID format
    if (pgError.code === PG_ERROR_CODES.INVALID_TEXT_REPRESENTATION) {
      return new DatabaseException('INVALID_TEXT_REPRESENTATION', 'Invalid data format', {
        ...baseContext,
        detail: pgError.detail,
      });
    }

    // Deadlock detected (40P01)
    if (pgError.code === PG_ERROR_CODES.DEADLOCK_DETECTED) {
      return new DatabaseException(
        'DEADLOCK_DETECTED',
        'Database deadlock detected. Please retry.',
        {
          ...baseContext,
          detail: pgError.detail,
        },
      );
    }

    // Generic PostgreSQL error with full context
    return new DatabaseException(
      `${operation}_FAILED`,
      pgError.message ?? `Failed to execute ${operation.toLowerCase().replace(/_/g, ' ')}`,
      {
        ...baseContext,
        code: pgError.code,
        severity: pgError.severity,
        detail: pgError.detail,
        hint: pgError.hint,
        position: pgError.position,
        constraint: pgError.constraint_name,
        column: pgError.column_name,
      },
    );
  }

  // Handle generic errors (non-PostgreSQL)
  return new DatabaseException(
    `${operation}_FAILED`,
    `Failed to execute ${operation.toLowerCase().replace(/_/g, ' ')}`,
    {
      ...baseContext,
      error: error instanceof Error ? error.message : String(error),
      cause: error instanceof Error ? error : undefined,
    },
  );
}
