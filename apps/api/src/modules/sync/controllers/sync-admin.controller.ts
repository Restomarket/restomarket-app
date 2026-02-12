import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

/**
 * SyncAdminController
 *
 * Admin endpoints for managing sync operations:
 * - GET /api/admin/agents (list agents)
 * - GET /api/admin/agents/:vendorId (agent details)
 * - PUT /api/admin/agents/:vendorId (update agent)
 * - DELETE /api/admin/agents/:vendorId (deregister agent)
 * - GET /api/admin/sync-jobs (list sync jobs)
 * - GET /api/admin/sync-jobs/:id (job details)
 * - GET /api/admin/dlq (list dead letter queue entries)
 * - GET /api/admin/dlq/:id (DLQ entry details)
 * - POST /api/admin/dlq/:id/retry (retry DLQ entry)
 * - POST /api/admin/dlq/:id/resolve (resolve DLQ entry)
 * - POST /api/admin/reconciliation/trigger (manual reconciliation)
 * - GET /api/admin/reconciliation/events (reconciliation event log)
 * - POST /api/admin/circuit-breaker/reset (reset circuit breaker)
 * - GET /api/admin/circuit-breaker/status (all breaker states)
 * - GET /api/admin/metrics/:vendorId (sync metrics)
 * - GET /api/admin/metrics/reconciliation/:vendorId (reconciliation metrics)
 * - GET /api/admin/sync-status/:jobId (job status)
 *
 * Populated across Tasks 12-15.
 */
@ApiTags('admin')
@Controller('admin')
export class SyncAdminController {
  // Endpoints will be added in Tasks 12-15
}
