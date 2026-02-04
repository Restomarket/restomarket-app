import { ApiProperty } from '@nestjs/swagger';
import { type User } from '@repo/shared';

/**
 * User response class for Swagger documentation
 * Implements the User type from Drizzle schema for type safety
 * This ensures the response DTO stays in sync with the database schema
 *
 * The controller returns User type directly from Drizzle queries,
 * this class is only for OpenAPI/Swagger documentation
 */
export class UserResponse implements User {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'User ID (UUID v4)',
  })
  id!: string;

  @ApiProperty({
    example: 'john.doe@example.com',
    description: 'User email address (normalized to lowercase)',
  })
  email!: string;

  @ApiProperty({ example: 'John', description: 'User first name' })
  firstName!: string;

  @ApiProperty({ example: 'Doe', description: 'User last name' })
  lastName!: string;

  @ApiProperty({
    example: true,
    description: 'Whether the user account is active',
    default: true,
  })
  isActive!: boolean;

  @ApiProperty({
    example: '2024-01-01T00:00:00.000Z',
    description: 'Account creation timestamp',
  })
  createdAt!: Date;

  @ApiProperty({
    example: '2024-01-01T00:00:00.000Z',
    description: 'Last update timestamp',
  })
  updatedAt!: Date;

  @ApiProperty({
    example: null,
    required: false,
    nullable: true,
    description: 'Soft delete timestamp (null if not deleted)',
  })
  deletedAt!: Date | null;
}
