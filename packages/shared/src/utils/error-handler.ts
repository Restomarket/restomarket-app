import type { PostgresError } from 'postgres';

export const PG_ERROR_CODES = {
  UNIQUE_VIOLATION: '23505',
  FOREIGN_KEY_VIOLATION: '23503',
  NOT_NULL_VIOLATION: '23502',
  CHECK_VIOLATION: '23514',
  INVALID_TEXT_REPRESENTATION: '22P02',
  DEADLOCK_DETECTED: '40P01',
} as const;

export interface DatabaseError {
  code: string;
  message: string;
  operation: string;
  table?: string;
  constraint?: string;
  column?: string;
  detail?: string;
  hint?: string;
  context?: Record<string, unknown>;
}

export function isPostgresError(err: unknown): err is PostgresError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    typeof (err as Record<string, unknown>).code === 'string'
  );
}

export function mapDatabaseError(
  operation: string,
  error: unknown,
  tableName?: string,
  context?: Record<string, unknown>,
): DatabaseError {
  if (isPostgresError(error)) {
    return {
      code: error.code,
      message: error.message ?? `Failed to ${operation.toLowerCase()}`,
      operation,
      table: tableName,
      constraint: error.constraint_name,
      column: error.column_name,
      detail: error.detail,
      hint: error.hint,
      context: { table: tableName, ...context },
    };
  }

  return {
    code: `${operation}_FAILED`,
    message: error instanceof Error ? error.message : String(error),
    operation,
    table: tableName,
    context: { table: tableName, ...context },
  };
}
