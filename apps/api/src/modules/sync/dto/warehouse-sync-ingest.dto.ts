import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  MaxLength,
  IsArray,
  ValidateNested,
  ArrayMaxSize,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class WarehouseSyncPayloadDto {
  @ApiProperty({ description: 'ERP warehouse identifier' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  erpWarehouseId!: string;

  @ApiProperty({ description: 'Warehouse name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({ description: 'Warehouse code' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  code?: string;

  @ApiPropertyOptional({ description: 'Warehouse address' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ description: 'City' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({ description: 'Postal code' })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  postalCode?: string;

  @ApiPropertyOptional({ description: 'Country code (ISO 3166-1 alpha-2)', default: 'FR' })
  @IsString()
  @IsOptional()
  @MaxLength(2)
  country?: string;

  @ApiPropertyOptional({ description: 'Whether the warehouse is active', default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({ description: 'Content hash for deduplication (SHA-256)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  contentHash!: string;

  @ApiProperty({ description: 'Timestamp of when this data was synced from ERP' })
  @IsDateString()
  @IsNotEmpty()
  lastSyncedAt!: string;
}

export class WarehouseSyncIngestDto {
  @ApiProperty({ description: 'Vendor ID from agent auth context' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  vendorId!: string;

  @ApiProperty({ description: 'Array of warehouses to sync', type: [WarehouseSyncPayloadDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WarehouseSyncPayloadDto)
  @ArrayMaxSize(500, { message: 'Maximum 500 warehouses per incremental sync request' })
  warehouses!: WarehouseSyncPayloadDto[];
}

export class WarehouseSyncBatchIngestDto {
  @ApiProperty({ description: 'Vendor ID from agent auth context' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  vendorId!: string;

  @ApiProperty({
    description: 'Array of warehouses to sync (batch mode)',
    type: [WarehouseSyncPayloadDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WarehouseSyncPayloadDto)
  @ArrayMaxSize(5000, { message: 'Maximum 5000 warehouses per batch sync request' })
  warehouses!: WarehouseSyncPayloadDto[];
}
