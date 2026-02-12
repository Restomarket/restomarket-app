import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsDateString,
  MaxLength,
  Min,
  IsArray,
  ValidateNested,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class StockSyncPayloadDto {
  @ApiProperty({ description: 'Item SKU' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  itemSku!: string;

  @ApiProperty({ description: 'ERP warehouse ID' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  erpWarehouseId!: string;

  @ApiProperty({ description: 'Total quantity in stock' })
  @IsNumber()
  @Min(0)
  quantity!: number;

  @ApiProperty({ description: 'Reserved quantity (e.g., for pending orders)' })
  @IsNumber()
  @Min(0)
  reservedQuantity!: number;

  @ApiProperty({ description: 'Available quantity (quantity - reservedQuantity)' })
  @IsNumber()
  @Min(0)
  availableQuantity!: number;

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

export class StockSyncIngestDto {
  @ApiProperty({ description: 'Vendor ID from agent auth context' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  vendorId!: string;

  @ApiProperty({ description: 'Array of stock records to sync', type: [StockSyncPayloadDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StockSyncPayloadDto)
  @ArrayMaxSize(500, { message: 'Maximum 500 stock records per incremental sync request' })
  stock!: StockSyncPayloadDto[];
}

export class StockSyncBatchIngestDto {
  @ApiProperty({ description: 'Vendor ID from agent auth context' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  vendorId!: string;

  @ApiProperty({
    description: 'Array of stock records to sync (batch mode)',
    type: [StockSyncPayloadDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StockSyncPayloadDto)
  @ArrayMaxSize(5000, { message: 'Maximum 5000 stock records per batch sync request' })
  stock!: StockSyncPayloadDto[];
}
