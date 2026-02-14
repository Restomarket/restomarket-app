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
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ValidateStockConsistency } from '../validators/stock-consistency.validator';

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

  @ApiProperty({ description: 'Physical stock on hand (RealStock from ERP)' })
  @IsNumber()
  @Min(0)
  realStock!: number;

  @ApiProperty({
    description: 'Available stock for sale (VirtualStock = realStock - reservedQuantity)',
  })
  @IsNumber()
  @Min(0)
  @ValidateStockConsistency()
  virtualStock!: number;

  @ApiProperty({ description: 'Reserved quantity (allocated for existing orders)' })
  @IsNumber()
  @Min(0)
  reservedQuantity!: number;

  @ApiPropertyOptional({ description: 'Ordered quantity (committed but not yet fulfilled)' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  orderedQuantity?: number;

  @ApiPropertyOptional({
    description: 'Qty on open supplier purchase orders (EBP: CommandesFournisseurs)',
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  incomingQuantity?: number;

  @ApiPropertyOptional({ description: 'Weighted average unit cost (PUMP)' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  pump?: number;

  @ApiPropertyOptional({ description: 'Total stock value (realStock × pump)' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  stockValue?: number;

  @ApiPropertyOptional({ description: 'Minimum stock level (reorder point)' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  minStock?: number;

  @ApiPropertyOptional({ description: 'Maximum stock level' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  maxStock?: number;

  @ApiPropertyOptional({ description: 'Reorder threshold' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  stockToOrderThreshold?: number;

  @ApiPropertyOptional({ description: 'Sync source identifier (e.g., "EBP", "Manual Adjustment")' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  lastSyncedFrom?: string;

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
