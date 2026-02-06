import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { auth } from '../auth';
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

/**
 * Global Permissions Guard
 *
 * Validates that authenticated users have required permissions
 * for protected routes using the @RequirePermissions() decorator.
 *
 * IMPORTANT: This uses the local Better Auth instance instead of
 * making HTTP calls to Next.js, which:
 * - Eliminates network latency
 * - Removes dependency on Next.js availability
 * - Prevents single point of failure
 * - Uses the same database for consistency
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

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

    // Allow anonymous access if specified
    if (allowAnonymous || !requiredPermissions?.length) return true;

    const request = context.switchToHttp().getRequest<AuthRequest>();
    const session = request.session;

    // Allow unauthenticated if optional auth
    if (optionalAuth && !session) return true;

    // Require authentication
    if (!session?.user) {
      throw new ForbiddenException('Authentication required');
    }

    // Check permissions using local Better Auth instance
    const hasPermissions = await this.checkPermissions(request, requiredPermissions);
    if (!hasPermissions) {
      throw new ForbiddenException(`Missing permissions: ${requiredPermissions.join(', ')}`);
    }

    return true;
  }

  /**
   * Check permissions using local Better Auth instance
   *
   * This calls auth.api.hasPermission() directly instead of making
   * HTTP requests to Next.js, which is much faster and more reliable.
   */
  private async checkPermissions(request: Request, permissions: string[]): Promise<boolean> {
    const token = this.extractToken(request);
    if (!token) return false;

    // Convert Express request headers to Headers object
    const headers = this.convertHeaders(request);

    for (const permission of permissions) {
      try {
        // Use local Better Auth instance directly (no HTTP call!)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const api = auth.api as any;
        const result = await api.hasPermission({
          headers,
          body: { permission },
        });

        if (!result?.success) {
          return false;
        }
      } catch (error) {
        console.error(`[PermissionsGuard] Permission check failed for ${permission}:`, error);
        return false;
      }
    }

    return true;
  }

  /**
   * Extract authentication token from request
   * Supports both Bearer token and session token
   */
  private extractToken(request: Request): string | undefined {
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }
    return (request as AuthRequest).session?.session?.token;
  }

  /**
   * Convert Express headers to Web Headers object
   * Better Auth expects Web API Headers
   */
  private convertHeaders(request: Request): Headers {
    const headers = new Headers();

    // Add authorization header if present
    if (request.headers.authorization) {
      headers.set('Authorization', request.headers.authorization);
    }

    // Add session cookie if present
    if (request.headers.cookie) {
      headers.set('Cookie', request.headers.cookie);
    }

    // Add other common headers
    if (request.headers['user-agent']) {
      headers.set('User-Agent', request.headers['user-agent']);
    }

    if (request.headers['x-forwarded-for']) {
      headers.set('X-Forwarded-For', request.headers['x-forwarded-for'] as string);
    }

    return headers;
  }
}
