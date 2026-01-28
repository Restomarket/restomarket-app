import { FileValidator } from '@nestjs/common';

export interface FileSizeValidatorOptions {
  /**
   * Maximum file size in bytes
   */
  maxSize: number;

  /**
   * Minimum file size in bytes (optional)
   */
  minSize?: number;
}

/**
 * Enhanced file size validator with both min and max size validation
 */
export class EnhancedFileSizeValidator extends FileValidator<FileSizeValidatorOptions> {
  buildErrorMessage(file: Express.Multer.File): string {
    const maxSizeMB = (this.validationOptions.maxSize / 1024 / 1024).toFixed(2);
    const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);

    if (this.validationOptions.minSize && file.size < this.validationOptions.minSize) {
      const minSizeMB = (this.validationOptions.minSize / 1024 / 1024).toFixed(2);
      return `File size must be at least ${minSizeMB} MB. Received: ${fileSizeMB} MB`;
    }

    return `File size must not exceed ${maxSizeMB} MB. Received: ${fileSizeMB} MB`;
  }

  isValid(file?: Express.Multer.File): boolean {
    if (!file) {
      return false;
    }

    const { maxSize, minSize } = this.validationOptions;

    if (minSize && file.size < minSize) {
      return false;
    }

    if (file.size > maxSize) {
      return false;
    }

    return true;
  }
}
