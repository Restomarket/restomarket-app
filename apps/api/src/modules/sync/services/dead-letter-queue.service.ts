import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';
import { DeadLetterQueueRepository } from '@database/adapters';
import type { DeadLetterQueueEntry } from '@repo/shared';

/**
 * Dead Letter Queue Service
 *
 * Manages permanently failed jobs:
 * - Add jobs that exhausted all retries
 * - List unresolved entries (paginated)
 * - Retry entries (re-enqueue to BullMQ)
 * - Resolve entries (mark as manually handled)
 * - Cleanup old resolved entries
 * - Alert on unresolved entries
 *
 * Used by:
 * - OrderSyncProcessor (Task 11) — adds exhausted jobs to DLQ
 * - SyncAdminController (Task 12) — admin endpoints for DLQ management
 * - SyncSchedulerService (Task 14) — cleanup cron job
 * - AlertService (Task 14) — DLQ alerts
 */
@Injectable()
export class DeadLetterQueueService {
  constructor(
    private readonly dlqRepository: DeadLetterQueueRepository,
    @InjectQueue('order-sync') private readonly orderSyncQueue: Queue,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(DeadLetterQueueService.name);
  }

  /**
   * Add failed job to DLQ
   *
   * Called when a job exhausts all retries. Stores original payload for later retry.
   *
   * @param data - DLQ entry data
   * @returns DLQ entry ID or null on failure
   */
  async add(data: {
    originalJobId: string | null;
    vendorId: string;
    operation: string;
    payload: Record<string, unknown>;
    failureReason: string;
    failureStack?: string;
    attemptCount: number;
  }): Promise<string | null> {
    try {
      const entry = await this.dlqRepository.create({
        originalJobId: data.originalJobId,
        vendorId: data.vendorId,
        operation: data.operation,
        payload: data.payload,
        failureReason: data.failureReason,
        failureStack: data.failureStack,
        attemptCount: data.attemptCount,
        lastAttemptAt: new Date(),
        resolved: false,
      });

      if (!entry) {
        this.logger.error('Failed to add entry to DLQ', {
          originalJobId: data.originalJobId,
          vendorId: data.vendorId,
          operation: data.operation,
        });
        return null;
      }

      this.logger.warn('Job added to DLQ', {
        dlqId: entry.id,
        originalJobId: data.originalJobId,
        vendorId: data.vendorId,
        operation: data.operation,
        failureReason: data.failureReason,
        attemptCount: data.attemptCount,
      });

      return entry.id;
    } catch (error) {
      this.logger.error('Error adding to DLQ', {
        originalJobId: data.originalJobId,
        vendorId: data.vendorId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      return null;
    }
  }

  /**
   * Get unresolved DLQ entries (paginated)
   *
   * Retrieves DLQ entries that haven't been resolved, optionally filtered by vendor.
   *
   * @param vendorId - Optional vendor filter
   * @param page - Page number (1-indexed)
   * @param limit - Results per page (default 50)
   * @returns Paginated list with total count
   */
  async getUnresolved(
    vendorId?: string,
    page = 1,
    limit = 50,
  ): Promise<{ data: DeadLetterQueueEntry[]; total: number }> {
    try {
      const result = await this.dlqRepository.findUnresolved(vendorId, page, limit);
      return result;
    } catch (error) {
      this.logger.error('Error retrieving unresolved DLQ entries', {
        vendorId,
        page,
        limit,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return { data: [], total: 0 };
    }
  }

  /**
   * Get DLQ entry details
   *
   * Retrieves single DLQ entry with full payload.
   *
   * @param id - DLQ entry ID
   * @returns DLQ entry or null
   */
  async getDetails(id: string): Promise<DeadLetterQueueEntry | null> {
    try {
      const entry = await this.dlqRepository.findById(id);

      if (!entry) {
        this.logger.debug('DLQ entry not found', { id });
        return null;
      }

      return entry;
    } catch (error) {
      this.logger.error('Error retrieving DLQ entry', {
        id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Retry DLQ entry
   *
   * Re-creates BullMQ job from original payload. Logs audit trail.
   *
   * @param id - DLQ entry ID
   * @returns New BullMQ job ID or null on failure
   */
  async retry(id: string): Promise<string | null> {
    try {
      const entry = await this.dlqRepository.findById(id);

      if (!entry) {
        this.logger.warn('DLQ entry not found for retry', { id });
        return null;
      }

      // Re-enqueue to BullMQ with same configuration as original
      const bullmqJob = await this.orderSyncQueue.add('create-order', entry.payload, {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 60_000,
        },
        removeOnComplete: {
          age: 86_400,
        },
        removeOnFail: false,
      });

      this.logger.info('DLQ entry retried', {
        dlqId: id,
        vendorId: entry.vendorId,
        operation: entry.operation,
        newBullMQJobId: bullmqJob.id,
      });

      return bullmqJob.id ?? null;
    } catch (error) {
      this.logger.error('Error retrying DLQ entry', {
        id,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      return null;
    }
  }

  /**
   * Resolve DLQ entry
   *
   * Marks entry as manually resolved. Logs audit trail.
   *
   * @param id - DLQ entry ID
   * @param resolvedBy - User/admin identifier
   * @returns Updated entry or null
   */
  async resolve(id: string, resolvedBy: string): Promise<DeadLetterQueueEntry | null> {
    try {
      const entry = await this.dlqRepository.markResolved(id, resolvedBy);

      if (!entry) {
        this.logger.warn('Failed to resolve DLQ entry (not found)', { id });
        return null;
      }

      this.logger.info('DLQ entry resolved', {
        dlqId: id,
        vendorId: entry.vendorId,
        operation: entry.operation,
        resolvedBy,
      });

      return entry;
    } catch (error) {
      this.logger.error('Error resolving DLQ entry', {
        id,
        resolvedBy,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Cleanup old resolved entries
   *
   * Deletes resolved entries older than specified days.
   * Called by scheduled cleanup task (Task 14).
   *
   * @param olderThanDays - Age threshold in days (default 30)
   * @returns Number of deleted entries
   */
  async cleanup(olderThanDays = 30): Promise<number> {
    try {
      const deletedCount = await this.dlqRepository.deleteOldResolved(olderThanDays);

      this.logger.info('DLQ cleanup completed', {
        deletedCount,
        olderThanDays,
      });

      return deletedCount;
    } catch (error) {
      this.logger.error('Error during DLQ cleanup', {
        olderThanDays,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return 0;
    }
  }

  /**
   * Get unresolved entry count
   *
   * Returns count of unresolved DLQ entries for alerting.
   * Called by AlertService (Task 14).
   *
   * @param vendorId - Optional vendor filter
   * @returns Count of unresolved entries
   */
  async getUnresolvedCount(vendorId?: string): Promise<number> {
    try {
      const count = await this.dlqRepository.countUnresolved(vendorId);
      return count;
    } catch (error) {
      this.logger.error('Error counting unresolved DLQ entries', {
        vendorId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return 0;
    }
  }
}
