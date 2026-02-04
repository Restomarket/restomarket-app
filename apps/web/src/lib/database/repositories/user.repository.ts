import { UserRepositoryBase, users } from '@repo/shared';
import { getDatabase } from '../connection';

/**
 * Get user repository instance for Next.js
 * Use in Server Components and Server Actions
 */
export function getUserRepository(): UserRepositoryBase {
  const db = getDatabase();
  return new UserRepositoryBase(db, users);
}
