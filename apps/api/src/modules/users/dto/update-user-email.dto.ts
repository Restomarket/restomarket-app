import { PickType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';

/**
 * DTO for updating user email
 * Uses PickType to select only email field from CreateUserDto
 * Ensures consistency with CreateUserDto email validations and transformations
 */
export class UpdateUserEmailDto extends PickType(CreateUserDto, ['email'] as const) {}
