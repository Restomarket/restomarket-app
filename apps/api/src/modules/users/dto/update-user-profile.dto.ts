import { PickType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';

/**
 * DTO for updating user profile information
 * Uses PickType to select only firstName and lastName from CreateUserDto
 * Ensures consistency with CreateUserDto validations and transformations
 */
export class UpdateUserProfileDto extends PickType(CreateUserDto, [
  'firstName',
  'lastName',
] as const) {}
