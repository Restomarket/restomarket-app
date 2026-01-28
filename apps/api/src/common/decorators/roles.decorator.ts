import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Decorator to specify required roles for a route
 * @example
 * @Roles('admin', 'moderator')
 * @Get('admin-only')
 * getAdminData() {
 *   return 'Admin data';
 * }
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
