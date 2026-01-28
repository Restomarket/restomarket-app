import { IntersectionType } from '@nestjs/swagger';
import { PaginationQueryDto } from './pagination-query.dto';
import { SortQueryDto } from './sort-query.dto';
import { FilterQueryDto } from './filter-query.dto';

/**
 * Combined query DTO for list endpoints with pagination, sorting, and filtering
 */
export class ListQueryDto extends IntersectionType(
  PaginationQueryDto,
  SortQueryDto,
  FilterQueryDto,
) {}
