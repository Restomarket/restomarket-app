import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

/**
 * AgentRegistryController
 *
 * Handles agent registration and lifecycle:
 * - POST /api/agents/register (agent self-registration)
 * - POST /api/agents/heartbeat (agent heartbeat)
 * - DELETE /api/agents/:vendorId (admin deregister)
 * - GET /api/agents (admin list all agents)
 * - GET /api/agents/:vendorId (admin get agent details)
 *
 * Populated in Task 5.
 */
@ApiTags('agents')
@Controller('agents')
export class AgentRegistryController {
  // Endpoints will be added in Task 5
}
