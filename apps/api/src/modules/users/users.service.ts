import { Injectable } from '@nestjs/common';
import { BusinessException, NotFoundException, ConflictException } from '@common/exceptions';
import { UserRepository } from '@database/adapters';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserEmailDto } from './dto/update-user-email.dto';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { type User, users } from '@repo/shared';
import { IPaginatedResult } from '@shared/interfaces';
import { SortOrder } from '@common/dto/sort-query.dto';
import { and, eq, isNull, sql } from 'drizzle-orm';

/**
 * Users service with simplified architecture
 *
 * Architecture:
 * - Uses Drizzle types (User) instead of domain entities
 * - Returns User type directly (no DTO mapping overhead)
 * - Business logic in service methods
 * - Validation handled by DTOs (class-validator)
 * - Direct repository dependency
 */
@Injectable()
export class UsersService {
  constructor(private readonly userRepository: UserRepository) {}

  // ============================================
  // CRUD Operations
  // ============================================

  async create(createUserDto: CreateUserDto): Promise<User> {
    const existingUser = await this.userRepository.findByEmail(createUserDto.email);

    if (existingUser) {
      throw new ConflictException('USER_ALREADY_EXISTS', 'User with this email already exists', {
        email: createUserDto.email,
      });
    }

    return await this.userRepository.create({
      id: crypto.randomUUID(),
      name: `${createUserDto.firstName} ${createUserDto.lastName}`.trim() || createUserDto.email,
      ...createUserDto,
    });
  }

  async findAllPaginated(
    page: number,
    limit: number,
    search?: string,
    sortBy?: 'createdAt' | 'email' | 'firstName' | 'lastName',
    sortOrder?: SortOrder,
  ): Promise<IPaginatedResult<User>> {
    return await this.userRepository.findMany({
      page,
      limit,
      search,
      sortBy,
      sortOrder,
    });
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new NotFoundException('USER_NOT_FOUND', `User with ID ${id} not found`, {
        userId: id,
      });
    }

    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    // First, get the current user
    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new NotFoundException('USER_NOT_FOUND', `User with ID ${id} not found`, {
        userId: id,
      });
    }

    // Check email uniqueness if email is being updated
    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingUser = await this.userRepository.findByEmail(updateUserDto.email);
      if (existingUser) {
        throw new ConflictException('EMAIL_ALREADY_IN_USE', 'User with this email already exists', {
          email: updateUserDto.email,
        });
      }
    }

    // Use regular update without optimistic locking for REST API updates
    // Note: For scenarios requiring optimistic locking, clients should send updatedAt
    // and we can add a separate endpoint or DTO field for that
    return await this.userRepository.update(id, updateUserDto);
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.userRepository.softDelete(id);

    if (!deleted) {
      throw new NotFoundException('USER_NOT_FOUND', `User with ID ${id} not found`, {
        userId: id,
      });
    }
  }

  // ============================================
  // Business Logic Methods (moved from entities)
  // ============================================

  /**
   * Activate a user account
   * Business logic: validates state and updates isActive flag
   */
  async activateUser(id: string): Promise<User> {
    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new NotFoundException('USER_NOT_FOUND', `User with ID ${id} not found`, {
        userId: id,
      });
    }

    if (user.deletedAt) {
      throw new BusinessException(
        'CANNOT_ACTIVATE_DELETED_USER',
        'Cannot activate a deleted user',
        {
          userId: id,
        },
      );
    }

    if (user.isActive) {
      // Already active, just return
      return user;
    }

    return await this.userRepository.update(id, { isActive: true });
  }

  /**
   * Deactivate a user account
   * Business logic: validates state and updates isActive flag
   */
  async deactivateUser(id: string): Promise<User> {
    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new NotFoundException('USER_NOT_FOUND', `User with ID ${id} not found`, {
        userId: id,
      });
    }

    if (!user.isActive) {
      // Already inactive, just return
      return user;
    }

    return await this.userRepository.update(id, { isActive: false });
  }

  /**
   * Update user email with validation
   * Business logic: validates email uniqueness
   * Uses transaction to ensure atomicity
   * Note: Email format validation handled by UpdateUserEmailDto
   */
  async updateUserEmail(id: string, dto: UpdateUserEmailDto): Promise<User> {
    return await this.userRepository.transaction(async tx => {
      // Check if user exists
      const user = await tx.query.users.findFirst({
        where: (users, { eq, and, isNull }) => and(eq(users.id, id), isNull(users.deletedAt)),
      });

      if (!user) {
        throw new NotFoundException('USER_NOT_FOUND', `User with ID ${id} not found`, {
          userId: id,
        });
      }

      if (user.email === dto.email) {
        // No change needed
        return user;
      }

      // Check if email is already taken (within transaction)
      const existingUser = await tx.query.users.findFirst({
        where: (users, { eq, and, isNull }) =>
          and(eq(users.email, dto.email), isNull(users.deletedAt)),
      });

      if (existingUser) {
        throw new ConflictException('EMAIL_ALREADY_IN_USE', 'Email is already taken', {
          email: dto.email,
        });
      }

      // Update email atomically
      const [updatedUser] = await tx
        .update(users)
        .set({
          email: dto.email,
          updatedAt: new Date(),
        })
        .where(and(eq(users.id, id), isNull(users.deletedAt)))
        .returning();

      if (!updatedUser) {
        throw new BusinessException('UPDATE_FAILED', 'Failed to update user email');
      }

      return updatedUser;
    });
  }

  /**
   * Update user profile (first and last name)
   * Business logic: updates user profile
   * Note: Name validation handled by UpdateUserProfileDto
   */
  async updateUserProfile(id: string, dto: UpdateUserProfileDto): Promise<User> {
    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new NotFoundException('USER_NOT_FOUND', `User with ID ${id} not found`, {
        userId: id,
      });
    }

    return await this.userRepository.update(id, {
      firstName: dto.firstName,
      lastName: dto.lastName,
    });
  }

  /**
   * Get user full name (utility method)
   * Note: Consider moving to a UserViewModel or computing client-side
   */
  getUserFullName(user: User): string {
    return `${user.firstName} ${user.lastName}`.trim();
  }

  /**
   * Check if user can perform admin actions
   * Business rule: active AND not deleted
   */
  async canUserPerformAdminActions(id: string): Promise<boolean> {
    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new NotFoundException('USER_NOT_FOUND', `User with ID ${id} not found`, {
        userId: id,
      });
    }

    return user.isActive && !user.deletedAt;
  }

  /**
   * Find all active users (uses repository SQL filtering)
   */
  async findActiveUsers(page = 1, limit = 100): Promise<IPaginatedResult<User>> {
    return await this.userRepository.findMany({
      isActive: true,
      limit,
      page,
    });
  }

  /**
   * Find users by email domain (uses repository SQL filtering)
   */
  async findUsersByEmailDomain(
    domain: string,
    page = 1,
    limit = 100,
  ): Promise<IPaginatedResult<User>> {
    return await this.userRepository.findMany({
      emailDomain: domain,
      limit,
      page,
    });
  }

  /**
   * Get user statistics
   */
  async getStatistics(): Promise<{
    total: number;
    active: number;
    inactive: number;
    deleted: number;
  }> {
    return this.userRepository.getStatistics();
  }

  // ============================================
  // Helper Methods (Pure Functions)
  // ============================================

  /**
   * Get email domain from user
   * Pure function - can be used anywhere
   */
  getEmailDomain(user: User): string {
    return user.email.split('@')[1] ?? '';
  }

  /**
   * Check if user profile is complete
   * Business rule: has all required fields
   */
  isProfileComplete(user: User): boolean {
    return Boolean(user.email && user.firstName && user.lastName);
  }
}
