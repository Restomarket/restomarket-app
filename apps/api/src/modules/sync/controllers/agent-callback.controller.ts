import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PinoLogger } from 'nestjs-pino';
import { AgentAuthGuard } from '../../../common/guards/agent-auth.guard';
import { AgentCallbackDto } from '../dto/agent-callback.dto';
import { SyncJobService } from '../services/sync-job.service';
import { OrdersService } from '../../orders/orders.service';

/**
 * AgentCallbackController
 *
 * Receives callbacks from ERP agents after async processing:
 * - POST /api/agents/callback (agent reports job completion/failure)
 */
@ApiTags('agents')
@Controller('agents')
export class AgentCallbackController {
  constructor(
    private readonly syncJobService: SyncJobService,
    @Inject(forwardRef(() => OrdersService)) private readonly ordersService: OrdersService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AgentCallbackController.name);
  }

  /**
   * Handle agent callback after order processing
   *
   * Agents call this endpoint to report job completion or failure.
   * Updates sync_jobs table and optionally updates the order record.
   */
  @Post('callback')
  @UseGuards(AgentAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Agent callback for job status',
    description:
      'Agents call this endpoint to report job completion or failure after async processing.',
  })
  @ApiResponse({
    status: 200,
    description: 'Callback processed successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Job status updated' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid agent authentication',
  })
  @ApiResponse({
    status: 404,
    description: 'Job not found',
  })
  async handleCallback(
    @Body() dto: AgentCallbackDto,
  ): Promise<{ success: boolean; message: string }> {
    const { jobId, status, erpReference, error, metadata } = dto;

    this.logger.info({
      msg: 'Received agent callback',
      jobId,
      status,
      erpReference,
      hasError: !!error,
      hasMetadata: !!metadata,
    });

    if (status === 'completed') {
      // Mark job as completed in sync_jobs table
      const job = await this.syncJobService.markCompleted(jobId, erpReference, metadata);

      // Update order with ERP reference if we have the order ID and a reference
      if (job?.postgresOrderId && erpReference) {
        const erpDocumentId =
          metadata?.erpDocumentId !== undefined ? String(metadata.erpDocumentId) : undefined;
        await this.ordersService.updateErpReference(
          job.postgresOrderId,
          erpReference,
          erpDocumentId,
        );
        this.logger.info({
          msg: 'Order ERP reference updated from callback',
          jobId,
          orderId: job.postgresOrderId,
          erpReference,
          erpDocumentId,
        });
      }

      this.logger.info({
        msg: 'Job marked as completed',
        jobId,
        erpReference,
      });

      return {
        success: true,
        message: 'Job completed successfully',
      };
    } else {
      // status === 'failed'
      await this.syncJobService.markFailed(jobId, error ?? 'Unknown error');

      this.logger.warn({
        msg: 'Job marked as failed',
        jobId,
        error,
      });

      return {
        success: true,
        message: 'Job failure recorded',
      };
    }
  }
}
