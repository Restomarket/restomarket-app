/**
 * Database queries for Server Components
 * Use these functions directly in Server Components for optimal performance
 *
 * Differences from Server Actions:
 * - No 'use server' directive (runs in same context as component)
 * - Can use React cache() for request deduplication
 * - Better for read-only data fetching in layouts/pages
 */

import { cache } from 'react';
import { getUserRepository } from '../repositories/user.repository';
import type { User, UserQueryOptions, PaginatedResult, UserStatistics } from '@repo/shared';

/**
 * Get paginated users - optimized for Server Components
 * Uses React cache() for automatic request deduplication
 *
 * Usage in Server Component:
 * ```tsx
 * export default async function UsersPage() {
 *   const users = await getUsers({ page: 1, limit: 20 });
 *   return <UsersList users={users} />;
 * }
 * ```
 */
export const getUsers = cache(
  async (options?: UserQueryOptions): Promise<PaginatedResult<User>> => {
    const repo = getUserRepository();
    return await repo.findMany(options);
  },
);

/**
 * Get user by ID - optimized for Server Components
 * Uses React cache() for automatic request deduplication
 *
 * Usage in Server Component:
 * ```tsx
 * export default async function UserPage({ params }: { params: { id: string } }) {
 *   const user = await getUserById(params.id);
 *   if (!user) notFound();
 *   return <UserProfile user={user} />;
 * }
 * ```
 */
export const getUserById = cache(async (id: string): Promise<User | null> => {
  const repo = getUserRepository();
  return await repo.findById(id);
});

/**
 * Get user by email - optimized for Server Components
 * Uses React cache() for automatic request deduplication
 */
export const getUserByEmail = cache(async (email: string): Promise<User | null> => {
  const repo = getUserRepository();
  return await repo.findByEmail(email);
});

/**
 * Get user statistics - optimized for Server Components
 * Uses React cache() for automatic request deduplication
 *
 * Usage in Server Component:
 * ```tsx
 * export default async function DashboardPage() {
 *   const stats = await getUserStatistics();
 *   return <StatsDashboard stats={stats} />;
 * }
 * ```
 */
export const getUserStatistics = cache(async (): Promise<UserStatistics> => {
  const repo = getUserRepository();
  return await repo.getStatistics();
});

/**
 * Get active users count
 * Uses React cache() for automatic request deduplication
 */
export const getActiveUsersCount = cache(async (): Promise<number> => {
  const repo = getUserRepository();
  const result = await repo.findMany({ isActive: true, limit: 1, page: 1 });
  return result.meta.totalCount;
});

/**
 * Check if user exists
 * Uses React cache() for automatic request deduplication
 */
export const userExists = cache(async (id: string): Promise<boolean> => {
  const repo = getUserRepository();
  return await repo.exists(id);
});
