import { HttpStatus } from '@nestjs/common';
import { BaseException } from './base.exception';

/**
 * Database exception for database/ORM errors
 *
 * Use cases:
 * - PostgreSQL errors (unique constraint, foreign key, etc.)
 * - Drizzle ORM errors
 * - Database connection issues
 * - Query failures
 * - Document conflicts
 *
 * @example
 * throw new DatabaseException(
 *   'UNIQUE_VIOLATION',
 *   'User with this email already exists',
 *   { constraint: 'users_email_unique', detail: '...' }
 * );
 */
export class DatabaseException extends BaseException {
  constructor(
    code: string,
    message: string,
    details?: Record<string, unknown>,
    statusCode: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
  ) {
    super(code, message, statusCode, details);
    Object.setPrototypeOf(this, DatabaseException.prototype);
  }
}
