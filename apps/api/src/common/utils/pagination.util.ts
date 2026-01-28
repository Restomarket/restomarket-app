import {
  type IPaginationMeta,
  type IPaginationLinks,
  type IPaginatedResult,
} from '@shared/interfaces';
import { PAGINATION } from '@common/constants';

/**
 * Clamp a value between min and max
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Create a complete paginated result with metadata and optional HATEOAS links
 * This is the main utility function for pagination - use this for all paginated responses
 *
 * @param data - Array of data items
 * @param totalCount - Total number of items (for calculating pages) - can be number or bigint string
 * @param options - Pagination options
 * @param options.page - Current page number (1-indexed)
 * @param options.limit - Number of items per page
 * @param options.baseUrl - Optional base URL for generating HATEOAS links
 * @param options.queryParams - Optional additional query parameters (sortBy, search, etc.)
 * @param options.executionTime - Optional query execution time in milliseconds
 * @returns Complete paginated result with data, meta, links, and execution time
 *
 * @example
 * ```typescript
 * // Simple pagination
 * const result = createPaginatedResult(users, 150, {
 *   page: 1,
 *   limit: 10
 * });
 *
 * // With HATEOAS links and query params
 * const result = createPaginatedResult(users, 150, {
 *   page: 2,
 *   limit: 20,
 *   baseUrl: '/api/users',
 *   queryParams: { sortBy: 'createdAt', sortOrder: 'desc', search: 'john' }
 * });
 * ```
 */
export function createPaginatedResult<T>(
  data: T[],
  totalCount: number | string | bigint,
  options: {
    page: number;
    limit: number;
    baseUrl?: string;
    queryParams?: Record<string, string | number | boolean | undefined>;
    executionTime?: number;
  },
): IPaginatedResult<T> {
  const { page, limit, baseUrl, queryParams, executionTime } = options;

  // Safely coerce totalCount to number (handles bigint strings from postgres-js)
  const total = typeof totalCount === 'number' ? totalCount : Number(totalCount);

  // Clamp page and limit to safe values
  const safeLimit = clamp(limit, 1, PAGINATION.MAX_LIMIT);
  const totalPages = Math.max(Math.ceil(total / safeLimit), 1);
  const safePage = clamp(page, 1, totalPages);

  const meta: IPaginationMeta = {
    limit: safeLimit,
    page: safePage,
    totalPages,
    totalCount: total,
    hasNextPage: safePage < totalPages,
    hasPreviousPage: safePage > 1,
  };

  // Build HATEOAS links if baseUrl is provided
  const links = baseUrl ? buildPaginationLinks(baseUrl, meta, safeLimit, queryParams) : undefined;

  return {
    data,
    meta,
    links,
    executionTime,
  };
}

/**
 * Build pagination links for HATEOAS REST API best practices
 *
 * Generates self, first, last, next, and prev links with all query parameters preserved
 *
 * @param baseUrl - Base URL for the resource (e.g., '/api/users')
 * @param meta - Pagination metadata
 * @param limit - Number of items per page
 * @param queryParams - Additional query parameters to include (sortBy, search, filters, etc.)
 * @returns Object containing self, first, last, next, and prev links
 *
 * @example
 * ```typescript
 * const links = buildPaginationLinks('/api/users', meta, 10, {
 *   sortBy: 'createdAt',
 *   sortOrder: 'desc',
 *   search: 'john'
 * });
 * ```
 */
export function buildPaginationLinks(
  baseUrl: string,
  meta: IPaginationMeta,
  limit: number,
  queryParams?: Record<string, string | number | boolean | undefined>,
): IPaginationLinks {
  const buildUrl = (page: number): string => {
    const params = new URLSearchParams({
      limit: String(limit),
      page: String(page),
    });

    // Add additional query parameters (sortBy, search, filters, etc.)
    if (queryParams) {
      Object.entries(queryParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, String(value));
        }
      });
    }

    return `${baseUrl}?${params.toString()}`;
  };

  return {
    self: buildUrl(meta.page),
    first: buildUrl(1),
    last: buildUrl(meta.totalPages),
    next: meta.hasNextPage ? buildUrl(meta.page + 1) : undefined,
    prev: meta.hasPreviousPage ? buildUrl(meta.page - 1) : undefined,
  };
}
