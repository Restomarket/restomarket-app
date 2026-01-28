import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class FilterQueryDto {
  @ApiPropertyOptional({
    description: 'Search term to filter results',
    example: 'john',
  })
  @IsString()
  @IsOptional()
  search?: string;
}
