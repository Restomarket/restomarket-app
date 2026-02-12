import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

/**
 * AgentCallbackController
 *
 * Receives callbacks from ERP agents after async processing:
 * - POST /api/agents/callback (agent reports job completion/failure)
 *
 * Populated in Task 11.
 */
@ApiTags('agents')
@Controller('agents')
export class AgentCallbackController {
  // Endpoint will be added in Task 11
}
