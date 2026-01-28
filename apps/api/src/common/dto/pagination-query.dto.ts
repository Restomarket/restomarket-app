import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { PAGINATION } from '@common/constants';

export class PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Page number',
    minimum: 1,
    default: PAGINATION.DEFAULT_PAGE,
    example: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = PAGINATION.DEFAULT_PAGE;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    minimum: 1,
    maximum: PAGINATION.MAX_LIMIT,
    default: PAGINATION.DEFAULT_LIMIT,
    example: 10,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PAGINATION.MAX_LIMIT)
  @IsOptional()
  limit?: number = PAGINATION.DEFAULT_LIMIT;

  get offset(): number {
    const safePage = this.page ?? PAGINATION.DEFAULT_PAGE;
    const safeLimit = this.limit ?? PAGINATION.DEFAULT_LIMIT;
    return (safePage - 1) * safeLimit;
  }
}
