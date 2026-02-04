import type {
  PaginatedResult,
  PaginationMeta,
  PaginationOptions,
} from '../types/pagination.types.js';

export function createPaginatedResult<T>(
  data: T[],
  totalCount: number,
  options: Pick<PaginationOptions, 'page' | 'limit'>,
): PaginatedResult<T> {
  const { page = 1, limit = 10 } = options;
  const totalPages = Math.max(Math.ceil(totalCount / limit), 1);

  const meta: PaginationMeta = {
    limit,
    page,
    totalPages,
    totalCount,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };

  return { data, meta };
}
