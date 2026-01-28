import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { ListQueryDto } from '@common/dto';

/**
 * Transform string 'true'/'false' to boolean
 * Handles query parameters that come as strings from HTTP requests
 */
function transformToBoolean({ value }: { value: unknown }): boolean | undefined {
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  if (typeof value === 'boolean') return value;
  return undefined;
}

/**
 * User-specific query DTO for list endpoints
 * Extends ListQueryDto (pagination, sorting, filtering) with user-specific filters
 *
 * Usage in controller:
 * ```typescript
 * @Get()
 * async findAll(@Query() query: UserQueryDto) {
 *   return this.usersService.findAll(query);
 * }
 * ```
 */
export class UserQueryDto extends ListQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by active status',
    example: true,
  })
  @IsBoolean()
  @Transform(transformToBoolean)
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by email domain (e.g., example.com)',
    example: 'example.com',
  })
  @IsString()
  @IsOptional()
  emailDomain?: string;

  // Override sortBy with user-specific fields for type safety
  @ApiPropertyOptional({
    description: 'Field to sort by',
    enum: ['createdAt', 'email', 'firstName', 'lastName'],
    default: 'createdAt',
    example: 'createdAt',
  })
  @IsEnum(['createdAt', 'email', 'firstName', 'lastName'])
  @IsOptional()
  declare sortBy?: 'createdAt' | 'email' | 'firstName' | 'lastName';
}
