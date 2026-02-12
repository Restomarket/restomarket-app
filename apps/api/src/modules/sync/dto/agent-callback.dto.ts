import { IsUUID, IsIn, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Agent callback DTO for reporting job completion or failure
 */
export class AgentCallbackDto {
  /**
   * Sync job ID that this callback is for
   */
  @ApiProperty({
    description: 'Sync job ID that this callback is for',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  jobId!: string;

  /**
   * Status of the job: completed or failed
   */
  @ApiProperty({
    description: 'Status of the job: completed or failed',
    enum: ['completed', 'failed'],
    example: 'completed',
  })
  @IsIn(['completed', 'failed'])
  status!: 'completed' | 'failed';

  /**
   * ERP reference for the order (only present if status is completed)
   */
  @ApiPropertyOptional({
    description: 'ERP reference for the order (only present if status is completed)',
    example: 'ERP-ORD-12345',
  })
  @IsOptional()
  @IsString()
  erpReference?: string;

  /**
   * Error message (only present if status is failed)
   */
  @ApiPropertyOptional({
    description: 'Error message (only present if status is failed)',
    example: 'Failed to create order in ERP system',
  })
  @IsOptional()
  @IsString()
  error?: string;

  /**
   * Additional metadata from the agent
   */
  @ApiPropertyOptional({
    description: 'Additional metadata from the agent',
    example: { erpOrderId: '12345', erpCustomerId: '67890' },
  })
  @IsOptional()
  metadata?: Record<string, unknown>;
}
