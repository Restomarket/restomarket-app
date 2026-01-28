import { HttpStatus } from '@nestjs/common';
import { BaseException } from './base.exception';

/**
 * NotFoundException for resource not found scenarios
 *
 * Use cases:
 * - Entity not found by ID
 * - Resource does not exist
 * - Soft-deleted resources (treated as not found)
 *
 * Returns HTTP 404 Not Found
 *
 * @example
 * throw new NotFoundException(
 *   'USER_NOT_FOUND',
 *   'User with ID xyz not found',
 *   { userId: 'xyz' }
 * );
 */
export class NotFoundException extends BaseException {
  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(code, message, HttpStatus.NOT_FOUND, details);
    Object.setPrototypeOf(this, NotFoundException.prototype);
  }
}
