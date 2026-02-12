import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsIn,
  IsBoolean,
  IsOptional,
  IsArray,
  ValidateNested,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Valid mapping types
 */
const MAPPING_TYPES = ['unit', 'vat', 'family', 'subfamily'] as const;

/**
 * DTO for creating a single ERP code mapping
 */
export class CreateErpMappingDto {
  @ApiProperty({
    description: 'Vendor ID',
    example: 'vendor-123',
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  vendorId!: string;

  @ApiProperty({
    description: 'Type of mapping',
    enum: MAPPING_TYPES,
    example: 'unit',
  })
  @IsString()
  @IsIn(MAPPING_TYPES)
  mappingType!: string;

  @ApiProperty({
    description: 'ERP-side code (vendor-specific)',
    example: 'KG',
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  erpCode!: string;

  @ApiProperty({
    description: 'RestoMarket standardized code',
    example: 'kilogram',
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  restoCode!: string;

  @ApiProperty({
    description: 'Display label for UI',
    example: 'Kilogramme',
    minLength: 1,
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(255)
  restoLabel!: string;

  @ApiPropertyOptional({
    description: 'Whether mapping is active',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/**
 * DTO for updating an existing ERP code mapping
 */
export class UpdateErpMappingDto {
  @ApiPropertyOptional({
    description: 'RestoMarket standardized code',
    example: 'kilogram',
    minLength: 1,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  restoCode?: string;

  @ApiPropertyOptional({
    description: 'Display label for UI',
    example: 'Kilogramme',
    minLength: 1,
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(255)
  restoLabel?: string;

  @ApiPropertyOptional({
    description: 'Whether mapping is active',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/**
 * Single mapping entry for bulk seeding
 */
class SeedMappingEntry {
  @ApiProperty({
    description: 'Type of mapping',
    enum: MAPPING_TYPES,
    example: 'unit',
  })
  @IsString()
  @IsIn(MAPPING_TYPES)
  mappingType!: string;

  @ApiProperty({
    description: 'ERP-side code',
    example: 'KG',
  })
  @IsString()
  @IsNotEmpty()
  erpCode!: string;

  @ApiProperty({
    description: 'RestoMarket standardized code',
    example: 'kilogram',
  })
  @IsString()
  @IsNotEmpty()
  restoCode!: string;

  @ApiProperty({
    description: 'Display label',
    example: 'Kilogramme',
  })
  @IsString()
  @IsNotEmpty()
  restoLabel!: string;
}

/**
 * DTO for bulk seeding mappings
 */
export class SeedErpMappingsDto {
  @ApiProperty({
    description: 'Vendor ID for all mappings',
    example: 'vendor-123',
  })
  @IsString()
  @IsNotEmpty()
  vendorId!: string;

  @ApiProperty({
    description: 'Array of mappings to seed',
    type: [SeedMappingEntry],
    example: [
      { mappingType: 'unit', erpCode: 'KG', restoCode: 'kilogram', restoLabel: 'Kilogramme' },
      { mappingType: 'unit', erpCode: 'L', restoCode: 'liter', restoLabel: 'Litre' },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SeedMappingEntry)
  mappings!: SeedMappingEntry[];
}
