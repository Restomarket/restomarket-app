import { HttpStatus } from '@nestjs/common';
import { BaseException } from './base.exception';

/**
 * Timeout exception for operation timeouts
 *
 * Use cases:
 * - External API call timeouts
 * - Long-running operation timeouts
 * - Circuit breaker triggers
 * - Database query timeouts
 *
 * @example
 * throw new TimeoutException(
 *   'REQUEST_TIMEOUT',
 *   'External API took too long',
 *   { service: 'payment-api', timeout: 5000 }
 * );
 */
export class TimeoutException extends BaseException {
  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(code, message, HttpStatus.REQUEST_TIMEOUT, details);
    Object.setPrototypeOf(this, TimeoutException.prototype);
  }
}
