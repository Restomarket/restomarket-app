import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsString } from 'class-validator';
import { PAGINATION } from '@common/constants';

/**
 * Sort order enum - Use lowercase for consistency with database queries
 */
export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

/**
 * Generic base sort query DTO
 * Can be extended for type-safe sort fields per resource
 *
 * @example
 * ```typescript
 * // In user-query.dto.ts
 * export class UserQueryDto extends ListQueryDto {
 *   @ApiPropertyOptional({
 *     enum: ['createdAt', 'email', 'firstName', 'lastName'],
 *     default: 'createdAt',
 *   })
 *   @IsEnum(['createdAt', 'email', 'firstName', 'lastName'])
 *   @IsOptional()
 *   declare sortBy?: 'createdAt' | 'email' | 'firstName' | 'lastName';
 * }
 * ```
 */
export class SortQueryDto {
  @ApiPropertyOptional({
    description: 'Field to sort by',
    example: 'createdAt',
  })
  @IsString()
  @IsOptional()
  sortBy?: string;

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: SortOrder,
    default: PAGINATION.DEFAULT_SORT_ORDER,
    example: SortOrder.DESC,
  })
  @IsEnum(SortOrder)
  @IsOptional()
  sortOrder?: SortOrder = PAGINATION.DEFAULT_SORT_ORDER;
}
