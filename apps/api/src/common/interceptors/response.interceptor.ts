import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request, Response } from 'express';

export interface ApiResponse<T> {
  success: boolean;
  statusCode: number;
  data: T;
  timestamp: string;
  path: string;
  correlationId?: string;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T> | T> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T> | T> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((data: T): ApiResponse<T> | T => {
        const statusCode = response.statusCode;

        // Don't wrap 204 No Content responses
        if (statusCode === 204 || data === undefined || data === null) {
          return data;
        }

        // Return standardized response
        return {
          success: true,
          statusCode,
          data,
          timestamp: new Date().toISOString(),
          path: request.url,
          correlationId: request.correlationId,
        };
      }),
    );
  }
}
