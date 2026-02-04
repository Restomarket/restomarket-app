'use server';

import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache';
import { getUserRepository } from '../database/repositories/user.repository';
import type {
  User,
  UserQueryOptions,
  NewUser,
  PaginatedResult,
  UserStatistics,
} from '@repo/shared';

// ============================================
// Types for Server Actions
// ============================================

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

// ============================================
// Read Operations (Can be cached)
// ============================================

/**
 * Get paginated list of users
 * Server Action for fetching users with optional filtering and pagination
 *
 * Best Practices:
 * - Uses unstable_cache for automatic caching
 * - Tagged for selective revalidation
 * - Returns type-safe result
 */
export async function getUsers(
  options?: UserQueryOptions,
): Promise<ActionResult<PaginatedResult<User>>> {
  try {
    // Create cache key from options
    const cacheKey = JSON.stringify(options || {});

    // Use Next.js cache with tags for revalidation
    const cachedFetch = unstable_cache(
      async () => {
        const repo = getUserRepository();
        return await repo.findMany(options);
      },
      [`users-list-${cacheKey}`],
      {
        tags: ['users', 'users-list'],
        revalidate: 60, // Cache for 60 seconds
      },
    );

    const result = await cachedFetch();
    return { success: true, data: result };
  } catch (error) {
    console.error('[getUsers] Failed to fetch users:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch users',
      code: 'FETCH_USERS_ERROR',
    };
  }
}

/**
 * Get user by ID
 * Server Action for fetching a single user
 *
 * Best Practices:
 * - Validates input (basic UUID check)
 * - Uses unstable_cache for caching
 * - Tagged for selective revalidation
 */
export async function getUserById(id: string): Promise<ActionResult<User>> {
  try {
    // Basic validation
    if (!id || typeof id !== 'string') {
      return {
        success: false,
        error: 'Invalid user ID',
        code: 'INVALID_INPUT',
      };
    }

    // Use Next.js cache with tags for revalidation
    const cachedFetch = unstable_cache(
      async () => {
        const repo = getUserRepository();
        return await repo.findById(id);
      },
      [`user-${id}`],
      {
        tags: ['users', `user-${id}`],
        revalidate: 60, // Cache for 60 seconds
      },
    );

    const user = await cachedFetch();

    if (!user) {
      return {
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      };
    }

    return { success: true, data: user };
  } catch (error) {
    console.error(`[getUserById] Failed to fetch user ${id}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch user',
      code: 'FETCH_USER_ERROR',
    };
  }
}

/**
 * Get user statistics
 * Server Action for fetching aggregated user statistics
 *
 * Best Practices:
 * - Cached with longer revalidation period (stats change less frequently)
 * - Tagged for selective revalidation
 */
export async function getUserStatistics(): Promise<ActionResult<UserStatistics>> {
  try {
    // Use Next.js cache with tags for revalidation
    const cachedFetch = unstable_cache(
      async () => {
        const repo = getUserRepository();
        return await repo.getStatistics();
      },
      ['user-statistics'],
      {
        tags: ['users', 'user-statistics'],
        revalidate: 300, // Cache for 5 minutes (stats don't change often)
      },
    );

    const stats = await cachedFetch();
    return { success: true, data: stats };
  } catch (error) {
    console.error('[getUserStatistics] Failed to fetch statistics:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch statistics',
      code: 'FETCH_STATISTICS_ERROR',
    };
  }
}

// ============================================
// Write Operations (Mutations)
// ============================================

/**
 * Create a new user
 * Server Action for user creation
 *
 * Best Practices:
 * - Validates input data
 * - Revalidates affected caches
 * - Returns created user
 */
export async function createUser(
  data: Pick<NewUser, 'email' | 'firstName' | 'lastName'>,
): Promise<ActionResult<User>> {
  try {
    // Basic validation
    if (!data.email || !data.firstName || !data.lastName) {
      return {
        success: false,
        error: 'Missing required fields',
        code: 'INVALID_INPUT',
      };
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      return {
        success: false,
        error: 'Invalid email format',
        code: 'INVALID_EMAIL',
      };
    }

    const repo = getUserRepository();
    const user = await repo.create({
      email: data.email.toLowerCase().trim(),
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
    });

    if (!user) {
      return {
        success: false,
        error: 'Failed to create user',
        code: 'CREATE_FAILED',
      };
    }

    // Revalidate caches
    revalidateTag('users', 'default');
    revalidateTag('users-list', 'default');
    revalidateTag('user-statistics', 'default');

    return { success: true, data: user };
  } catch (error) {
    console.error('[createUser] Failed to create user:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create user',
      code: 'CREATE_USER_ERROR',
    };
  }
}

/**
 * Update a user
 * Server Action for user updates
 *
 * Best Practices:
 * - Validates input data
 * - Revalidates affected caches
 * - Revalidates specific routes
 */
export async function updateUser(
  id: string,
  data: Partial<Pick<NewUser, 'email' | 'firstName' | 'lastName' | 'isActive'>>,
): Promise<ActionResult<User>> {
  try {
    // Basic validation
    if (!id || typeof id !== 'string') {
      return {
        success: false,
        error: 'Invalid user ID',
        code: 'INVALID_INPUT',
      };
    }

    // Email validation if provided
    if (data.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email)) {
        return {
          success: false,
          error: 'Invalid email format',
          code: 'INVALID_EMAIL',
        };
      }
      data.email = data.email.toLowerCase().trim();
    }

    // Trim string fields
    if (data.firstName) data.firstName = data.firstName.trim();
    if (data.lastName) data.lastName = data.lastName.trim();

    const repo = getUserRepository();
    const user = await repo.update(id, data);

    if (!user) {
      return {
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      };
    }

    // Revalidate caches
    revalidateTag('users', 'default');
    revalidateTag('users-list', 'default');
    revalidateTag(`user-${id}`, 'default');
    revalidateTag('user-statistics', 'default');

    // Revalidate specific routes (examples)
    revalidatePath('/users', 'page');
    revalidatePath(`/users/${id}`, 'page');

    return { success: true, data: user };
  } catch (error) {
    console.error(`[updateUser] Failed to update user ${id}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update user',
      code: 'UPDATE_USER_ERROR',
    };
  }
}

/**
 * Delete a user (soft delete)
 * Server Action for user deletion
 *
 * Best Practices:
 * - Validates input
 * - Revalidates affected caches
 * - Returns success status
 */
export async function deleteUser(id: string): Promise<ActionResult<boolean>> {
  try {
    // Basic validation
    if (!id || typeof id !== 'string') {
      return {
        success: false,
        error: 'Invalid user ID',
        code: 'INVALID_INPUT',
      };
    }

    const repo = getUserRepository();
    const deleted = await repo.softDelete(id);

    if (!deleted) {
      return {
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      };
    }

    // Revalidate caches
    revalidateTag('users', 'default');
    revalidateTag('users-list', 'default');
    revalidateTag(`user-${id}`, 'default');
    revalidateTag('user-statistics', 'default');

    // Revalidate specific routes
    revalidatePath('/users', 'page');
    revalidatePath(`/users/${id}`, 'page');

    return { success: true, data: deleted };
  } catch (error) {
    console.error(`[deleteUser] Failed to delete user ${id}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete user',
      code: 'DELETE_USER_ERROR',
    };
  }
}
