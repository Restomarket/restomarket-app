import { HttpStatus } from '@nestjs/common';
import { BaseException } from './base.exception';

/**
 * Validation exception for request validation errors
 *
 * Use cases:
 * - DTO validation failures
 * - Input validation errors
 * - Type validation errors
 * - Format validation errors
 *
 * @example
 * throw new ValidationException(
 *   'INVALID_INPUT',
 *   'Age must be positive',
 *   { field: 'age', value: -5 }
 * );
 */
export class ValidationException extends BaseException {
  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(code, message, HttpStatus.BAD_REQUEST, details);
    Object.setPrototypeOf(this, ValidationException.prototype);
  }
}
