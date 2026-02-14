/**
 * Reconciliation DTOs
 */

import { IsOptional, IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for triggering manual reconciliation
 */
export class TriggerReconciliationDto {
  @ApiProperty({
    description: 'Vendor ID to reconcile (optional - if omitted, reconcile all active vendors)',
    example: 'vendor123',
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  vendorId?: string;
}

/**
 * Query DTO for reconciliation events list
 */
export class ReconciliationEventsQueryDto {
  @ApiProperty({
    description: 'Filter by vendor ID',
    example: 'vendor123',
    required: false,
  })
  @IsOptional()
  @IsString()
  vendorId?: string;

  @ApiProperty({
    description: 'Page number for pagination',
    example: 1,
    required: false,
    default: 1,
  })
  @IsOptional()
  page?: number;

  @ApiProperty({
    description: 'Items per page',
    example: 50,
    required: false,
    default: 50,
  })
  @IsOptional()
  limit?: number;
}
