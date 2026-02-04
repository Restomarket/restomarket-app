/**
 * Manual mock for @thallesp/nestjs-better-auth
 * This mock prevents ESM import issues in Jest e2e tests
 */

import { SetMetadata, ExecutionContext, CanActivate, Module } from '@nestjs/common';
import { createParamDecorator } from '@nestjs/common';

// Mock decorators
export const AllowAnonymous = () => SetMetadata('allowAnonymous', true);
export const OptionalAuth = () => SetMetadata('optionalAuth', true);
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);

// Mock Session decorator
export const Session = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return request.session || null;
});

// Mock types
export interface UserSession {
  session: {
    id: string;
    userId: string;
    expiresAt: Date;
    token: string;
    ipAddress?: string;
    userAgent?: string;
  };
  user: {
    id: string;
    email: string;
    emailVerified: boolean;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    image?: string;
    banned?: boolean;
    banReason?: string;
    banExpires?: Date;
  };
}

// Mock AuthGuard
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const allowAnonymous = Reflect.getMetadata('allowAnonymous', context.getHandler());

    if (allowAnonymous) {
      return true;
    }

    // In tests, always allow if no allowAnonymous is set
    return true;
  }
}

// Mock AuthModule
@Module({})
export class AuthModule {
  static forRoot(options?: any) {
    return {
      module: AuthModule,
      global: true,
    };
  }
}

// Mock AuthService
export class AuthService {
  async createSession() {
    return { success: true };
  }

  async getSession() {
    return null;
  }

  async invalidateSession() {
    return { success: true };
  }
}
