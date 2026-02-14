/**
 * VAT Rate Utilities
 *
 * Ensures VAT rates conform to country-specific legal rates.
 * Prevents ERP import failures due to rate drift from price rounding.
 *
 * @example
 * ```typescript
 * // Snap drifted VAT rate to nearest valid Moroccan rate
 * snapToValidVatRate(20.48, 'MA') // Returns 20
 * snapToValidVatRate(19.5, 'MA')  // Returns 20
 *
 * // Calculate VAT rate from prices and snap to valid rate
 * calculateVatRate(100, 120.48, 'MA') // Returns 20 (from 20.48%)
 * ```
 */

export interface VatRateConfig {
  countryCode: string;
  validRates: number[];
  tolerance: number; // Maximum acceptable drift in percentage points
}

/**
 * VAT rate configurations by country (ISO 3166-1 alpha-2)
 * Each country has legally defined VAT rates that must be used
 */
const VAT_RATE_CONFIGS: Record<string, VatRateConfig> = {
  MA: {
    countryCode: 'MA',
    validRates: [0, 7, 10, 14, 20], // Morocco standard rates
    tolerance: 3, // ±3% drift is suspicious
  },
  FR: {
    countryCode: 'FR',
    validRates: [0, 2.1, 5.5, 10, 20], // France standard rates
    tolerance: 2,
  },
  ES: {
    countryCode: 'ES',
    validRates: [0, 4, 10, 21], // Spain standard rates
    tolerance: 2,
  },
  GB: {
    countryCode: 'GB',
    validRates: [0, 5, 20], // UK standard rates
    tolerance: 2,
  },
  DE: {
    countryCode: 'DE',
    validRates: [0, 7, 19], // Germany standard rates
    tolerance: 2,
  },
  IT: {
    countryCode: 'IT',
    validRates: [0, 4, 5, 10, 22], // Italy standard rates
    tolerance: 2,
  },
  // Add more countries as needed
};

export class VatRateError extends Error {
  constructor(
    public rate: number,
    public countryCode: string,
    public closestValidRate: number,
    public drift: number,
  ) {
    super(
      `VAT rate ${rate}% is invalid for ${countryCode}. Closest valid rate: ${closestValidRate}% (drift: ${drift.toFixed(2)}%)`,
    );
    this.name = 'VatRateError';
  }
}

/**
 * Snap a VAT rate to the nearest valid rate for a country
 *
 * ERP systems (like EBP) only accept standard VAT rates defined by law.
 * Back-calculated VAT rates from rounded prices can drift slightly.
 * This function snaps them to the nearest legal rate.
 *
 * @param rate - Input VAT rate (can be back-calculated from prices)
 * @param countryCode - ISO 3166-1 alpha-2 country code (default: 'MA')
 * @param strict - If true, throws error when drift exceeds tolerance
 * @returns Closest valid VAT rate
 *
 * @example
 * snapToValidVatRate(20.48, 'MA') // Returns 20 (Morocco)
 * snapToValidVatRate(19.5, 'MA')  // Returns 20 (Morocco)
 * snapToValidVatRate(2.2, 'FR')   // Returns 2.1 (France)
 *
 * @throws {VatRateError} In strict mode when drift exceeds tolerance
 */
export function snapToValidVatRate(
  rate: number,
  countryCode: string = 'MA',
  strict: boolean = false,
): number {
  // Get config for country, fallback to Morocco if not found
  let config = VAT_RATE_CONFIGS[countryCode];
  if (!config) {
    config = VAT_RATE_CONFIGS['MA']!; // Safe: MA config is always defined
  }

  const validRates = config.validRates;

  // Find closest valid rate
  let closest = validRates[0]!; // Safe: validRates always has at least one element
  let minDiff = Math.abs(rate - closest);

  for (const validRate of validRates) {
    const diff = Math.abs(rate - validRate);
    if (diff < minDiff) {
      minDiff = diff;
      closest = validRate;
    }
  }

  // Check if drift exceeds tolerance
  if (minDiff > config.tolerance) {
    if (strict) {
      throw new VatRateError(rate, countryCode, closest, minDiff);
    }
    // Non-strict mode: log warning but return closest rate
    console.warn(
      `⚠️ VAT rate ${rate}% is ${minDiff.toFixed(2)}% away from nearest valid rate ${closest}% for ${countryCode}. Snapping to ${closest}%.`,
    );
  }

  return closest;
}

/**
 * Validate that a VAT rate is legal for a country (within tolerance)
 *
 * @param rate - VAT rate to validate
 * @param countryCode - ISO 3166-1 alpha-2 country code
 * @returns True if rate is valid (exact match or within rounding tolerance)
 *
 * @example
 * isValidVatRate(20, 'MA')    // true (exact match)
 * isValidVatRate(20.01, 'MA') // true (within rounding tolerance)
 * isValidVatRate(19.5, 'MA')  // false (too far from 20)
 */
export function isValidVatRate(rate: number, countryCode: string = 'MA'): boolean {
  try {
    const snapped = snapToValidVatRate(rate, countryCode, true);
    return Math.abs(rate - snapped) < 0.01; // Allow 0.01% rounding error
  } catch (error) {
    if (error instanceof VatRateError) {
      return false;
    }
    throw error;
  }
}

/**
 * Get all valid VAT rates for a country
 *
 * @param countryCode - ISO 3166-1 alpha-2 country code
 * @returns Array of valid VAT rates
 *
 * @example
 * getValidVatRates('MA') // [0, 7, 10, 14, 20]
 * getValidVatRates('FR') // [0, 2.1, 5.5, 10, 20]
 */
export function getValidVatRates(countryCode: string): number[] {
  const config = VAT_RATE_CONFIGS[countryCode];
  if (!config) {
    // Return Morocco rates as default
    return [...VAT_RATE_CONFIGS['MA']!.validRates];
  }
  return [...config.validRates]; // Return copy to prevent mutation
}

/**
 * Back-calculate VAT rate from prices and snap to nearest valid rate
 *
 * Useful when receiving prices from external systems where VAT rate
 * needs to be inferred from price difference.
 *
 * @param priceExclVat - Price excluding VAT
 * @param priceInclVat - Price including VAT
 * @param countryCode - ISO 3166-1 alpha-2 country code
 * @returns Snapped VAT rate
 *
 * @example
 * calculateVatRate(100, 120, 'MA')     // Returns 20 (from 20% VAT)
 * calculateVatRate(100, 120.48, 'MA')  // Returns 20 (snapped from 20.48%)
 * calculateVatRate(82, 99, 'MA')       // Returns 20 (snapped from 20.73%)
 *
 * @throws {Error} If priceExclVat is not positive
 */
export function calculateVatRate(
  priceExclVat: number,
  priceInclVat: number,
  countryCode: string = 'MA',
): number {
  if (priceExclVat <= 0) {
    throw new Error('Price excluding VAT must be positive');
  }

  const rawRate = ((priceInclVat - priceExclVat) / priceExclVat) * 100;
  return snapToValidVatRate(rawRate, countryCode);
}

/**
 * Calculate VAT amount from price and rate
 *
 * @param priceExclVat - Price excluding VAT
 * @param vatRate - VAT rate (%)
 * @returns VAT amount
 *
 * @example
 * calculateVatAmount(100, 20) // Returns 20
 * calculateVatAmount(82, 20)  // Returns 16.4
 */
export function calculateVatAmount(priceExclVat: number, vatRate: number): number {
  return (priceExclVat * vatRate) / 100;
}

/**
 * Calculate price including VAT from price excluding VAT and rate
 *
 * @param priceExclVat - Price excluding VAT
 * @param vatRate - VAT rate (%)
 * @returns Price including VAT
 *
 * @example
 * calculatePriceInclVat(100, 20) // Returns 120
 * calculatePriceInclVat(82, 20)  // Returns 98.4
 */
export function calculatePriceInclVat(priceExclVat: number, vatRate: number): number {
  return priceExclVat * (1 + vatRate / 100);
}

/**
 * Calculate price excluding VAT from price including VAT and rate
 *
 * @param priceInclVat - Price including VAT
 * @param vatRate - VAT rate (%)
 * @returns Price excluding VAT
 *
 * @example
 * calculatePriceExclVat(120, 20) // Returns 100
 * calculatePriceExclVat(99, 20)  // Returns 82.5
 */
export function calculatePriceExclVat(priceInclVat: number, vatRate: number): number {
  return priceInclVat / (1 + vatRate / 100);
}
