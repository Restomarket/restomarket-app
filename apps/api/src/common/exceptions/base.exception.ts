import { HttpException, type HttpStatus } from '@nestjs/common';

/**
 * Abstract base exception class
 * All custom exceptions should extend this class
 */
export abstract class BaseException extends HttpException {
  public readonly code: string;
  public readonly details?: Record<string, unknown>;
  public readonly timestamp: string;

  constructor(
    code: string,
    message: string,
    statusCode: HttpStatus,
    details?: Record<string, unknown>,
  ) {
    super(message, statusCode);
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();

    // Maintain proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);
    Object.setPrototypeOf(this, BaseException.prototype);
  }

  /**
   * Get a JSON representation of the exception
   */
  toJSON(): Record<string, unknown> {
    return {
      code: this.code,
      message: this.message,
      statusCode: this.getStatus(),
      details: this.details,
      timestamp: this.timestamp,
    };
  }
}
