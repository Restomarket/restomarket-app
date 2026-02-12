import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  MaxLength,
  IsEmail,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OrderItemDto } from './order-item.dto';
import { AddressDto } from './address.dto';

export class CreateOrderDto {
  @ApiProperty({ example: 'vendor-uuid' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  vendorId!: string;

  @ApiPropertyOptional({ example: 'ORDER-2026-001' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  orderNumber?: string;

  @ApiPropertyOptional({ example: 'customer-uuid' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  customerId?: string;

  @ApiPropertyOptional({ example: 'customer@example.com' })
  @IsOptional()
  @IsEmail()
  customerEmail?: string;

  @ApiPropertyOptional({ example: '+33612345678' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  customerPhone?: string;

  @ApiPropertyOptional({ example: 'ERP-CUST-001' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  erpCustomerCode?: string;

  @ApiPropertyOptional({ type: AddressDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  billingAddress?: AddressDto;

  @ApiPropertyOptional({ type: AddressDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  shippingAddress?: AddressDto;

  @ApiPropertyOptional({ example: 'warehouse-uuid' })
  @IsOptional()
  @IsString()
  warehouseId?: string;

  @ApiPropertyOptional({ example: 'Notes for the customer' })
  @IsOptional()
  @IsString()
  customerNotes?: string;

  @ApiPropertyOptional({ example: 'Internal notes' })
  @IsOptional()
  @IsString()
  internalNotes?: string;

  @ApiProperty({ type: [OrderItemDto], description: 'Order line items' })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];
}
