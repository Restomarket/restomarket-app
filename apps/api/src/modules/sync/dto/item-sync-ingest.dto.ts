import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsDateString,
  MaxLength,
  Min,
  IsArray,
  ValidateNested,
  ArrayMaxSize,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ItemSyncPayloadDto {
  @ApiProperty({ description: 'SKU unique identifier for the item within the vendor' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  sku!: string;

  @ApiProperty({ description: 'Item name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({ description: 'Item description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'ERP unit code (will be mapped to RestoMarket unit)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  erpUnitCode!: string;

  @ApiProperty({ description: 'ERP VAT code (will be mapped to RestoMarket VAT)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  erpVatCode!: string;

  @ApiPropertyOptional({ description: 'ERP family code (optional mapping)' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  erpFamilyCode?: string;

  @ApiPropertyOptional({ description: 'ERP subfamily code (optional mapping)' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  erpSubfamilyCode?: string;

  @ApiPropertyOptional({ description: 'Unit price in minor currency units (cents)' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  unitPrice?: number;

  @ApiPropertyOptional({ description: 'Currency code (ISO 4217)', default: 'EUR' })
  @IsString()
  @IsOptional()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ description: 'Whether the item is active', default: true })
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

export class ItemSyncIngestDto {
  @ApiProperty({ description: 'Vendor ID from agent auth context' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  vendorId!: string;

  @ApiProperty({ description: 'Array of items to sync', type: [ItemSyncPayloadDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemSyncPayloadDto)
  @ArrayMaxSize(500, { message: 'Maximum 500 items per incremental sync request' })
  items!: ItemSyncPayloadDto[];
}

export class ItemSyncBatchIngestDto {
  @ApiProperty({ description: 'Vendor ID from agent auth context' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  vendorId!: string;

  @ApiProperty({ description: 'Array of items to sync (batch mode)', type: [ItemSyncPayloadDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemSyncPayloadDto)
  @ArrayMaxSize(5000, { message: 'Maximum 5000 items per batch sync request' })
  items!: ItemSyncPayloadDto[];
}
