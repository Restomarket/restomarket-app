import { Injectable } from '@nestjs/common';
import { REGEX_PATTERNS } from '@common/constants';

/**
 * Service for custom validation helpers
 */
@Injectable()
export class ValidationService {
  /**
   * Validate email format
   */
  isValidEmail(email: string): boolean {
    return REGEX_PATTERNS.EMAIL.test(email);
  }

  /**
   * Validate UUID format
   */
  isValidUUID(uuid: string): boolean {
    return REGEX_PATTERNS.UUID.test(uuid);
  }

  /**
   * Validate phone number format
   */
  isValidPhone(phone: string): boolean {
    return REGEX_PATTERNS.PHONE.test(phone);
  }

  /**
   * Validate URL format
   */
  isValidURL(url: string): boolean {
    return REGEX_PATTERNS.URL.test(url);
  }

  /**
   * Check if string is empty or only whitespace
   */
  isEmpty(value: string): boolean {
    return !value || value.trim().length === 0;
  }

  /**
   * Check if value is within range
   */
  isInRange(value: number, min: number, max: number): boolean {
    return value >= min && value <= max;
  }

  /**
   * Sanitize string by removing special characters
   */
  sanitizeString(value: string): string {
    return value.replace(/[^\w\s-]/gi, '');
  }

  /**
   * Check if array has duplicates
   */
  hasDuplicates<T>(array: T[]): boolean {
    return new Set(array).size !== array.length;
  }

  /**
   * Validate minimum length
   */
  hasMinLength(value: string, minLength: number): boolean {
    return value.length >= minLength;
  }

  /**
   * Validate maximum length
   */
  hasMaxLength(value: string, maxLength: number): boolean {
    return value.length <= maxLength;
  }
}
