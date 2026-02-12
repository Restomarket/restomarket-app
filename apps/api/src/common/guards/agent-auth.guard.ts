import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { Request } from 'express';
import * as bcrypt from 'bcrypt';
import { AgentRegistryRepository } from '@database/adapters';

/**
 * AgentAuthGuard
 *
 * Validates Bearer token authentication for ERP agents.
 * Token is compared against bcrypt hash stored in agent_registry table.
 *
 * Usage: @UseGuards(AgentAuthGuard)
 *
 * Request must include:
 * - Authorization: Bearer <token> header
 * - vendorId in body or params
 */
@Injectable()
export class AgentAuthGuard implements CanActivate {
  constructor(private readonly agentRegistryRepository: AgentRegistryRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // Extract Bearer token
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('Authorization header with Bearer token is required');
    }

    // Extract vendorId from body or params
    const vendorId =
      (request.body as { vendorId?: string })?.vendorId ||
      (request.params as { vendorId?: string })?.vendorId;

    if (!vendorId) {
      throw new UnauthorizedException('vendorId is required in request body or params');
    }

    // Load agent from database
    const agent = await this.agentRegistryRepository.findByVendorId(vendorId);
    if (!agent) {
      throw new NotFoundException(`Agent with vendorId "${vendorId}" not found`);
    }

    // Compare token with stored hash using bcrypt
    const isValid = await bcrypt.compare(token, agent.authTokenHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid authentication token');
    }

    return true;
  }

  /**
   * Extract Bearer token from Authorization header
   */
  private extractToken(request: Request): string | undefined {
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }
    return undefined;
  }
}
