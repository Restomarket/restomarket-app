import type { User } from '../../../types/database.types.js';
import type { PaginationOptions } from '../../../types/pagination.types.js';

export type UserSortField = 'createdAt' | 'email' | 'firstName' | 'lastName';

export type UserFilterOptions = Partial<Pick<User, 'id' | 'email' | 'isActive'>> & {
  search?: string;
  emailDomain?: string;
  includeDeleted?: boolean;
};

export interface UserQueryOptions extends PaginationOptions<UserSortField> {
  isActive?: boolean;
  emailDomain?: string;
}

export interface UserStatistics {
  total: number;
  active: number;
  inactive: number;
  deleted: number;
}
