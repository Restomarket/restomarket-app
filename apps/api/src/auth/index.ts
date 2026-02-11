/**
 * Authentication Module
 *
 * Integrates Better Auth with NestJS using @thallesp/nestjs-better-auth.
 *
 * @example Basic usage with decorators
 * ```ts
 * import { Controller, Get } from '@nestjs/common';
 * import { Session, AllowAnonymous, type UserSession } from './auth';
 *
 * @Controller('products')
 * export class ProductsController {
 *   @Get()
 *   findAll(@Session() session: UserSession) {
 *     return this.service.findAll(session.user.id);
 *   }
 *
 *   @Get('public')
 *   @AllowAnonymous()
 *   findPublic() {
 *     return this.service.findPublic();
 *   }
 * }
 * ```
 */

// Module
export { AuthModule } from './auth.module';

// Better Auth instance
export { auth } from './auth';
export type { Auth } from './auth';

// Guards
export { AuthGuard, PermissionsGuard } from './guards';

// Types
export type { AuthSession, AuthRequest } from './guards/permissions.guard';

// All decorators (library + custom)
export {
  // From @thallesp/nestjs-better-auth
  Session,
  AllowAnonymous,
  OptionalAuth,
  Roles,
  type UserSession,
  // Custom decorators
  RequirePermissions,
  PERMISSIONS_KEY,
  CurrentUser,
  CurrentOrganization,
  CurrentTeam,
} from './decorators';

// Re-export AuthService from library for direct API access
export { AuthService } from '@thallesp/nestjs-better-auth';
