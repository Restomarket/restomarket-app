import { Injectable } from '@nestjs/common';

/**
 * Service for date manipulation and formatting
 */
@Injectable()
export class DateService {
  /**
   * Get current timestamp in ISO format
   */
  getCurrentTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * Format date to ISO string
   */
  formatToISO(date: Date): string {
    return date.toISOString();
  }

  /**
   * Check if a date is in the past
   */
  isPast(date: Date): boolean {
    return date.getTime() < Date.now();
  }

  /**
   * Check if a date is in the future
   */
  isFuture(date: Date): boolean {
    return date.getTime() > Date.now();
  }

  /**
   * Add days to a date
   */
  addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  /**
   * Add hours to a date
   */
  addHours(date: Date, hours: number): Date {
    const result = new Date(date);
    result.setHours(result.getHours() + hours);
    return result;
  }

  /**
   * Get start of day
   */
  startOfDay(date: Date): Date {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  /**
   * Get end of day
   */
  endOfDay(date: Date): Date {
    const result = new Date(date);
    result.setHours(23, 59, 59, 999);
    return result;
  }

  /**
   * Parse date string to Date object
   */
  parseDate(dateString: string): Date {
    return new Date(dateString);
  }

  /**
   * Check if date is valid
   */
  isValidDate(date: Date): boolean {
    return date instanceof Date && !isNaN(date.getTime());
  }
}
