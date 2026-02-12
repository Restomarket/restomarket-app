import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { ApiKeyGuard } from '@common/guards';
import { DeadLetterQueueService } from '../services/dead-letter-queue.service';
import { ReconciliationService } from '../services/reconciliation.service';
import { SyncMetricsService } from '../services/sync-metrics.service';
import { ReconciliationEventsRepository } from '../../../database/adapters';

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
 * - GET /api/admin/dlq (list dead letter queue entries) ✅ Task 12
 * - GET /api/admin/dlq/:id (DLQ entry details) ✅ Task 12
 * - POST /api/admin/dlq/:id/retry (retry DLQ entry) ✅ Task 12
 * - POST /api/admin/dlq/:id/resolve (resolve DLQ entry) ✅ Task 12
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
@UseGuards(ApiKeyGuard)
@ApiSecurity('api-key')
export class SyncAdminController {
  constructor(
    private readonly dlqService: DeadLetterQueueService,
    private readonly reconciliationService: ReconciliationService,
    private readonly reconciliationRepo: ReconciliationEventsRepository,
    private readonly metricsService: SyncMetricsService,
  ) {}

  /**
   * List unresolved DLQ entries (paginated)
   *
   * GET /api/admin/dlq?vendorId=vendor-1&page=1&limit=50
   */
  @Get('dlq')
  @ApiOperation({
    summary: 'List unresolved dead letter queue entries',
    description:
      'Retrieves paginated list of permanently failed jobs that have not been resolved. Optionally filtered by vendorId.',
  })
  @ApiQuery({
    name: 'vendorId',
    required: false,
    type: String,
    description: 'Filter by vendor ID',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (1-indexed)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Results per page (max 100)',
    example: 50,
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of unresolved DLQ entries',
    schema: {
      example: {
        success: true,
        data: {
          data: [
            {
              id: 'dlq-123',
              vendorId: 'vendor-1',
              operation: 'create_order',
              failureReason: 'Agent timeout',
              attemptCount: 5,
              createdAt: '2025-01-15T10:00:00Z',
            },
          ],
          total: 1,
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid API key',
  })
  async listDlqEntries(
    @Query('vendorId') vendorId?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit = 50,
  ) {
    const result = await this.dlqService.getUnresolved(vendorId, page, Math.min(limit, 100));
    return result;
  }

  /**
   * Get DLQ entry details
   *
   * GET /api/admin/dlq/:id
   */
  @Get('dlq/:id')
  @ApiOperation({
    summary: 'Get DLQ entry details',
    description: 'Retrieves full details of a single dead letter queue entry including payload.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'DLQ entry ID',
    example: 'dlq-123',
  })
  @ApiResponse({
    status: 200,
    description: 'DLQ entry details',
    schema: {
      example: {
        success: true,
        data: {
          id: 'dlq-123',
          originalJobId: 'job-456',
          vendorId: 'vendor-1',
          operation: 'create_order',
          payload: { orderId: 'order-789', orderData: {} },
          failureReason: 'Agent timeout',
          failureStack: 'Error stack...',
          attemptCount: 5,
          resolved: false,
          createdAt: '2025-01-15T10:00:00Z',
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'DLQ entry not found',
  })
  async getDlqEntryDetails(@Param('id') id: string) {
    const entry = await this.dlqService.getDetails(id);
    if (!entry) {
      return {
        success: false,
        message: 'DLQ entry not found',
      };
    }
    return entry;
  }

  /**
   * Retry DLQ entry
   *
   * POST /api/admin/dlq/:id/retry
   */
  @Post('dlq/:id/retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Retry DLQ entry',
    description:
      'Re-enqueues the failed job to BullMQ with original payload and retry configuration.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'DLQ entry ID',
    example: 'dlq-123',
  })
  @ApiResponse({
    status: 200,
    description: 'DLQ entry retried successfully',
    schema: {
      example: {
        success: true,
        data: {
          dlqId: 'dlq-123',
          newJobId: 'bullmq-job-789',
        },
        message: 'DLQ entry retried successfully',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'DLQ entry not found',
  })
  async retryDlqEntry(@Param('id') id: string) {
    const newJobId = await this.dlqService.retry(id);
    if (!newJobId) {
      return {
        success: false,
        message: 'Failed to retry DLQ entry (entry not found or queue error)',
      };
    }
    return {
      success: true,
      data: {
        dlqId: id,
        newJobId,
      },
      message: 'DLQ entry retried successfully',
    };
  }

  /**
   * Resolve DLQ entry
   *
   * POST /api/admin/dlq/:id/resolve
   */
  @Post('dlq/:id/resolve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resolve DLQ entry',
    description: 'Marks DLQ entry as manually resolved without retrying. Logs audit trail.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'DLQ entry ID',
    example: 'dlq-123',
  })
  @ApiQuery({
    name: 'resolvedBy',
    required: false,
    type: String,
    description: 'User/admin identifier',
    example: 'admin-user-1',
  })
  @ApiResponse({
    status: 200,
    description: 'DLQ entry resolved successfully',
    schema: {
      example: {
        success: true,
        data: {
          id: 'dlq-123',
          resolved: true,
          resolvedBy: 'admin-user-1',
        },
        message: 'DLQ entry resolved successfully',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'DLQ entry not found',
  })
  async resolveDlqEntry(@Param('id') id: string, @Query('resolvedBy') resolvedBy = 'admin') {
    const entry = await this.dlqService.resolve(id, resolvedBy);
    if (!entry) {
      return {
        success: false,
        message: 'Failed to resolve DLQ entry (entry not found)',
      };
    }
    return {
      success: true,
      data: {
        id: entry.id,
        resolved: entry.resolved,
        resolvedBy: entry.resolvedBy,
      },
      message: 'DLQ entry resolved successfully',
    };
  }

  /**
   * Trigger manual reconciliation
   *
   * POST /api/admin/reconciliation/trigger
   */
  @Post('reconciliation/trigger')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Trigger manual reconciliation',
    description:
      'Manually triggers drift detection and reconciliation for a specific vendor or all active vendors.',
  })
  @ApiQuery({
    name: 'vendorId',
    required: false,
    type: String,
    description: 'Vendor ID to reconcile (omit to reconcile all active vendors)',
    example: 'vendor-123',
  })
  @ApiResponse({
    status: 200,
    description: 'Reconciliation triggered successfully',
    schema: {
      example: {
        success: true,
        data: {
          vendorId: 'vendor-123',
          hasDrift: true,
          erpChecksum: 'abc123',
          dbChecksum: 'def456',
          itemCount: 1000,
          driftedItems: ['SKU001', 'SKU002'],
          durationMs: 5432,
        },
        message: 'Reconciliation completed',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid API key',
  })
  async triggerReconciliation(@Query('vendorId') vendorId?: string) {
    if (vendorId) {
      const result = await this.reconciliationService.triggerFullSync(vendorId);
      return {
        success: true,
        data: result,
        message: 'Reconciliation completed',
      };
    }

    // Trigger for all active vendors
    const results = await this.reconciliationService.triggerFullSyncAll();
    return {
      success: true,
      data: results,
      message: `Reconciliation completed for ${results.length} vendor(s)`,
    };
  }

  /**
   * Get reconciliation event log
   *
   * GET /api/admin/reconciliation/events
   */
  @Get('reconciliation/events')
  @ApiOperation({
    summary: 'Get reconciliation event log',
    description: 'Retrieves paginated list of reconciliation events with drift detection results.',
  })
  @ApiQuery({
    name: 'vendorId',
    required: false,
    type: String,
    description: 'Filter by vendor ID',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (1-indexed)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Results per page (max 100)',
    example: 50,
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated reconciliation event log',
    schema: {
      example: {
        success: true,
        data: {
          data: [
            {
              id: 'event-123',
              vendorId: 'vendor-1',
              eventType: 'drift_detected',
              summary: {
                erpChecksum: 'abc123',
                dbChecksum: 'def456',
                itemCount: 1000,
                hasDrift: true,
              },
              timestamp: '2025-01-15T10:00:00Z',
              durationMs: 5432,
            },
          ],
          total: 1,
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid API key',
  })
  async getReconciliationEvents(
    @Query('vendorId') vendorId?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit = 50,
  ) {
    // If no vendorId provided, return empty result (or implement findAll in future)
    if (!vendorId) {
      return {
        success: true,
        data: { data: [], total: 0 },
        message: 'Vendor ID required for reconciliation events',
      };
    }

    const result = await this.reconciliationRepo.findByVendor(vendorId, page, Math.min(limit, 100));
    return result;
  }

  /**
   * Get sync job metrics for a vendor
   *
   * GET /api/admin/metrics/:vendorId
   */
  @Get('metrics/:vendorId')
  @ApiOperation({
    summary: 'Get sync job metrics',
    description:
      'Retrieves aggregated sync job metrics for a vendor including latency, success rate, and retry rate.',
  })
  @ApiParam({
    name: 'vendorId',
    type: String,
    description: 'Vendor ID',
    example: 'vendor-123',
  })
  @ApiResponse({
    status: 200,
    description: 'Sync job metrics',
    schema: {
      example: {
        success: true,
        data: {
          total: 1000,
          pending: 5,
          processing: 3,
          completed: 980,
          failed: 12,
          successRate: '98.0',
          avgLatencyMs: 1500,
          p95LatencyMs: 2250,
          retryRate: '5.5',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid API key',
  })
  async getSyncMetrics(@Param('vendorId') vendorId: string) {
    const metrics = await this.metricsService.getSyncMetrics(vendorId);
    return {
      success: true,
      data: metrics,
    };
  }

  /**
   * Get reconciliation metrics for a vendor
   *
   * GET /api/admin/metrics/reconciliation/:vendorId
   */
  @Get('metrics/reconciliation/:vendorId')
  @ApiOperation({
    summary: 'Get reconciliation metrics',
    description:
      'Retrieves aggregated reconciliation metrics including drift frequency and event counts.',
  })
  @ApiParam({
    name: 'vendorId',
    type: String,
    description: 'Vendor ID',
    example: 'vendor-123',
  })
  @ApiResponse({
    status: 200,
    description: 'Reconciliation metrics',
    schema: {
      example: {
        success: true,
        data: {
          eventCount: 50,
          driftDetected: 5,
          driftResolved: 4,
          fullChecksums: 20,
          incrementalSyncs: 30,
          avgDurationMs: 3500,
          lastRun: '2025-01-15T10:00:00Z',
          driftFrequency: '10.0',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid API key',
  })
  async getReconciliationMetrics(@Param('vendorId') vendorId: string) {
    const metrics = await this.metricsService.getReconciliationMetrics(vendorId);
    return {
      success: true,
      data: metrics,
    };
  }

  /**
   * Get sync job details by ID
   *
   * GET /api/admin/sync-status/:jobId
   */
  @Get('sync-status/:jobId')
  @ApiOperation({
    summary: 'Get sync job status',
    description: 'Retrieves full details of a single sync job including payload and error details.',
  })
  @ApiParam({
    name: 'jobId',
    type: String,
    description: 'Sync job ID',
    example: 'job-123',
  })
  @ApiResponse({
    status: 200,
    description: 'Sync job details',
    schema: {
      example: {
        success: true,
        data: {
          id: 'job-123',
          postgresOrderId: 'order-456',
          vendorId: 'vendor-123',
          operation: 'create_order',
          status: 'completed',
          payload: { orderId: 'order-456', orderData: {} },
          retryCount: 1,
          maxRetries: 5,
          nextRetryAt: null,
          errorMessage: null,
          errorStack: null,
          erpReference: 'ERP-789',
          createdAt: '2025-01-15T10:00:00Z',
          startedAt: '2025-01-15T10:00:05Z',
          completedAt: '2025-01-15T10:00:10Z',
          expiresAt: '2025-01-16T10:00:00Z',
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Sync job not found',
  })
  async getSyncJobDetails(@Param('jobId') jobId: string) {
    const job = await this.metricsService.getJobDetails(jobId);
    if (!job) {
      return {
        success: false,
        message: 'Sync job not found',
      };
    }
    return {
      success: true,
      data: job,
    };
  }
}
