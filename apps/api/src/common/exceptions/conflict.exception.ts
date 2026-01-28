import { HttpStatus } from '@nestjs/common';
import { BaseException } from './base.exception';

/**
 * ConflictException for resource conflict scenarios
 *
 * Use cases:
 * - Duplicate unique field (email, username, etc.)
 * - Resource already exists
 * - Constraint violations
 * - Concurrent modification conflicts
 *
 * Returns HTTP 409 Conflict
 *
 * @example
 * throw new ConflictException(
 *   'EMAIL_ALREADY_EXISTS',
 *   'User with this email already exists',
 *   { email: 'user@example.com' }
 * );
 */
export class ConflictException extends BaseException {
  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(code, message, HttpStatus.CONFLICT, details);
    Object.setPrototypeOf(this, ConflictException.prototype);
  }
}
