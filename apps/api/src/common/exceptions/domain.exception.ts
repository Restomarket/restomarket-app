import { HttpStatus } from '@nestjs/common';
import { BaseException } from './base.exception';

/**
 * Domain exception for domain/entity rule violations
 *
 * Use cases:
 * - Invalid email format
 * - Entity state rules
 * - Aggregate consistency
 * - Business invariants
 * - Domain validation failures
 *
 * @example
 * throw new DomainException(
 *   'INVALID_EMAIL',
 *   'Email format is invalid',
 *   { email: 'bad@email' }
 * );
 */
export class DomainException extends BaseException {
  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(code, message, HttpStatus.UNPROCESSABLE_ENTITY, details);
    Object.setPrototypeOf(this, DomainException.prototype);
  }
}
