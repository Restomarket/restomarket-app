import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { TimeoutException } from '@common/exceptions';

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  constructor(private readonly timeoutMs = 30000) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{ url?: string; method?: string }>();
    const path = request?.url ?? 'unknown';
    const method = request?.method ?? 'unknown';

    return next.handle().pipe(
      timeout(this.timeoutMs),
      catchError((err: unknown) => {
        if (err instanceof TimeoutError) {
          return throwError(
            () =>
              new TimeoutException('REQUEST_TIMEOUT', 'Request timeout exceeded', {
                timeoutMs: this.timeoutMs,
                path,
                method,
              }),
          );
        }
        return throwError(() => err);
      }),
    );
  }
}
