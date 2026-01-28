import { type SortOrder } from '@common/dto/sort-query.dto';

/**
 * Pagination metadata - consolidated single source of truth
 */
export interface IPaginationMeta {
  limit: number;
  page: number;
  totalPages: number;
  totalCount: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Pagination links for HATEOAS (optional - advanced use case)
 */
export interface IPaginationLinks {
  self: string;
  first: string;
  last: string;
  next?: string;
  prev?: string;
}

/**
 * Paginated result with data and metadata (core interface)
 */
export interface IPaginatedResult<T> {
  data: T[];
  meta: IPaginationMeta;
  links?: IPaginationLinks;
  executionTime?: number;
}

/**
 * Pagination options for queries (used internally in repositories)
 *
 * Generic interface with type-safe sort fields:
 * - TSortFields constrains sortBy to specific table columns
 * - Default is string for flexibility
 * - Repositories can define their own type-safe sort fields
 *
 * @example
 * ```typescript
 * // Type-safe sort fields for users
 * type UserSortField = 'createdAt' | 'email' | 'firstName' | 'lastName';
 *
 * // Use in repository
 * async findMany(options: IPaginationOptions<UserSortField> = {}) {
 *   const { sortBy = 'createdAt', sortOrder = 'desc' } = options;
 *   // TypeScript ensures sortBy is one of: 'createdAt' | 'email' | 'firstName' | 'lastName'
 * }
 * ```
 */
export interface IPaginationOptions<TSortFields extends string = string> {
  limit?: number;
  page?: number;
  sortBy?: TSortFields;
  sortOrder?: SortOrder;
  search?: string;
  includeDeleted?: boolean;
}
