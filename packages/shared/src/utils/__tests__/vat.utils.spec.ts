import { describe, it, expect } from '@jest/globals';
import {
  snapToValidVatRate,
  isValidVatRate,
  getValidVatRates,
  calculateVatRate,
  calculateVatAmount,
  calculatePriceInclVat,
  calculatePriceExclVat,
  VatRateError,
} from '../vat.utils.js';

describe('VAT Utils', () => {
  describe('snapToValidVatRate', () => {
    describe('Moroccan rates (MA)', () => {
      it('should snap to nearest valid Moroccan rate', () => {
        expect(snapToValidVatRate(19.5, 'MA')).toBe(20);
        expect(snapToValidVatRate(20.48, 'MA')).toBe(20);
        expect(snapToValidVatRate(20.73, 'MA')).toBe(20); // From 82→99 price example
        expect(snapToValidVatRate(13.8, 'MA')).toBe(14);
        expect(snapToValidVatRate(14.2, 'MA')).toBe(14);
        expect(snapToValidVatRate(7.2, 'MA')).toBe(7);
        expect(snapToValidVatRate(6.8, 'MA')).toBe(7);
        expect(snapToValidVatRate(0.5, 'MA')).toBe(0);
      });

      it('should return exact rate if already valid', () => {
        expect(snapToValidVatRate(20, 'MA')).toBe(20);
        expect(snapToValidVatRate(14, 'MA')).toBe(14);
        expect(snapToValidVatRate(10, 'MA')).toBe(10);
        expect(snapToValidVatRate(7, 'MA')).toBe(7);
        expect(snapToValidVatRate(0, 'MA')).toBe(0);
      });

      it('should throw in strict mode when drift exceeds tolerance', () => {
        expect(() => snapToValidVatRate(25, 'MA', true)).toThrow(VatRateError);
        expect(() => snapToValidVatRate(50, 'MA', true)).toThrow(VatRateError);
        expect(() => snapToValidVatRate(3.5, 'MA', true)).toThrow(VatRateError);
      });

      it('should snap (not throw) in non-strict mode with large drift', () => {
        expect(snapToValidVatRate(25, 'MA', false)).toBe(20); // Closest to 20
        expect(snapToValidVatRate(50, 'MA', false)).toBe(20); // Still closest to 20
        expect(snapToValidVatRate(3.5, 'MA', false)).toBe(0); // Closest to 0
      });
    });

    describe('French rates (FR)', () => {
      it('should snap to nearest valid French rate', () => {
        expect(snapToValidVatRate(19.8, 'FR')).toBe(20);
        expect(snapToValidVatRate(10.2, 'FR')).toBe(10);
        expect(snapToValidVatRate(5.4, 'FR')).toBe(5.5);
        expect(snapToValidVatRate(5.6, 'FR')).toBe(5.5);
        expect(snapToValidVatRate(2.0, 'FR')).toBe(2.1);
        expect(snapToValidVatRate(2.2, 'FR')).toBe(2.1);
      });

      it('should return exact rate if already valid', () => {
        expect(snapToValidVatRate(20, 'FR')).toBe(20);
        expect(snapToValidVatRate(10, 'FR')).toBe(10);
        expect(snapToValidVatRate(5.5, 'FR')).toBe(5.5);
        expect(snapToValidVatRate(2.1, 'FR')).toBe(2.1);
        expect(snapToValidVatRate(0, 'FR')).toBe(0);
      });
    });

    describe('Spanish rates (ES)', () => {
      it('should snap to nearest valid Spanish rate', () => {
        expect(snapToValidVatRate(20.5, 'ES')).toBe(21);
        expect(snapToValidVatRate(9.8, 'ES')).toBe(10);
        expect(snapToValidVatRate(4.2, 'ES')).toBe(4);
      });

      it('should return exact rate if already valid', () => {
        expect(snapToValidVatRate(21, 'ES')).toBe(21);
        expect(snapToValidVatRate(10, 'ES')).toBe(10);
        expect(snapToValidVatRate(4, 'ES')).toBe(4);
        expect(snapToValidVatRate(0, 'ES')).toBe(0);
      });
    });

    describe('UK rates (GB)', () => {
      it('should snap to nearest valid UK rate', () => {
        expect(snapToValidVatRate(19.5, 'GB')).toBe(20);
        expect(snapToValidVatRate(5.2, 'GB')).toBe(5);
        expect(snapToValidVatRate(4.8, 'GB')).toBe(5);
      });

      it('should return exact rate if already valid', () => {
        expect(snapToValidVatRate(20, 'GB')).toBe(20);
        expect(snapToValidVatRate(5, 'GB')).toBe(5);
        expect(snapToValidVatRate(0, 'GB')).toBe(0);
      });
    });

    describe('Unknown country (defaults to MA)', () => {
      it('should use Moroccan rates as default', () => {
        expect(snapToValidVatRate(19.5, 'XX')).toBe(20);
        expect(snapToValidVatRate(14.2, 'UNKNOWN')).toBe(14);
      });
    });
  });

  describe('isValidVatRate', () => {
    it('should validate Moroccan rates', () => {
      expect(isValidVatRate(20, 'MA')).toBe(true);
      expect(isValidVatRate(20.001, 'MA')).toBe(true); // Within rounding tolerance
      expect(isValidVatRate(14, 'MA')).toBe(true);
      expect(isValidVatRate(10, 'MA')).toBe(true);
      expect(isValidVatRate(7, 'MA')).toBe(true);
      expect(isValidVatRate(0, 'MA')).toBe(true);

      expect(isValidVatRate(19.5, 'MA')).toBe(false); // Too far from 20
      expect(isValidVatRate(25, 'MA')).toBe(false); // Invalid rate
    });

    it('should validate French rates', () => {
      expect(isValidVatRate(20, 'FR')).toBe(true);
      expect(isValidVatRate(10, 'FR')).toBe(true);
      expect(isValidVatRate(5.5, 'FR')).toBe(true);
      expect(isValidVatRate(2.1, 'FR')).toBe(true);

      expect(isValidVatRate(5.4, 'FR')).toBe(false); // Not close enough to 5.5
    });
  });

  describe('getValidVatRates', () => {
    it('should return valid rates for Morocco', () => {
      expect(getValidVatRates('MA')).toEqual([0, 7, 10, 14, 20]);
    });

    it('should return valid rates for France', () => {
      expect(getValidVatRates('FR')).toEqual([0, 2.1, 5.5, 10, 20]);
    });

    it('should return valid rates for Spain', () => {
      expect(getValidVatRates('ES')).toEqual([0, 4, 10, 21]);
    });

    it('should return valid rates for UK', () => {
      expect(getValidVatRates('GB')).toEqual([0, 5, 20]);
    });

    it('should return copy to prevent mutation', () => {
      const rates = getValidVatRates('MA');
      rates.push(999); // Mutate returned array
      expect(getValidVatRates('MA')).toEqual([0, 7, 10, 14, 20]); // Original unchanged
    });
  });

  describe('calculateVatRate', () => {
    it('should back-calculate and snap VAT rate (perfect calculation)', () => {
      expect(calculateVatRate(100, 120, 'MA')).toBe(20); // 20% VAT
      expect(calculateVatRate(100, 114, 'MA')).toBe(14); // 14% VAT
      expect(calculateVatRate(100, 110, 'MA')).toBe(10); // 10% VAT
      expect(calculateVatRate(100, 107, 'MA')).toBe(7); // 7% VAT
      expect(calculateVatRate(100, 100, 'MA')).toBe(0); // 0% VAT
    });

    it('should back-calculate and snap VAT rate (with price rounding)', () => {
      // EBP example: 82 HT → 99 TTC = 20.73% → 20%
      expect(calculateVatRate(82, 99, 'MA')).toBe(20);

      // Another rounding example: 100 HT → 120.48 TTC = 20.48% → 20%
      expect(calculateVatRate(100, 120.48, 'MA')).toBe(20);

      // Edge case: 100 HT → 113.9 TTC = 13.9% → 14%
      expect(calculateVatRate(100, 113.9, 'MA')).toBe(14);
    });

    it('should work with French rates', () => {
      expect(calculateVatRate(100, 120, 'FR')).toBe(20);
      expect(calculateVatRate(100, 110, 'FR')).toBe(10);
      expect(calculateVatRate(100, 105.5, 'FR')).toBe(5.5);
      expect(calculateVatRate(100, 102.1, 'FR')).toBe(2.1);
    });

    it('should throw on invalid input', () => {
      expect(() => calculateVatRate(0, 120, 'MA')).toThrow('Price excluding VAT must be positive');
      expect(() => calculateVatRate(-100, 120, 'MA')).toThrow(
        'Price excluding VAT must be positive',
      );
    });
  });

  describe('calculateVatAmount', () => {
    it('should calculate VAT amount correctly', () => {
      expect(calculateVatAmount(100, 20)).toBe(20);
      expect(calculateVatAmount(100, 14)).toBe(14);
      expect(calculateVatAmount(100, 10)).toBe(10);
      expect(calculateVatAmount(100, 7)).toBe(7);
      expect(calculateVatAmount(100, 0)).toBe(0);
    });

    it('should handle decimal prices', () => {
      expect(calculateVatAmount(82, 20)).toBeCloseTo(16.4);
      expect(calculateVatAmount(99.99, 20)).toBeCloseTo(19.998);
    });
  });

  describe('calculatePriceInclVat', () => {
    it('should calculate price including VAT correctly', () => {
      expect(calculatePriceInclVat(100, 20)).toBe(120);
      expect(calculatePriceInclVat(100, 14)).toBe(114);
      expect(calculatePriceInclVat(100, 10)).toBe(110);
      expect(calculatePriceInclVat(100, 7)).toBe(107);
      expect(calculatePriceInclVat(100, 0)).toBe(100);
    });

    it('should handle decimal prices', () => {
      expect(calculatePriceInclVat(82, 20)).toBeCloseTo(98.4);
      expect(calculatePriceInclVat(99.99, 20)).toBeCloseTo(119.988);
    });
  });

  describe('calculatePriceExclVat', () => {
    it('should calculate price excluding VAT correctly', () => {
      expect(calculatePriceExclVat(120, 20)).toBeCloseTo(100);
      expect(calculatePriceExclVat(114, 14)).toBeCloseTo(100);
      expect(calculatePriceExclVat(110, 10)).toBeCloseTo(100);
      expect(calculatePriceExclVat(107, 7)).toBeCloseTo(100);
      expect(calculatePriceExclVat(100, 0)).toBe(100);
    });

    it('should handle decimal prices', () => {
      expect(calculatePriceExclVat(99, 20)).toBeCloseTo(82.5);
      expect(calculatePriceExclVat(120.48, 20)).toBeCloseTo(100.4);
    });
  });

  describe('Real-world EBP scenarios', () => {
    it('should handle EBP import file examples', () => {
      // From EBP documentation: 82 HT, 99 TTC, rate should be 20
      const rate1 = calculateVatRate(82, 99, 'MA');
      expect(rate1).toBe(20);
      expect(calculatePriceInclVat(82, rate1)).toBeCloseTo(98.4); // Close to 99

      // Perfect calculation: 100 HT, 120 TTC
      const rate2 = calculateVatRate(100, 120, 'MA');
      expect(rate2).toBe(20);
      expect(calculatePriceInclVat(100, rate2)).toBe(120);

      // Edge case with rounding: 100 HT, 120.48 TTC
      const rate3 = calculateVatRate(100, 120.48, 'MA');
      expect(rate3).toBe(20);
      expect(calculateVatAmount(100, rate3)).toBe(20);
    });

    it('should prevent EBP import rejection due to invalid VAT rates', () => {
      // These would fail EBP import without snapping
      const invalidRates = [20.48, 20.73, 19.5, 14.2, 13.8, 7.3, 6.7];

      for (const invalidRate of invalidRates) {
        const snapped = snapToValidVatRate(invalidRate, 'MA');
        expect([0, 7, 10, 14, 20]).toContain(snapped);
      }
    });
  });
});
