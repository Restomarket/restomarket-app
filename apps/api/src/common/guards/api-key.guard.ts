import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { timingSafeEqual } from 'crypto';

/**
 * ApiKeyGuard
 *
 * Validates X-API-Key header against API_SECRET environment variable.
 * Uses constant-time comparison to prevent timing attacks.
 *
 * Usage: @UseGuards(ApiKeyGuard)
 *
 * Request must include:
 * - X-API-Key: <secret> header
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // Extract API key from header
    const apiKey = request.headers['x-api-key'] as string | undefined;
    if (!apiKey) {
      throw new UnauthorizedException('X-API-Key header is required');
    }

    // Get expected API secret from config
    const apiSecret = this.configService.get<string>('API_SECRET');
    if (!apiSecret) {
      throw new UnauthorizedException('API_SECRET not configured on server');
    }

    // Constant-time comparison to prevent timing attacks
    const isValid = this.timingSafeCompare(apiKey, apiSecret);
    if (!isValid) {
      throw new UnauthorizedException('Invalid API key');
    }

    return true;
  }

  /**
   * Constant-time string comparison using crypto.timingSafeEqual
   * Both strings are converted to buffers of equal length for comparison
   */
  private timingSafeCompare(a: string, b: string): boolean {
    try {
      // Ensure both strings are the same length to use timingSafeEqual
      if (a.length !== b.length) {
        return false;
      }

      const bufA = Buffer.from(a, 'utf-8');
      const bufB = Buffer.from(b, 'utf-8');

      return timingSafeEqual(bufA, bufB);
    } catch {
      return false;
    }
  }
}
