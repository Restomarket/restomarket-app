import { ParseFilePipe, MaxFileSizeValidator, FileTypeValidator, HttpStatus } from '@nestjs/common';
import { FileType, FileTypeCategories } from '../enums';

/**
 * Configuration options for file upload validation
 */
export interface FileValidationOptions {
  /**
   * Maximum file size in bytes
   * Default: 5MB
   */
  maxSize?: number;

  /**
   * Array of allowed MIME types
   */
  fileTypes?: string[];

  /**
   * File is required by default. Set to false to make it optional
   */
  fileIsRequired?: boolean;

  /**
   * HTTP status code to return on validation error
   * Default: 422 (UNPROCESSABLE_ENTITY)
   */
  errorHttpStatusCode?: number;
}

/**
 * Factory function to create a configured ParseFilePipe
 * This provides a simple, reusable way to add file validation to any endpoint
 */
export function createFileValidationPipe(options: FileValidationOptions = {}): ParseFilePipe {
  const {
    maxSize = 5 * 1024 * 1024, // 5MB default
    fileTypes = Object.values(FileType),
    fileIsRequired = true,
    errorHttpStatusCode = HttpStatus.UNPROCESSABLE_ENTITY,
  } = options;

  const validators = [
    new MaxFileSizeValidator({ maxSize }),
    new FileTypeValidator({ fileType: new RegExp(fileTypes.join('|')) }),
  ];

  return new ParseFilePipe({
    validators,
    errorHttpStatusCode,
    fileIsRequired,
  });
}

/**
 * Pre-configured pipes for common use cases
 */
export const FileValidationPipes = {
  /**
   * Image files only (JPEG, PNG, GIF, WEBP, SVG)
   * Max size: 5MB
   */
  image: (maxSize = 5 * 1024 * 1024) =>
    createFileValidationPipe({
      maxSize,
      fileTypes: [...FileTypeCategories.IMAGES],
    }),

  /**
   * Document files only (PDF, DOC, DOCX, XLS, XLSX, etc.)
   * Max size: 10MB
   */
  document: (maxSize = 10 * 1024 * 1024) =>
    createFileValidationPipe({
      maxSize,
      fileTypes: [...FileTypeCategories.DOCUMENTS],
    }),

  /**
   * Archive files only (ZIP, RAR, TAR, GZIP)
   * Max size: 50MB
   */
  archive: (maxSize = 50 * 1024 * 1024) =>
    createFileValidationPipe({
      maxSize,
      fileTypes: [...FileTypeCategories.ARCHIVES],
    }),

  /**
   * Media files only (MP4, MP3, WAV, AVI, MOV)
   * Max size: 100MB
   */
  media: (maxSize = 100 * 1024 * 1024) =>
    createFileValidationPipe({
      maxSize,
      fileTypes: [...FileTypeCategories.MEDIA],
    }),

  /**
   * PDF files only
   * Max size: 10MB
   */
  pdf: (maxSize = 10 * 1024 * 1024) =>
    createFileValidationPipe({
      maxSize,
      fileTypes: [FileType.PDF],
    }),

  /**
   * CSV files only
   * Max size: 5MB
   */
  csv: (maxSize = 5 * 1024 * 1024) =>
    createFileValidationPipe({
      maxSize,
      fileTypes: [FileType.CSV],
    }),

  /**
   * JSON files only
   * Max size: 2MB
   */
  json: (maxSize = 2 * 1024 * 1024) =>
    createFileValidationPipe({
      maxSize,
      fileTypes: [FileType.JSON],
    }),
};
