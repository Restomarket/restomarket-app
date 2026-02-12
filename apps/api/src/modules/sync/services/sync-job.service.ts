import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';
import { SyncJobsRepository } from '@database/adapters';
import type { SyncJob } from '@repo/shared';

/**
 * Sync Job Service
 *
 * Manages sync job lifecycle in PostgreSQL + enqueues BullMQ jobs.
 * Provides idempotency, status transitions, and job querying.
 *
 * Used by:
 * - OrderErpSyncListener (Task 11) — enqueues order sync jobs
 * - OrderSyncProcessor (Task 11) — updates job status during processing
 * - AgentCallbackController (Task 11) — marks jobs completed/failed
 * - DeadLetterQueueService (Task 12) — retry failed jobs
 * - SyncMetricsService (Task 15) — query job metrics
 */
@Injectable()
export class SyncJobService {
  constructor(
    private readonly syncJobsRepository: SyncJobsRepository,
    @InjectQueue('order-sync') private readonly orderSyncQueue: Queue,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(SyncJobService.name);
  }

  /**
   * Create order sync job
   *
   * Creates a sync_jobs row and enqueues BullMQ job for order→ERP sync.
   * Provides idempotency: if a pending/processing job exists for the same orderId, returns existing job.
   *
   * @param vendorId - Vendor identifier
   * @param orderId - PostgreSQL order ID
   * @param orderData - Order payload to send to ERP agent
   * @param correlationId - Optional correlation ID for tracing
   * @returns jobId or null on failure
   */
  async createOrderJob(
    vendorId: string,
    orderId: string,
    orderData: Record<string, unknown>,
    correlationId?: string,
  ): Promise<string | null> {
    try {
      // Check for existing pending/processing job (idempotency)
      const existingJob = await this.syncJobsRepository.findByOrderId(orderId);
      if (
        existingJob &&
        (existingJob.status === 'pending' || existingJob.status === 'processing')
      ) {
        this.logger.info('Skipping duplicate order sync job (already pending/processing)', {
          orderId,
          existingJobId: existingJob.id,
          status: existingJob.status,
          correlationId,
        });
        return existingJob.id;
      }

      // Create sync_jobs row (status=pending, expiresAt=24h from now)
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h TTL
      const job = await this.syncJobsRepository.create({
        postgresOrderId: orderId,
        vendorId,
        operation: 'create_order',
        status: 'pending',
        payload: orderData,
        retryCount: 0,
        maxRetries: 5,
        expiresAt,
      });

      if (!job) {
        this.logger.error('Failed to create sync job in database', {
          orderId,
          vendorId,
          correlationId,
        });
        return null;
      }

      // Enqueue BullMQ job with exponential backoff config
      await this.orderSyncQueue.add(
        'create-order',
        {
          syncJobId: job.id,
          vendorId,
          orderId,
          orderData,
          correlationId,
        },
        {
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 60_000, // 1m → 2m → 4m → 8m → 16m
          },
          removeOnComplete: {
            age: 86_400, // 24h retention
          },
          removeOnFail: false, // Keep for DLQ
        },
      );

      this.logger.info('Order sync job created and enqueued', {
        jobId: job.id,
        orderId,
        vendorId,
        correlationId,
      });

      return job.id;
    } catch (error) {
      this.logger.error('Error creating order sync job', {
        orderId,
        vendorId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        correlationId,
      });
      return null;
    }
  }

  /**
   * Mark job as processing
   *
   * Updates status to 'processing' and sets startedAt timestamp.
   * Called by OrderSyncProcessor when job execution begins.
   *
   * @param jobId - Sync job ID
   * @returns Updated job or null
   */
  async markProcessing(jobId: string): Promise<SyncJob | null> {
    try {
      const job = await this.syncJobsRepository.updateStatus(jobId, 'processing');

      if (!job) {
        this.logger.warn('Failed to mark job as processing (job not found)', { jobId });
        return null;
      }

      this.logger.debug('Job marked as processing', { jobId, vendorId: job.vendorId });
      return job;
    } catch (error) {
      this.logger.error('Error marking job as processing', {
        jobId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Mark job as completed
   *
   * Updates status to 'completed', sets completedAt timestamp, and stores ERP reference.
   * Called by AgentCallbackController when agent reports success.
   *
   * @param jobId - Sync job ID
   * @param erpReference - ERP system reference (order number, invoice number, etc.)
   * @param metadata - Optional additional metadata
   * @returns Updated job or null
   */
  async markCompleted(
    jobId: string,
    erpReference: string,
    metadata?: Record<string, unknown>,
  ): Promise<SyncJob | null> {
    try {
      const job = await this.syncJobsRepository.updateStatus(jobId, 'completed', {
        erpReference,
      });

      if (!job) {
        this.logger.warn('Failed to mark job as completed (job not found)', { jobId });
        return null;
      }

      this.logger.info('Job marked as completed', {
        jobId,
        vendorId: job.vendorId,
        erpReference,
        metadata,
      });
      return job;
    } catch (error) {
      this.logger.error('Error marking job as completed', {
        jobId,
        erpReference,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Mark job as failed
   *
   * Updates status to 'failed', stores error details.
   * Called by AgentCallbackController when agent reports failure or by OrderSyncProcessor on exception.
   *
   * @param jobId - Sync job ID
   * @param error - Error object or message
   * @param retryCount - Current retry count
   * @param nextRetryAt - Next retry timestamp (if retrying)
   * @returns Updated job or null
   */
  async markFailed(
    jobId: string,
    error: Error | string,
    retryCount?: number,
    nextRetryAt?: Date,
  ): Promise<SyncJob | null> {
    try {
      const errorMessage = error instanceof Error ? error.message : error;
      const errorStack = error instanceof Error ? error.stack : undefined;

      const job = await this.syncJobsRepository.updateStatus(jobId, 'failed', {
        errorMessage,
        errorStack,
        retryCount,
        nextRetryAt,
      });

      if (!job) {
        this.logger.warn('Failed to mark job as failed (job not found)', { jobId });
        return null;
      }

      this.logger.warn('Job marked as failed', {
        jobId,
        vendorId: job.vendorId,
        errorMessage,
        retryCount,
      });
      return job;
    } catch (err) {
      this.logger.error('Error marking job as failed', {
        jobId,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Get job details
   *
   * Retrieves full job record by ID.
   *
   * @param jobId - Sync job ID
   * @returns Job details or null
   */
  async getJob(jobId: string): Promise<SyncJob | null> {
    try {
      const job = await this.syncJobsRepository.findById(jobId);

      if (!job) {
        this.logger.debug('Job not found', { jobId });
        return null;
      }

      return job;
    } catch (error) {
      this.logger.error('Error retrieving job', {
        jobId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Get pending jobs (paginated)
   *
   * Retrieves pending jobs, optionally filtered by vendor.
   * Used by admin endpoints and monitoring.
   *
   * @param vendorId - Optional vendor filter
   * @param limit - Max results (default 100)
   * @returns Array of pending jobs
   */
  async getPendingJobs(vendorId?: string, limit = 100): Promise<SyncJob[]> {
    try {
      const jobs = await this.syncJobsRepository.findPending(vendorId, limit);
      return jobs;
    } catch (error) {
      this.logger.error('Error retrieving pending jobs', {
        vendorId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * Get recent jobs (paginated)
   *
   * Retrieves recent jobs ordered by creation time, optionally filtered by vendor.
   * Used by admin endpoints.
   *
   * @param vendorId - Optional vendor filter
   * @param page - Page number (1-indexed)
   * @param limit - Results per page (default 50)
   * @returns Paginated job list with total count
   */
  async getRecentJobs(
    vendorId?: string,
    page = 1,
    limit = 50,
  ): Promise<{ data: SyncJob[]; total: number }> {
    try {
      const result = await this.syncJobsRepository.findRecent(vendorId, page, limit);
      return result;
    } catch (error) {
      this.logger.error('Error retrieving recent jobs', {
        vendorId,
        page,
        limit,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return { data: [], total: 0 };
    }
  }
}
