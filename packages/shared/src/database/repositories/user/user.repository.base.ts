import { and, count, desc, eq, ilike, inArray, isNull, or, sql, type SQL, asc } from 'drizzle-orm';
import { BaseRepository } from '../base/base.repository.js';
import { authUsers as users } from '../../schema/index.js';
import type { User, NewUser } from '../../../types/database.types.js';
import type { PaginatedResult } from '../../../types/pagination.types.js';
import { SortOrder } from '../../../types/pagination.types.js';
import { createPaginatedResult } from '../../../utils/pagination.js';
import type {
  UserQueryOptions,
  UserFilterOptions,
  UserStatistics,
} from './user.repository.types.js';

/**
 * User Repository Base with Drizzle-native implementation
 *
 * Framework-agnostic repository containing all business logic for user operations.
 * No NestJS dependencies - pure database layer.
 */
export class UserRepositoryBase extends BaseRepository<typeof users> {
  /**
   * Prepared statements for frequently executed queries
   * Improves performance by ~50% for hot paths
   */
  private readonly preparedStatements = {
    findById: this.db
      .select()
      .from(users)
      .where(and(eq(users.id, sql.placeholder('id')), isNull(users.deletedAt)))
      .limit(1)
      .prepare('find_user_by_id'),

    findByIdWithDeleted: this.db
      .select()
      .from(users)
      .where(eq(users.id, sql.placeholder('id')))
      .limit(1)
      .prepare('find_user_by_id_with_deleted'),

    findByEmail: this.db
      .select()
      .from(users)
      .where(and(eq(users.email, sql.placeholder('email')), isNull(users.deletedAt)))
      .limit(1)
      .prepare('find_user_by_email'),

    findByEmailWithDeleted: this.db
      .select()
      .from(users)
      .where(eq(users.email, sql.placeholder('email')))
      .limit(1)
      .prepare('find_user_by_email_with_deleted'),
  };

  /**
   * Build WHERE conditions for user queries
   * Consolidates filter logic to prevent inconsistencies between count and data queries
   */
  private buildUserFilters(options: UserFilterOptions): SQL<unknown> | undefined {
    const conditions: SQL<unknown>[] = [];

    if (options.id) {
      conditions.push(eq(users.id, options.id));
    }

    if (options.email) {
      conditions.push(eq(users.email, options.email));
    }

    if (!options.includeDeleted) {
      conditions.push(isNull(users.deletedAt));
    }

    if (options.isActive !== undefined) {
      conditions.push(eq(users.isActive, options.isActive));
    }

    if (options.search) {
      // Escape special chars for ILIKE to prevent SQL injection
      const searchPattern = `%${options.search.replace(/[%_\\]/g, '\\$&')}%`;
      conditions.push(
        or(
          ilike(users.email, searchPattern),
          ilike(users.firstName, searchPattern),
          ilike(users.lastName, searchPattern),
        )!,
      );
    }

    if (options.emailDomain) {
      // Escape special chars in email domain
      const escapedDomain = options.emailDomain.replace(/[%_\\]/g, '\\$&');
      conditions.push(ilike(users.email, `%@${escapedDomain}`));
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  /**
   * Find user by ID (excludes soft-deleted by default)
   * Uses prepared statements for better performance
   */
  async findById(id: string, includeDeleted = false): Promise<User | null> {
    try {
      const statement = includeDeleted
        ? this.preparedStatements.findByIdWithDeleted
        : this.preparedStatements.findById;

      const [user] = await statement.execute({ id });
      return user ?? null;
    } catch (error) {
      this.handleError('FIND_BY_ID', error, { id });
      return null;
    }
  }

  /**
   * Create a new user
   * Returns null on error instead of throwing
   */
  async create(data: NewUser): Promise<User | null> {
    try {
      const [user] = await this.db.insert(users).values(data).returning();

      if (!user) {
        this.logger.error('Failed to create user - no row returned', { email: data.email });
        return null;
      }

      this.logger.info('User created successfully', { userId: user.id });
      return user;
    } catch (error) {
      this.handleError('CREATE', error, { email: data.email });
      return null;
    }
  }

  /**
   * Update user by ID
   * Returns null if user not found
   */
  async update(id: string, data: Partial<NewUser>): Promise<User | null> {
    try {
      const [user] = await this.db
        .update(users)
        .set({
          ...data,
          updatedAt: this.getUpdatedTimestamp(),
        })
        .where(and(eq(users.id, id), isNull(users.deletedAt)))
        .returning();

      if (!user) {
        this.logger.warn('User not found for update', { id });
        return null;
      }

      this.logger.info('User updated successfully', { userId: id });
      return user;
    } catch (error) {
      this.handleError('UPDATE', error, { id });
      return null;
    }
  }

  /**
   * Update user with optimistic locking using updatedAt timestamp
   * Prevents concurrent modifications by checking if updatedAt hasn't changed
   *
   * @param id - User ID
   * @param data - Data to update
   * @param expectedUpdatedAt - Expected current updatedAt timestamp
   * @returns Updated user or null if timestamp mismatch or not found
   */
  async updateWithTimestamp(
    id: string,
    data: Partial<NewUser>,
    expectedUpdatedAt: Date,
  ): Promise<User | null> {
    try {
      const [user] = await this.db
        .update(users)
        .set({
          ...data,
          updatedAt: sql`now()`,
        })
        .where(
          and(eq(users.id, id), eq(users.updatedAt, expectedUpdatedAt), isNull(users.deletedAt)),
        )
        .returning();

      if (!user) {
        // Check if user exists
        const existingUser = await this.findById(id);
        if (!existingUser) {
          this.logger.warn('User not found for optimistic update', { id });
          return null;
        }

        // User exists but updatedAt mismatch - concurrent modification
        this.logger.warn('Optimistic lock failed - concurrent modification detected', {
          userId: id,
          expectedUpdatedAt: expectedUpdatedAt.toISOString(),
          actualUpdatedAt: existingUser.updatedAt.toISOString(),
        });
        return null;
      }

      this.logger.info('User updated with timestamp check', {
        userId: id,
        updatedAt: user.updatedAt,
      });
      return user;
    } catch (error) {
      this.handleError('UPDATE_WITH_TIMESTAMP', error, { id });
      return null;
    }
  }

  /**
   * Soft delete user by ID
   */
  async softDelete(id: string): Promise<boolean> {
    try {
      const [user] = await this.db
        .update(users)
        .set({
          deletedAt: sql`now()`,
          updatedAt: sql`now()`,
        })
        .where(and(eq(users.id, id), isNull(users.deletedAt)))
        .returning();

      if (!user) {
        return false;
      }

      this.logger.info('User soft deleted successfully', { userId: id });
      return true;
    } catch (error) {
      this.handleError('SOFT_DELETE', error, { id });
      return false;
    }
  }

  /**
   * Restore soft-deleted user
   * Returns null if user not found or not deleted
   */
  async restore(id: string): Promise<User | null> {
    try {
      const [user] = await this.db
        .update(users)
        .set({
          deletedAt: null,
          updatedAt: sql`now()`,
        })
        .where(and(eq(users.id, id), sql`${users.deletedAt} IS NOT NULL`))
        .returning();

      if (!user) {
        this.logger.warn('Deleted user not found for restore', { id });
        return null;
      }

      this.logger.info('User restored successfully', { userId: id });
      return user;
    } catch (error) {
      this.handleError('RESTORE', error, { id });
      return null;
    }
  }

  /**
   * Check if user exists by ID
   */
  async exists(id: string, includeDeleted = false): Promise<boolean> {
    const user = await this.findById(id, includeDeleted);
    return user !== null;
  }

  /**
   * Unified findMany method with flexible filtering and pagination
   * Uses efficient window function for count on first page
   */
  async findMany(options: UserQueryOptions = {}): Promise<PaginatedResult<User>> {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        includeDeleted = false,
        isActive,
        emailDomain,
        sortBy = 'createdAt',
        sortOrder = SortOrder.DESC,
      } = options;

      // Build WHERE conditions using shared helper
      const whereClause = this.buildUserFilters({
        isActive,
        search,
        emailDomain,
        includeDeleted,
      });

      // Type-safe sort column with proper order
      const sortColumn = users[sortBy];
      const orderClause = sortOrder === SortOrder.ASC ? asc(sortColumn) : desc(sortColumn);

      // Optimization: Use window function for first page to get count in single query
      if (page === 1) {
        const results = await this.db
          .select({
            id: users.id,
            email: users.email,
            firstName: users.firstName,
            lastName: users.lastName,
            isActive: users.isActive,
            createdAt: users.createdAt,
            updatedAt: users.updatedAt,
            deletedAt: users.deletedAt,
            totalCount: sql<number>`count(*) over()`.as('total_count'),
          })
          .from(users)
          .where(whereClause)
          .limit(limit)
          .orderBy(orderClause);

        const totalCount = results[0]?.totalCount ?? 0;
        // Properly coerce count to number (postgres-js returns bigint strings)
        const total = Number(totalCount);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const data = results.map(({ totalCount: _, ...user }) => user as User);

        return createPaginatedResult(data, total, { page, limit });
      }

      // For subsequent pages, use separate count query
      const [data, countResult] = await Promise.all([
        this.db
          .select()
          .from(users)
          .where(whereClause)
          .limit(limit)
          .offset((page - 1) * limit)
          .orderBy(orderClause),

        this.db.select({ value: count() }).from(users).where(whereClause),
      ]);

      const totalCount = countResult[0]?.value;
      // Properly coerce count to number (postgres-js returns bigint strings)
      const total = Number(totalCount ?? 0);

      return createPaginatedResult(data, total, { page, limit });
    } catch (error) {
      this.handleError('FIND_MANY', error, { options });
      return createPaginatedResult([], 0, { page: options.page ?? 1, limit: options.limit ?? 10 });
    }
  }

  /**
   * Find user by email (excludes soft-deleted by default)
   * Uses prepared statements for better performance
   */
  async findByEmail(email: string, includeDeleted = false): Promise<User | null> {
    try {
      const statement = includeDeleted
        ? this.preparedStatements.findByEmailWithDeleted
        : this.preparedStatements.findByEmail;

      const [user] = await statement.execute({ email });
      return user ?? null;
    } catch (error) {
      this.handleError('FIND_BY_EMAIL', error, { email });
      return null;
    }
  }

  /**
   * Create multiple users in a single query (bulk insert)
   */
  async createMany(dataArray: NewUser[]): Promise<User[]> {
    try {
      const createdUsers = await this.db.insert(users).values(dataArray).returning();

      this.logger.info('Users created in bulk', { count: createdUsers.length });
      return createdUsers;
    } catch (error) {
      this.handleError('CREATE_MANY', error, { count: dataArray.length });
      return [];
    }
  }

  /**
   * Update multiple users in a single query (bulk update)
   */
  async updateMany(ids: string[], data: Partial<NewUser>): Promise<User[]> {
    try {
      const updatedUsers = await this.db
        .update(users)
        .set({
          ...data,
          updatedAt: this.getUpdatedTimestamp(),
        })
        .where(and(inArray(users.id, ids), isNull(users.deletedAt)))
        .returning();

      this.logger.info('Users updated in bulk', { count: updatedUsers.length });
      return updatedUsers;
    } catch (error) {
      this.handleError('UPDATE_MANY', error, { count: ids.length });
      return [];
    }
  }

  /**
   * Soft delete multiple users in a single query (bulk soft delete)
   */
  async softDeleteMany(ids: string[]): Promise<number> {
    try {
      const result = await this.db
        .update(users)
        .set({
          deletedAt: sql`now()`,
          updatedAt: sql`now()`,
        })
        .where(and(inArray(users.id, ids), isNull(users.deletedAt)))
        .returning({ id: users.id });

      this.logger.info('Users soft deleted in bulk', { count: result.length });
      return result.length;
    } catch (error) {
      this.handleError('SOFT_DELETE_MANY', error, { count: ids.length });
      return 0;
    }
  }

  /**
   * Get user statistics
   */
  async getStatistics(): Promise<UserStatistics> {
    try {
      const [result] = await this.db
        .select({
          total: count(),
          active: sql<number>`count(*) filter (where ${users.isActive} = true and ${users.deletedAt} IS NULL)`,
          inactive: sql<number>`count(*) filter (where ${users.isActive} = false and ${users.deletedAt} IS NULL)`,
          deleted: sql<number>`count(*) filter (where ${users.deletedAt} IS NOT NULL)`,
        })
        .from(users);

      if (!result) {
        return { total: 0, active: 0, inactive: 0, deleted: 0 };
      }

      return {
        total: Number(result.total),
        active: Number(result.active),
        inactive: Number(result.inactive),
        deleted: Number(result.deleted),
      };
    } catch (error) {
      this.handleError('GET_STATISTICS', error);
      return { total: 0, active: 0, inactive: 0, deleted: 0 };
    }
  }

  /**
   * Count users (excludes soft-deleted by default)
   */
  async count(includeDeleted = false): Promise<number> {
    try {
      const whereClause = this.buildUserFilters({ includeDeleted });

      const [result] = await this.db.select({ value: count() }).from(users).where(whereClause);

      return Number(result?.value ?? 0);
    } catch (error) {
      this.handleError('COUNT', error);
      return 0;
    }
  }
}
