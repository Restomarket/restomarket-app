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
  ArrayMinSize,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ItemSyncPayloadDto {
  // === Identity ===
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

  @ApiPropertyOptional({ description: 'EBP Item.Id (UniqueId Guid) - ERP internal identifier' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  erpId?: string;

  @ApiPropertyOptional({
    description: 'URL-friendly slug (auto-generated from name if not provided)',
  })
  @IsString()
  @IsOptional()
  @MaxLength(300)
  slug?: string;

  @ApiPropertyOptional({ description: 'Barcode (EAN/UPC)' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  barcode?: string;

  // === ERP Code Mappings ===
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

  // === Pricing ===
  @ApiPropertyOptional({ description: 'Unit price' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  unitPrice?: number;

  @ApiPropertyOptional({ description: 'Price excluding VAT' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  priceExclVat?: number;

  @ApiPropertyOptional({ description: 'Price including VAT' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  priceInclVat?: number;

  @ApiPropertyOptional({ description: 'VAT amount' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  vatAmount?: number;

  @ApiPropertyOptional({ description: 'ERP list price before customer discounts (catalog price)' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  catalogPrice?: number;

  @ApiPropertyOptional({ description: 'Cost price used for margin calculation (purchase price)' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  purchasePrice?: number;

  @ApiPropertyOptional({ description: 'Minimum order quantity (B2B MOQ)', default: 1 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  minimumOrderQuantity?: number;

  @ApiPropertyOptional({ description: 'Currency code (ISO 4217)', default: 'EUR' })
  @IsString()
  @IsOptional()
  @MaxLength(3)
  currency?: string;

  // === Stock Management Flags ===
  @ApiPropertyOptional({ description: 'Whether this item is tracked in inventory', default: true })
  @IsBoolean()
  @IsOptional()
  manageStock?: boolean;

  @ApiPropertyOptional({ description: 'Allow negative stock (overselling)', default: false })
  @IsBoolean()
  @IsOptional()
  allowNegativeStock?: boolean;

  @ApiPropertyOptional({ description: 'Stock reservation allowed', default: true })
  @IsBoolean()
  @IsOptional()
  stockBookingAllowed?: boolean;

  @ApiPropertyOptional({
    description: 'Automatically reserve stock on order placement',
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  automaticStockBooking?: boolean;

  @ApiPropertyOptional({ description: 'Tracking mode: 0=None, 1=Lot, 2=Serial', default: 0 })
  @IsNumber()
  @IsOptional()
  trackingMode?: number;

  @ApiPropertyOptional({ description: 'Prevent sales if item is fully reserved', default: false })
  @IsBoolean()
  @IsOptional()
  pickMovementDisallowedOnTotallyBookedItem?: boolean;

  // === Physical Attributes ===
  @ApiPropertyOptional({ description: 'Weight' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  weight?: number;

  @ApiPropertyOptional({ description: 'Weight unit (kg, g, lb)', default: 'kg' })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  weightUnit?: string;

  @ApiPropertyOptional({ description: 'Height' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  height?: number;

  @ApiPropertyOptional({ description: 'Width' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  width?: number;

  @ApiPropertyOptional({ description: 'Length' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  length?: number;

  @ApiPropertyOptional({ description: 'Dimension unit (cm, mm, in)', default: 'cm' })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  dimensionUnit?: string;

  @ApiPropertyOptional({ description: 'Items per package (EBP: NumberOfItemByPackage)' })
  @IsNumber()
  @IsOptional()
  itemsPerPackage?: number;

  // === E-Commerce Metadata (Oxatis) ===
  @ApiPropertyOptional({ description: 'SEO meta title' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  metaTitle?: string;

  @ApiPropertyOptional({ description: 'SEO meta description' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  metaDescription?: string;

  @ApiPropertyOptional({ description: 'SEO meta keywords' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  metaKeywords?: string;

  @ApiPropertyOptional({ description: 'Brand name' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  brand?: string;

  @ApiPropertyOptional({ description: 'Days to ship' })
  @IsNumber()
  @IsOptional()
  daysToShip?: number;

  @ApiPropertyOptional({ description: 'Shipping price TTC' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  shipPriceTtc?: number;

  @ApiPropertyOptional({ description: 'Origin country code (Intrastat)' })
  @IsString()
  @IsOptional()
  @MaxLength(10)
  originCountryCode?: string;

  // === Status ===
  @ApiPropertyOptional({ description: 'Whether the item is active', default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Whether item is published on web', default: true })
  @IsBoolean()
  @IsOptional()
  publishOnWeb?: boolean;

  // === Sync Metadata ===
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
  @ArrayMinSize(1, { message: 'At least 1 item is required' })
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
  @ArrayMinSize(1, { message: 'At least 1 item is required' })
  @ValidateNested({ each: true })
  @Type(() => ItemSyncPayloadDto)
  @ArrayMaxSize(5000, { message: 'Maximum 5000 items per batch sync request' })
  items!: ItemSyncPayloadDto[];
}
