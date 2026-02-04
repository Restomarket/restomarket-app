import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { users, type NewUser, type User } from '@repo/shared';
import { BaseFactory } from './base.factory';
import type * as schema from '@repo/shared';

/**
 * User Factory for generating test users
 *
 * Usage:
 *   const factory = new UserFactory(db);
 *
 *   // Create with defaults
 *   const user = await factory.create();
 *
 *   // Create with custom data
 *   const admin = await factory.create({
 *     email: 'admin@example.com',
 *     firstName: 'Admin',
 *     isActive: true,
 *   });
 *
 *   // Create multiple users
 *   const users = await factory.createMany(10, { isActive: true });
 */
export class UserFactory extends BaseFactory<typeof users, NewUser, User> {
  private static sequenceCounter = 0;

  constructor(db: PostgresJsDatabase<typeof schema>) {
    super(db, users);
  }

  /**
   * Get default user attributes with unique values
   * Uses sequence counter to ensure unique emails
   */
  protected getDefaults(): Partial<NewUser> {
    const sequence = ++UserFactory.sequenceCounter;

    return {
      email: `user${sequence}@example.com`,
      firstName: `FirstName${sequence}`,
      lastName: `LastName${sequence}`,
      isActive: true,
    };
  }

  /**
   * Reset the sequence counter
   * Useful between test suites to ensure predictable data
   */
  static resetSequence(): void {
    UserFactory.sequenceCounter = 0;
  }

  /**
   * Create an active user (convenience method)
   */
  async createActive(overrides: Partial<NewUser> = {}): Promise<User> {
    return this.create({ ...overrides, isActive: true });
  }

  /**
   * Create an inactive user (convenience method)
   */
  async createInactive(overrides: Partial<NewUser> = {}): Promise<User> {
    return this.create({ ...overrides, isActive: false });
  }

  /**
   * Create a user with a specific email pattern
   */
  async createWithEmail(email: string, overrides: Partial<NewUser> = {}): Promise<User> {
    return this.create({ ...overrides, email });
  }
}
