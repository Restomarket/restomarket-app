import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  IsUUID,
  IsBoolean,
  Min,
  MaxLength,
} from 'class-validator';

export class OrderItemDto {
  @ApiProperty({ example: 'SKU-001' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  sku!: string;

  @ApiPropertyOptional({ example: 'item-uuid', description: 'Reference to items table' })
  @IsOptional()
  @IsUUID()
  itemId?: string;

  @ApiPropertyOptional({ example: 'Product description' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ example: 10, description: 'Ordered quantity' })
  @IsNumber()
  @Min(0)
  quantity!: number;

  @ApiPropertyOptional({ example: 'KG' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  unitCode?: string;

  @ApiPropertyOptional({ example: 'warehouse-uuid', description: 'Source warehouse for this line' })
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @ApiPropertyOptional({ example: true, description: 'Whether item affects inventory' })
  @IsOptional()
  @IsBoolean()
  manageStock?: boolean;

  @ApiProperty({ example: 9.99, description: 'Unit selling price excluding VAT' })
  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @ApiPropertyOptional({ example: 20.0, description: 'VAT rate percentage' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  vatRate?: number;

  @ApiPropertyOptional({ example: 5.0, description: 'Line discount rate (percentage)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountRate?: number;
}
