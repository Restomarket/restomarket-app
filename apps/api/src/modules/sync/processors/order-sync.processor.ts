import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';
import { SyncJobService } from '../services/sync-job.service';
import { AgentCommunicationService } from '../services/agent-communication.service';
import { DeadLetterQueueService } from '../services/dead-letter-queue.service';

/**
 * Payload for order sync jobs
 */
export interface OrderSyncPayload {
  syncJobId: string;
  vendorId: string;
  orderId: string;
  orderData: Record<string, unknown>;
  correlationId?: string;
}

/**
 * BullMQ processor for order synchronization to ERP agents
 *
 * Handles:
 * - Order creation in ERP systems
 * - Automatic retry with exponential backoff (5 attempts: 1m → 2m → 4m → 8m → 16m)
 * - Failed job handling (moves to DLQ after exhausting retries)
 */
@Processor('order-sync', {
  concurrency: 5, // Process up to 5 orders concurrently
})
@Injectable()
export class OrderSyncProcessor extends WorkerHost {
  constructor(
    private readonly syncJobService: SyncJobService,
    private readonly agentCommunication: AgentCommunicationService,
    private readonly dlqService: DeadLetterQueueService,
    private readonly logger: PinoLogger,
  ) {
    super();
    this.logger.setContext(OrderSyncProcessor.name);
  }

  /**
   * Process order creation job
   */
  async process(job: Job<OrderSyncPayload, void, 'create-order'>): Promise<void> {
    const { syncJobId, vendorId, orderId, orderData, correlationId } = job.data;

    this.logger.info({
      msg: 'Processing order sync job',
      syncJobId,
      vendorId,
      orderId,
      correlationId,
      attemptsMade: job.attemptsMade,
    });

    try {
      // Mark job as processing in PostgreSQL
      await this.syncJobService.markProcessing(syncJobId);

      // Call agent to create order in ERP
      // Agent will process async and call back to POST /api/agents/callback
      await this.agentCommunication.callAgent<void>(
        vendorId,
        'orders',
        '/sync/create-order',
        {
          syncJobId,
          orderId,
          orderData,
        },
        correlationId,
      );

      this.logger.debug({
        msg: 'Order sync request sent to agent',
        syncJobId,
        vendorId,
        orderId,
        correlationId,
      });

      // Note: We do NOT mark as completed here
      // The agent will call back to /api/agents/callback when done
    } catch (error) {
      this.logger.error({
        msg: 'Order sync job failed',
        syncJobId,
        vendorId,
        orderId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        attemptsMade: job.attemptsMade,
        correlationId,
      });

      // Update sync job as failed (will be retried by BullMQ)
      await this.syncJobService.markFailed(
        syncJobId,
        error instanceof Error ? error.message : String(error),
        job.attemptsMade + 1,
      );

      // Re-throw to trigger BullMQ retry
      throw error;
    }
  }

  /**
   * Handle job failure after all retries exhausted
   */
  @OnWorkerEvent('failed')
  async onFailed(job: Job<OrderSyncPayload>, error: Error): Promise<void> {
    const { syncJobId, vendorId, orderId, correlationId } = job.data;

    // Check if all retries are exhausted
    const isExhausted = job.attemptsMade >= (job.opts.attempts ?? 5);

    if (isExhausted) {
      this.logger.error({
        msg: 'Order sync job exhausted all retries',
        syncJobId,
        vendorId,
        orderId,
        error: error.message,
        attemptsMade: job.attemptsMade,
        correlationId,
      });

      // Mark as permanently failed
      await this.syncJobService.markFailed(syncJobId, error.message, job.attemptsMade);

      // Add to dead letter queue
      await this.dlqService.add({
        originalJobId: syncJobId,
        vendorId,
        operation: 'create_order',
        payload: job.data as unknown as Record<string, unknown>,
        failureReason: error.message,
        failureStack: error.stack,
        attemptCount: job.attemptsMade,
      });
    } else {
      this.logger.warn({
        msg: 'Order sync job failed, will retry',
        syncJobId,
        vendorId,
        orderId,
        error: error.message,
        attemptsMade: job.attemptsMade,
        remainingAttempts: (job.opts.attempts ?? 5) - job.attemptsMade,
        correlationId,
      });
    }
  }

  /**
   * Handle job completion
   */
  @OnWorkerEvent('completed')
  async onCompleted(job: Job<OrderSyncPayload>): Promise<void> {
    const { syncJobId, vendorId, orderId, correlationId } = job.data;

    this.logger.info({
      msg: 'Order sync job completed (agent request sent)',
      syncJobId,
      vendorId,
      orderId,
      duration: job.finishedOn ? job.finishedOn - (job.processedOn ?? 0) : undefined,
      correlationId,
    });
  }
}
