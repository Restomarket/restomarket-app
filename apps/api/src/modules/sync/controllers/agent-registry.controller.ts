import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AgentRegistryService } from '../services/agent-registry.service';
import { RegisterAgentDto } from '../dto/agent-register.dto';
import { AgentHeartbeatDto } from '../dto/agent-heartbeat.dto';
import { AgentAuthGuard } from '../../../common/guards/agent-auth.guard';
import { ApiKeyGuard } from '../../../common/guards/api-key.guard';

/**
 * AgentRegistryController
 *
 * Handles agent registration and lifecycle:
 * - POST /api/agents/register (agent self-registration)
 * - POST /api/agents/heartbeat (agent heartbeat)
 * - DELETE /api/agents/:vendorId (admin deregister)
 * - GET /api/agents (admin list all agents)
 * - GET /api/agents/:vendorId (admin get agent details)
 */
@ApiTags('agents')
@Controller('agents')
export class AgentRegistryController {
  constructor(private readonly agentRegistryService: AgentRegistryService) {}

  /**
   * Agent self-registration endpoint
   * Agents call this to register with the system
   * Rate limited to 10 registrations per minute per IP
   */
  @Post('register')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a new agent',
    description:
      'Agents self-register with their credentials. Token is hashed with bcrypt before storage.',
  })
  @ApiResponse({
    status: 201,
    description: 'Agent registered successfully',
    schema: {
      example: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        vendorId: 'vendor-123',
        agentUrl: 'https://agent.vendor123.com',
        erpType: 'ebp',
        status: 'online',
        version: '1.0.0',
        lastHeartbeat: '2026-02-12T10:00:00.000Z',
        createdAt: '2026-02-12T10:00:00.000Z',
        updatedAt: '2026-02-12T10:00:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 429, description: 'Too many registration attempts' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async register(@Body() dto: RegisterAgentDto) {
    const agent = await this.agentRegistryService.register(dto);

    if (!agent) {
      throw new InternalServerErrorException('Failed to register agent');
    }

    return agent;
  }

  /**
   * Agent heartbeat endpoint
   * Agents call this every 30 seconds to maintain online status
   * Requires Bearer token authentication
   */
  @Post('heartbeat')
  @UseGuards(AgentAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Send agent heartbeat',
    description:
      'Agents send heartbeat every 30s. Updates lastHeartbeat and sets status to online.',
  })
  @ApiResponse({
    status: 200,
    description: 'Heartbeat received',
    schema: {
      example: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        vendorId: 'vendor-123',
        status: 'online',
        lastHeartbeat: '2026-02-12T10:00:30.000Z',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid token' })
  @ApiResponse({ status: 404, description: 'Agent not found' })
  async heartbeat(@Body() dto: AgentHeartbeatDto) {
    const agent = await this.agentRegistryService.heartbeat(dto.vendorId, dto.version);

    if (!agent) {
      throw new NotFoundException(`Agent with vendorId ${dto.vendorId} not found`);
    }

    return {
      id: agent.id,
      vendorId: agent.vendorId,
      status: agent.status,
      lastHeartbeat: agent.lastHeartbeat,
    };
  }

  /**
   * Admin endpoint: Deregister an agent
   * Requires API key authentication
   */
  @Delete(':vendorId')
  @UseGuards(ApiKeyGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiSecurity('api-key')
  @ApiOperation({
    summary: 'Deregister an agent (admin only)',
    description: 'Sets agent status to offline. Requires X-API-Key header.',
  })
  @ApiResponse({ status: 204, description: 'Agent deregistered successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid API key' })
  @ApiResponse({ status: 404, description: 'Agent not found' })
  async deregister(@Param('vendorId') vendorId: string) {
    const success = await this.agentRegistryService.deregister(vendorId);

    if (!success) {
      throw new NotFoundException(`Agent with vendorId ${vendorId} not found`);
    }

    // 204 No Content - no body returned
  }

  /**
   * Admin endpoint: List all agents
   * Requires API key authentication
   */
  @Get()
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('api-key')
  @ApiOperation({
    summary: 'List all agents with health status (admin only)',
    description: 'Returns all registered agents. Requires X-API-Key header.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of agents',
    schema: {
      example: [
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          vendorId: 'vendor-123',
          agentUrl: 'https://agent.vendor123.com',
          erpType: 'ebp',
          status: 'online',
          version: '1.0.0',
          lastHeartbeat: '2026-02-12T10:00:00.000Z',
          createdAt: '2026-02-12T10:00:00.000Z',
          updatedAt: '2026-02-12T10:00:00.000Z',
        },
      ],
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid API key' })
  async getAllAgents() {
    const agents = await this.agentRegistryService.getAllAgents();
    const stats = await this.agentRegistryService.getAgentStats();

    return {
      agents,
      stats,
    };
  }

  /**
   * Admin endpoint: Get agent details
   * Requires API key authentication
   */
  @Get(':vendorId')
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('api-key')
  @ApiOperation({
    summary: 'Get agent details (admin only)',
    description: 'Returns detailed information about a specific agent. Requires X-API-Key header.',
  })
  @ApiResponse({
    status: 200,
    description: 'Agent details',
    schema: {
      example: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        vendorId: 'vendor-123',
        agentUrl: 'https://agent.vendor123.com',
        erpType: 'ebp',
        status: 'online',
        version: '1.0.0',
        lastHeartbeat: '2026-02-12T10:00:00.000Z',
        createdAt: '2026-02-12T10:00:00.000Z',
        updatedAt: '2026-02-12T10:00:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid API key' })
  @ApiResponse({ status: 404, description: 'Agent not found' })
  async getAgent(@Param('vendorId') vendorId: string) {
    const agent = await this.agentRegistryService.getAgent(vendorId);

    if (!agent) {
      throw new NotFoundException(`Agent with vendorId ${vendorId} not found`);
    }

    return agent;
  }
}
