import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsNumber, Min, MaxLength } from 'class-validator';

export class OrderItemDto {
  @ApiProperty({ example: 'SKU-001' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  sku!: string;

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

  @ApiPropertyOptional({ example: 9.99 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @ApiPropertyOptional({ example: 20.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  vatRate?: number;
}
