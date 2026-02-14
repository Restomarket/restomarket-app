/**
 * ERP Mapping Interfaces
 *
 * Type definitions for ERP code mapping resolution.
 */

/**
 * Result from successful mapping resolution
 */
export interface MappingResult {
  /** RestoMarket standardized code */
  restoCode: string;

  /** Display label for UI */
  restoLabel: string;

  /**
   * Resolved numeric rate (for VAT)
   * String representation of decimal (e.g. "20.00")
   */
  rate?: string;
}

/**
 * Cache entry with expiration
 */
export interface CacheEntry {
  result: MappingResult;
  expiresAt: number;
}

/**
 * Mapping types supported
 */
export type MappingType = 'unit' | 'vat' | 'family' | 'subfamily';

/**
 * Cache statistics for monitoring
 */
export interface CacheStats {
  size: number;
  maxSize: number;
  hitRate: number;
  missRate: number;
}
