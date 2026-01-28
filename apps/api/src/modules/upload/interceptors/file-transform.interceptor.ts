import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { FileUploadResponseDto, MultipleFileUploadResponseDto } from '../dto';

/**
 * Interceptor to transform file upload responses
 * Converts raw Multer file objects to standardized DTOs
 */
@Injectable()
export class FileTransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((data: unknown) => {
        // If the response already has a specific structure, return it as-is
        if (data && typeof data === 'object' && !('buffer' in data)) {
          return data;
        }

        const request = context.switchToHttp().getRequest<
          Request & {
            file?: Express.Multer.File;
            files?: Express.Multer.File[] | Record<string, Express.Multer.File[]>;
          }
        >();
        const file = request.file;
        const files = request.files;

        // Single file upload
        if (file) {
          return new FileUploadResponseDto(file);
        }

        // Multiple files upload
        if (files && Array.isArray(files)) {
          return new MultipleFileUploadResponseDto(files);
        }

        // Multiple files with field names
        if (files && typeof files === 'object') {
          const allFiles: Express.Multer.File[] = [];
          Object.values(files).forEach(fileArray => {
            if (Array.isArray(fileArray)) {
              allFiles.push(...fileArray);
            }
          });

          if (allFiles.length > 0) {
            return new MultipleFileUploadResponseDto(allFiles);
          }
        }

        return data;
      }),
    );
  }
}
