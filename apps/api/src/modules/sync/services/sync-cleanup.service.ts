import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { SyncJobsRepository } from '../../../database/adapters/nestjs-sync-jobs.repository';
import { ReconciliationEventsRepository } from '../../../database/adapters/nestjs-reconciliation-events.repository';
import { DeadLetterQueueRepository } from '../../../database/adapters/nestjs-dead-letter-queue.repository';

@Injectable()
export class SyncCleanupService {
  constructor(
    private readonly syncJobsRepository: SyncJobsRepository,
    private readonly reconciliationEventsRepository: ReconciliationEventsRepository,
    private readonly dlqRepository: DeadLetterQueueRepository,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(SyncCleanupService.name);
  }

  /**
   * Delete expired sync jobs
   * Runs daily at 2 AM
   */
  async cleanupExpiredJobs(): Promise<number> {
    try {
      this.logger.info('Starting cleanup of expired sync jobs');

      const now = new Date();
      const deletedCount = await this.syncJobsRepository.deleteExpired(now);

      this.logger.info({ deletedCount }, `Cleanup completed: deleted ${deletedCount} expired jobs`);

      return deletedCount;
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to cleanup expired jobs',
      );
      return 0;
    }
  }

  /**
   * Archive (delete) old reconciliation events
   * Default: older than 30 days
   * Runs weekly on Sunday at 3 AM
   */
  async archiveReconciliationEvents(olderThanDays = 30): Promise<number> {
    try {
      this.logger.info({ olderThanDays }, 'Starting archive of old reconciliation events');

      const deletedCount = await this.reconciliationEventsRepository.deleteOlderThan(olderThanDays);

      this.logger.info(
        { deletedCount, olderThanDays },
        `Archive completed: deleted ${deletedCount} reconciliation events`,
      );

      return deletedCount;
    } catch (error) {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          olderThanDays,
        },
        'Failed to archive reconciliation events',
      );
      return 0;
    }
  }

  /**
   * Delete old resolved DLQ entries
   * Default: older than 30 days
   * Runs weekly on Saturday at 4 AM
   */
  async cleanupResolvedDLQ(olderThanDays = 30): Promise<number> {
    try {
      this.logger.info({ olderThanDays }, 'Starting cleanup of resolved DLQ entries');

      const deletedCount = await this.dlqRepository.deleteOldResolved(olderThanDays);

      this.logger.info(
        { deletedCount, olderThanDays },
        `Cleanup completed: deleted ${deletedCount} resolved DLQ entries`,
      );

      return deletedCount;
    } catch (error) {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          olderThanDays,
        },
        'Failed to cleanup resolved DLQ entries',
      );
      return 0;
    }
  }
}
