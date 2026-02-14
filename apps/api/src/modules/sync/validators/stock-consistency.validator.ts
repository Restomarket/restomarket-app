import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  ValidationOptions,
  registerDecorator,
} from 'class-validator';

/**
 * Stock Consistency Validator
 *
 * Ensures virtualStock = realStock - reservedQuantity (with tolerance for rounding)
 * Prevents data corruption from ERP bugs or network transmission errors
 *
 * EBP enforces this relationship:
 * - realStock: Physical stock on hand
 * - reservedQuantity: Stock allocated for orders (BookedQuantity in EBP)
 * - virtualStock: Available for sale = realStock - reservedQuantity
 *
 * @example
 * ```typescript
 * export class StockSyncPayloadDto {
 *   @IsNumber()
 *   realStock!: number;
 *
 *   @IsNumber()
 *   @ValidateStockConsistency()
 *   virtualStock!: number;
 *
 *   @IsNumber()
 *   reservedQuantity!: number;
 * }
 * ```
 */
@ValidatorConstraint({ name: 'stockConsistency', async: false })
export class StockConsistencyConstraint implements ValidatorConstraintInterface {
  validate(virtualStock: unknown, args: ValidationArguments) {
    const dto = args.object as Record<string, unknown>;

    // Skip validation if any field is missing (let @IsNotEmpty handle it)
    if (
      virtualStock === undefined ||
      dto.realStock === undefined ||
      dto.reservedQuantity === undefined
    ) {
      return true;
    }

    const real = parseFloat(String(dto.realStock));
    const reserved = parseFloat(String(dto.reservedQuantity));
    const virtual = parseFloat(String(virtualStock));

    // Expected: virtual = real - reserved
    const expected = real - reserved;
    const tolerance = 0.001; // Allow ±0.001 for floating point rounding

    const drift = Math.abs(virtual - expected);
    return drift <= tolerance;
  }

  defaultMessage(args: ValidationArguments) {
    const dto = args.object as Record<string, unknown>;
    const real = parseFloat(String(dto.realStock || 0));
    const reserved = parseFloat(String(dto.reservedQuantity || 0));
    const virtual = parseFloat(String(args.value || 0));
    const expected = real - reserved;
    const drift = Math.abs(virtual - expected);

    return (
      `Stock consistency violation for ${String(dto.itemSku || 'unknown')}@${String(dto.erpWarehouseId || 'unknown')}: ` +
      `virtualStock (${virtual}) must equal realStock (${real}) - reservedQuantity (${reserved}). ` +
      `Expected: ${expected.toFixed(3)}, Actual: ${virtual}, Drift: ${drift.toFixed(3)}`
    );
  }
}

/**
 * Decorator for stock consistency validation
 * Apply to virtualStock field in DTOs
 *
 * @param validationOptions - Optional class-validator validation options
 *
 * @example
 * ```typescript
 * @ValidateStockConsistency({ message: 'Custom error message' })
 * virtualStock!: number;
 * ```
 */
export function ValidateStockConsistency(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: StockConsistencyConstraint,
    });
  };
}
