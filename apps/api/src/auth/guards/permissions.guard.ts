import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

const ALLOW_ANONYMOUS_KEY = 'allowAnonymous';
const OPTIONAL_AUTH_KEY = 'optionalAuth';

interface AuthSession {
  user: { id: string };
  session: { token: string };
}

interface AuthRequest extends Request {
  session?: AuthSession;
}

interface PermissionResponse {
  success: boolean;
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly authUrl: string;

  constructor(private readonly reflector: Reflector) {
    this.authUrl =
      process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const allowAnonymous = this.reflector.getAllAndOverride<boolean>(ALLOW_ANONYMOUS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const optionalAuth = this.reflector.getAllAndOverride<boolean>(OPTIONAL_AUTH_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (allowAnonymous || !requiredPermissions?.length) return true;

    const request = context.switchToHttp().getRequest<AuthRequest>();
    const session = request.session;

    if (optionalAuth && !session) return true;
    if (!session?.user) throw new ForbiddenException('Authentication required');

    const hasPermissions = await this.checkPermissions(request, requiredPermissions);
    if (!hasPermissions) {
      throw new ForbiddenException(`Missing permissions: ${requiredPermissions.join(', ')}`);
    }

    return true;
  }

  private async checkPermissions(request: Request, permissions: string[]): Promise<boolean> {
    const token = this.extractToken(request);
    if (!token) return false;

    for (const permission of permissions) {
      try {
        const response = await fetch(`${this.authUrl}/api/auth/organization/has-permission`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ permission }),
        });

        if (!response.ok) return false;

        const result = (await response.json()) as PermissionResponse;
        if (!result.success) return false;
      } catch {
        return false;
      }
    }
    return true;
  }

  private extractToken(request: Request): string | undefined {
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);
    return (request as AuthRequest).session?.session?.token;
  }
}
