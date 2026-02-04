import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import {
  UserRepositoryBase,
  users,
  type User,
  type NewUser,
  type DatabaseConnection,
  type ILogger,
} from '@repo/shared';
import { DATABASE_CONNECTION } from '../database.module';
import { DatabaseException } from '@common/exceptions/database.exception';
import { BusinessException } from '@common/exceptions/business.exception';

/**
 * NestJS adapter for UserRepositoryBase
 * Wraps the framework-agnostic repository with NestJS-specific functionality
 */
@Injectable()
export class UserRepository extends UserRepositoryBase {
  constructor(@Inject(DATABASE_CONNECTION) db: DatabaseConnection, pinoLogger: PinoLogger) {
    // Adapt PinoLogger to ILogger interface
    const logger: ILogger = {
      info: (msg, ctx) => pinoLogger.info(ctx ?? {}, msg),
      error: (msg, ctx) => pinoLogger.error(ctx ?? {}, msg),
      warn: (msg, ctx) => pinoLogger.warn(ctx ?? {}, msg),
      debug: (msg, ctx) => pinoLogger.debug(ctx ?? {}, msg),
    };

    super(db, users, logger);
    pinoLogger.setContext(UserRepository.name);
  }

  /**
   * Override findById to throw NestJS NotFoundException when needed
   */
  override async findById(id: string, includeDeleted = false): Promise<User | null> {
    try {
      return await super.findById(id, includeDeleted);
    } catch (error) {
      const dbError = this.handleError('FIND_BY_ID', error, { id });
      throw new DatabaseException(dbError.code, dbError.message, dbError.context);
    }
  }

  /**
   * Override create to throw NestJS exceptions
   */
  override async create(data: NewUser): Promise<User> {
    const user = await super.create(data);
    if (!user) {
      throw new BusinessException('CREATE_FAILED', 'Failed to create user');
    }
    return user;
  }

  /**
   * Override update to throw NotFoundException when user not found
   */
  override async update(id: string, data: Partial<NewUser>): Promise<User> {
    const user = await super.update(id, data);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  /**
   * Override updateWithTimestamp to throw appropriate NestJS exceptions
   */
  override async updateWithTimestamp(
    id: string,
    data: Partial<NewUser>,
    expectedUpdatedAt: Date,
  ): Promise<User> {
    const user = await super.updateWithTimestamp(id, data, expectedUpdatedAt);
    if (!user) {
      // Check if user exists
      const existingUser = await this.findById(id);
      if (!existingUser) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      // User exists but updatedAt mismatch - concurrent modification
      throw new BusinessException(
        'OPTIMISTIC_LOCK_FAILED',
        'Record was modified by another process. Please refresh and try again.',
        {
          userId: id,
          expectedUpdatedAt: expectedUpdatedAt.toISOString(),
          actualUpdatedAt: existingUser.updatedAt.toISOString(),
        },
      );
    }
    return user;
  }

  /**
   * Override restore to throw NotFoundException when user not found
   */
  override async restore(id: string): Promise<User> {
    const user = await super.restore(id);
    if (!user) {
      throw new NotFoundException(`Deleted user with ID ${id} not found`);
    }
    return user;
  }
}
