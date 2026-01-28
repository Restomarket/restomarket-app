import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MinLength, MaxLength } from 'class-validator';
import { type NewUser } from '@database/schema';

/**
 * DTO for creating a new user
 * Aligned with Drizzle's NewUser type (insertable fields only)
 * Omits auto-generated fields: id, createdAt, updatedAt, deletedAt, isActive (has default)
 */
export class CreateUserDto implements Pick<NewUser, 'email' | 'firstName' | 'lastName'> {
  @ApiProperty({
    example: 'john.doe@example.com',
    description: 'User email address (will be normalized to lowercase)',
  })
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty({ message: 'Email is required' })
  @Transform(({ value }: { value: string }) => value.toLowerCase().trim())
  email!: string;

  @ApiProperty({ example: 'John', description: 'User first name' })
  @IsString()
  @IsNotEmpty({ message: 'First name is required' })
  @MinLength(1, { message: 'First name must be at least 1 character' })
  @MaxLength(100, { message: 'First name must not exceed 100 characters' })
  @Transform(({ value }: { value: string }) => value.trim())
  firstName!: string;

  @ApiProperty({ example: 'Doe', description: 'User last name' })
  @IsString()
  @IsNotEmpty({ message: 'Last name is required' })
  @MinLength(1, { message: 'Last name must be at least 1 character' })
  @MaxLength(100, { message: 'Last name must not exceed 100 characters' })
  @Transform(({ value }: { value: string }) => value.trim())
  lastName!: string;
}
