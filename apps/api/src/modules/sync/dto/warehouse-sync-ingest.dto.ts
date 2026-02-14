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
  IsNumber,
  IsInt,
  Min,
  Max,
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

  @ApiProperty({ description: 'Warehouse code (business identifier, must be unique per vendor)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code!: string;

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

  @ApiPropertyOptional({ description: 'State or province (for US/Canada)' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  state?: string;

  @ApiPropertyOptional({ description: 'GPS latitude (EBP: Address_Latitude)' })
  @IsNumber()
  @IsOptional()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ description: 'GPS longitude (EBP: Address_Longitude)' })
  @IsNumber()
  @IsOptional()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({ description: 'Whether the warehouse is active', default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Whether this is the main warehouse (EBP: Main)',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isMain?: boolean;

  @ApiPropertyOptional({
    description: 'Warehouse type: 0=Storage, 1=Transit (EBP: Storehouse.Type)',
    default: 0,
  })
  @IsInt()
  @IsOptional()
  @Min(0)
  @Max(1)
  type?: number;

  @ApiPropertyOptional({
    description: 'Whether bin/aisle multi-location tracking is enabled (EBP: MultiLocationEnabled)',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  multiLocationEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Date of last physical inventory count (EBP: LastInventoryDate)',
  })
  @IsDateString()
  @IsOptional()
  lastInventoryDate?: string;

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
