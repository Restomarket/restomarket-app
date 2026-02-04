/**
 * Authentication Module
 *
 * Integrates Better Auth with NestJS using @thallesp/nestjs-better-auth.
 *
 * @example Basic usage with decorators
 * ```ts
 * import { Controller, Get, Post, Body } from '@nestjs/common';
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
 *
 * @example Using AuthService for API calls
 * ```ts
 * import { Injectable } from '@nestjs/common';
 * import { AuthService } from './auth';
 * import { fromNodeHeaders } from 'better-auth/node';
 * import { auth } from './auth';
 *
 * @Injectable()
 * export class UserService {
 *   constructor(private authService: AuthService<typeof auth>) {}
 *
 *   async getUserAccounts(headers: Headers) {
 *     return this.authService.api.listUserAccounts({
 *       headers: fromNodeHeaders(headers),
 *     });
 *   }
 * }
 * ```
 */

// Module
export { AuthModule } from './auth.module';

// Better Auth instance
export { auth } from './auth';
export type { auth as Auth } from './auth';

// Guards
export { AuthGuard, PermissionsGuard } from './guards';

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
