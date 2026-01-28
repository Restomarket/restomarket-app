import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PinoLogger } from 'nestjs-pino';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: PinoLogger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request & { correlationId?: string }>();
    const response = context.switchToHttp().getResponse<Response>();
    const method = request.method;
    const url = request.url;
    const body = request.body as unknown;
    const correlationId = request.correlationId;
    const startTime = Date.now();

    this.logger.debug({
      message: 'Incoming request',
      method,
      url,
      correlationId,
      body: this.sanitizeBody(body),
    });

    return next.handle().pipe(
      tap({
        next: (_data: unknown): void => {
          const duration = Date.now() - startTime;
          this.logger.info({
            message: 'Request completed',
            method,
            url,
            statusCode: response.statusCode,
            duration: `${duration}ms`,
            correlationId,
          });
        },
        error: (error: Error): void => {
          const duration = Date.now() - startTime;
          this.logger.error({
            message: 'Request failed',
            method,
            url,
            error: error.message,
            duration: `${duration}ms`,
            correlationId,
          });
        },
      }),
    );
  }

  private sanitizeBody(body: unknown): Record<string, unknown> {
    if (!body || typeof body !== 'object') {
      return {};
    }

    const sanitized = { ...(body as Record<string, unknown>) };
    const sensitiveFields = ['password', 'token', 'secret', 'apiKey'];

    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '***REDACTED***';
      }
    }

    return sanitized;
  }
}
