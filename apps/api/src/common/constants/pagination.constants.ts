import { type SortOrder } from '@common/dto/sort-query.dto';

/**
 * Pagination constants - aligned with REST standards
 *
 * Note: Each repository/module should define its own default sort field
 */
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
  DEFAULT_SORT_ORDER: 'desc' as SortOrder,
} as const;

export type PaginationConstants = typeof PAGINATION;
