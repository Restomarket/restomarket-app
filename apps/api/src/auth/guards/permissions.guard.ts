import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { auth } from '../auth';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

const ALLOW_ANONYMOUS_KEY = 'allowAnonymous';
const OPTIONAL_AUTH_KEY = 'optionalAuth';

/** Session shape attached to request by upstream auth middleware */
export interface AuthSession {
  user: { id: string; [key: string]: unknown };
  session: {
    token: string;
    activeOrganizationId?: string | null;
    activeTeamId?: string | null;
  };
}

export interface AuthRequest extends Request {
  session?: AuthSession;
}

/**
 * Global Permissions Guard
 *
 * Validates that authenticated users have required permissions
 * for protected routes using the @RequirePermissions() decorator.
 *
 * Uses the local Better Auth instance directly (no HTTP calls),
 * which eliminates network latency and removes cross-service dependencies.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const allowAnonymous = this.reflector.getAllAndOverride<boolean>(ALLOW_ANONYMOUS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No permissions required or anonymous access allowed
    if (allowAnonymous || !requiredPermissions?.length) return true;

    const optionalAuth = this.reflector.getAllAndOverride<boolean>(OPTIONAL_AUTH_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<AuthRequest>();
    const session = request.session;

    // Allow unauthenticated if optional auth
    if (optionalAuth && !session) return true;

    // 401: Authentication required
    if (!session?.user) {
      throw new UnauthorizedException('Authentication required');
    }

    // 403: Check permissions
    const hasPermissions = await this.checkPermissions(request, requiredPermissions);
    if (!hasPermissions) {
      throw new ForbiddenException(`Missing permissions: ${requiredPermissions.join(', ')}`);
    }

    return true;
  }

  /**
   * Check permissions using local Better Auth instance.
   * Calls auth.api.hasPermission() directly — no HTTP round-trip.
   */
  private async checkPermissions(request: Request, permissions: string[]): Promise<boolean> {
    const token = this.extractToken(request);
    if (!token) return false;

    const headers = this.convertHeaders(request);

    for (const permission of permissions) {
      try {
        const api = auth.api as Record<
          string,
          ((...args: unknown[]) => Promise<unknown>) | undefined
        >;
        const hasPermission = api.hasPermission;

        if (!hasPermission) {
          this.logger.warn('hasPermission API not available on auth instance');
          return false;
        }

        const result = (await hasPermission({
          headers,
          body: { permission },
        })) as { success?: boolean } | null;

        if (!result?.success) return false;
      } catch (error) {
        this.logger.error(`Permission check failed for "${permission}"`, error);
        return false;
      }
    }

    return true;
  }

  /** Extract auth token from Bearer header or session */
  private extractToken(request: Request): string | undefined {
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }
    return (request as AuthRequest).session?.session?.token;
  }

  /** Convert Express headers to Web API Headers (Better Auth requirement) */
  private convertHeaders(request: Request): Headers {
    const headers = new Headers();

    if (request.headers.authorization) {
      headers.set('Authorization', request.headers.authorization);
    }
    if (request.headers.cookie) {
      headers.set('Cookie', request.headers.cookie);
    }
    if (request.headers['user-agent']) {
      headers.set('User-Agent', request.headers['user-agent']);
    }
    if (request.headers['x-forwarded-for']) {
      headers.set('X-Forwarded-For', request.headers['x-forwarded-for'] as string);
    }

    return headers;
  }
}
