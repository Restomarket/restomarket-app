export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export interface PaginationMeta {
  limit: number;
  page: number;
  totalPages: number;
  totalCount: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
  executionTime?: number;
}

export interface PaginationOptions<TSortFields extends string = string> {
  limit?: number;
  page?: number;
  sortBy?: TSortFields;
  sortOrder?: SortOrder;
  search?: string;
  includeDeleted?: boolean;
}
