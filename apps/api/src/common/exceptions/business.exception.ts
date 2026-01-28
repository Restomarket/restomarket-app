import { HttpStatus } from '@nestjs/common';
import { BaseException } from './base.exception';

/**
 * Business exception for business logic violations
 *
 * Use cases:
 * - Payment failures (insufficient funds)
 * - Insufficient permissions
 * - Workflow violations
 * - Business rule violations
 *
 * @example
 * throw new BusinessException(
 *   'INSUFFICIENT_FUNDS',
 *   'Account balance too low',
 *   { balance: 50, required: 100 }
 * );
 */
export class BusinessException extends BaseException {
  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(code, message, HttpStatus.BAD_REQUEST, details);
    Object.setPrototypeOf(this, BusinessException.prototype);
  }
}
