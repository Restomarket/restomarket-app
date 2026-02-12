import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

/**
 * ErpMappingController
 *
 * Admin endpoints for managing ERP code mappings:
 * - GET /api/admin/mappings (list mappings)
 * - POST /api/admin/mappings (create mapping)
 * - PUT /api/admin/mappings/:id (update mapping)
 * - DELETE /api/admin/mappings/:id (soft-delete mapping)
 * - POST /api/admin/mappings/seed (bulk seed mappings)
 *
 * Populated in Task 6.
 */
@ApiTags('mappings')
@Controller('admin/mappings')
export class ErpMappingController {
  // Endpoints will be added in Task 6
}
