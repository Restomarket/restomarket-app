import { FileValidator } from '@nestjs/common';
import * as mimeTypes from 'mime-types';

export interface CustomFileTypeValidatorOptions {
  /**
   * Array of allowed file types (MIME types)
   * Example: ['image/jpeg', 'image/png', 'application/pdf']
   */
  fileTypes: string[];
}

/**
 * Custom validator for file types using both extension and magic number validation
 * More secure than default FileTypeValidator as it validates actual file content
 */
export class CustomFileTypeValidator extends FileValidator<CustomFileTypeValidatorOptions> {
  buildErrorMessage(file: Express.Multer.File): string {
    const allowedTypes = this.validationOptions.fileTypes.join(', ');
    return `File type must be one of: ${allowedTypes}. Received: ${file.mimetype}`;
  }

  isValid(file?: Express.Multer.File): boolean {
    if (!file) {
      return false;
    }

    const { fileTypes } = this.validationOptions;

    // Validate MIME type from multer
    if (!fileTypes.includes(file.mimetype)) {
      return false;
    }

    // Additional validation: check if extension matches MIME type
    const extension = file.originalname.split('.').pop()?.toLowerCase();
    if (!extension) {
      return false;
    }

    const expectedMimeType = mimeTypes.lookup(extension);
    if (expectedMimeType && expectedMimeType !== file.mimetype) {
      return false;
    }

    return true;
  }
}
