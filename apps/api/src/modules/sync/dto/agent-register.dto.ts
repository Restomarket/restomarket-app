import { IsString, IsNotEmpty, IsUrl, IsIn, IsOptional, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for agent registration
 * Agents self-register with their credentials and capabilities
 */
export class RegisterAgentDto {
  @ApiProperty({
    description: 'Unique vendor identifier',
    example: 'vendor-123',
  })
  @IsString()
  @IsNotEmpty()
  vendorId!: string;

  @ApiProperty({
    description: 'Agent callback URL',
    example: 'https://agent.vendor123.com',
  })
  @IsUrl()
  agentUrl!: string;

  @ApiProperty({
    description: 'ERP system type',
    enum: ['ebp', 'sage', 'odoo', 'custom'],
    example: 'ebp',
  })
  @IsIn(['ebp', 'sage', 'odoo', 'custom'])
  erpType!: string;

  @ApiProperty({
    description: 'Authentication token (minimum 16 characters)',
    example: 'super-secret-token-1234567890',
    minLength: 16,
  })
  @IsString()
  @MinLength(16)
  authToken!: string;

  @ApiPropertyOptional({
    description: 'Agent version (semantic versioning)',
    example: '1.0.0',
  })
  @IsOptional()
  @IsString()
  version?: string;
}
