import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { PinoLogger } from 'nestjs-pino';
import { BaseException } from '@common/exceptions';

interface ValidationError {
  field: string;
  message: string;
}

interface ErrorResponse {
  success: false;
  statusCode: number;
  timestamp: string;
  path: string;
  method: string;
  message: string;
  code?: string;
  error?: string;
  correlationId?: string;
  details?: Record<string, unknown>;
  validationErrors?: ValidationError[];
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const correlationId = request.correlationId;

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const errorResponse: ErrorResponse = {
      success: false,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message: this.getErrorMessage(exception),
      correlationId,
    };

    // Handle custom exceptions (BaseException)
    if (exception instanceof BaseException) {
      errorResponse.code = exception.code;
      errorResponse.details = exception.details;
      errorResponse.timestamp = exception.timestamp; // Use exception's timestamp
    }

    // Add error name for non-HttpExceptions
    if (!(exception instanceof HttpException) && exception instanceof Error) {
      errorResponse.error = exception.name;
    }

    // Handle validation errors
    if (exception instanceof BadRequestException) {
      const validationErrors = this.extractValidationErrors(exception);
      if (validationErrors.length > 0) {
        errorResponse.validationErrors = validationErrors;
      }
    }

    // Log the error
    this.logError(exception, request, status, correlationId);

    response.status(status).json(errorResponse);
  }

  private getErrorMessage(exception: unknown): string {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'string') {
        return response;
      }
      if (typeof response === 'object' && response !== null) {
        return ((response as Record<string, unknown>).message as string) || exception.message;
      }
    }

    if (exception instanceof Error) {
      return exception.message;
    }

    return 'Internal server error';
  }

  private extractValidationErrors(exception: BadRequestException): ValidationError[] {
    const response = exception.getResponse() as Record<string, unknown>;
    const message = response.message;

    if (Array.isArray(message)) {
      return message.map(msg => {
        if (typeof msg === 'string') {
          return { field: 'unknown', message: msg };
        }
        return msg as ValidationError;
      });
    }

    return [];
  }

  private logError(
    exception: unknown,
    request: Request,
    status: number,
    correlationId?: string,
  ): void {
    const errorDetails = {
      correlationId,
      method: request.method,
      url: request.url,
      statusCode: status,
      message: this.getErrorMessage(exception),
    };

    if (status >= 500) {
      this.logger.error({
        ...errorDetails,
        stack: exception instanceof Error ? exception.stack : undefined,
      });
    } else if (status >= 400) {
      this.logger.warn(errorDetails);
    }
  }
}
