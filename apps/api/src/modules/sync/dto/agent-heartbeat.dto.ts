import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for agent heartbeat
 * Agents send periodic heartbeats to maintain online status
 */
export class AgentHeartbeatDto {
  @ApiProperty({
    description: 'Unique vendor identifier',
    example: 'vendor-123',
  })
  @IsString()
  @IsNotEmpty()
  vendorId!: string;

  @ApiPropertyOptional({
    description: 'Agent version (semantic versioning)',
    example: '1.0.0',
  })
  @IsOptional()
  @IsString()
  version?: string;
}
