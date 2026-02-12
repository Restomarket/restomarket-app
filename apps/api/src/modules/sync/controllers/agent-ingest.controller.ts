import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

/**
 * AgentIngestController
 *
 * Handles direct ingest from ERP agents:
 * - POST /api/sync/items (incremental item sync)
 * - POST /api/sync/items/batch (full catalog sync)
 * - POST /api/sync/stock (incremental stock sync)
 * - POST /api/sync/stock/batch (full stock sync)
 * - POST /api/sync/warehouses (incremental warehouse sync)
 * - POST /api/sync/warehouses/batch (full warehouse sync)
 *
 * Populated in Task 9.
 */
@ApiTags('sync')
@Controller('sync')
export class AgentIngestController {
  // Endpoints will be added in Task 9
}
