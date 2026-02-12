import { Injectable } from '@nestjs/common';
import { Cron, CronExpression, Interval } from '@nestjs/schedule';
import { PinoLogger } from 'nestjs-pino';
import { ReconciliationService } from '../services/reconciliation.service';
import { AgentRegistryService } from '../services/agent-registry.service';
import { DeadLetterQueueService } from '../services/dead-letter-queue.service';
import { SyncCleanupService } from '../services/sync-cleanup.service';
import { AlertService } from '../services/alert.service';

@Injectable()
export class SyncSchedulerService {
  constructor(
    private readonly reconciliationService: ReconciliationService,
    private readonly agentRegistryService: AgentRegistryService,
    private readonly dlqService: DeadLetterQueueService,
    private readonly cleanupService: SyncCleanupService,
    private readonly alertService: AlertService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(SyncSchedulerService.name);
  }

  /**
   * Detect drift between ERP and PostgreSQL
   * Runs hourly (on the hour)
   */
  @Cron(CronExpression.EVERY_HOUR)
  async detectDrift(): Promise<void> {
    try {
      this.logger.info('Starting scheduled drift detection');

      const result = await this.reconciliationService.triggerFullSyncAll();

      this.logger.info(
        {
          vendorsProcessed: result.length,
          driftDetected: result.filter(r => r.hasDrift).length,
        },
        'Scheduled drift detection completed',
      );

      // Send alerts for vendors with drift
      for (const vendorResult of result) {
        if (
          vendorResult.hasDrift &&
          vendorResult.driftedItems &&
          vendorResult.driftedItems.length > 0
        ) {
          await this.alertService.sendAlert(
            'reconciliation_drift',
            `Drift detected and resolved for vendor ${vendorResult.vendorId}`,
            {
              vendorId: vendorResult.vendorId,
              count: vendorResult.driftedItems.length,
              details: {
                driftedSkusFound: vendorResult.driftedItems.length,
              },
            },
          );
        }
      }
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to run scheduled drift detection',
      );
    }
  }

  /**
   * Check agent health and update status
   * Runs every 5 minutes
   */
  @Interval(300_000) // 5 minutes = 300,000ms
  async checkAgentHealth(): Promise<void> {
    try {
      this.logger.debug('Starting scheduled agent health check');

      const changedAgents = await this.agentRegistryService.checkHealth();

      if (changedAgents.length > 0) {
        this.logger.info(
          {
            changedCount: changedAgents.length,
            agents: changedAgents.map(a => ({ vendorId: a.vendorId, newStatus: a.newStatus })),
          },
          'Agent status changes detected',
        );

        // Send alerts for agents that went offline
        for (const agent of changedAgents) {
          if (agent.newStatus === 'offline') {
            await this.alertService.sendAlert(
              'agent_offline',
              `Agent ${agent.vendorId} is now offline`,
              {
                vendorId: agent.vendorId,
                details: {
                  oldStatus: agent.oldStatus,
                  newStatus: agent.newStatus,
                },
              },
            );
          }
        }
      } else {
        this.logger.debug('No agent status changes detected');
      }
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to run scheduled agent health check',
      );
    }
  }

  /**
   * Check for unresolved DLQ entries and alert if needed
   * Runs every 15 minutes
   */
  @Interval(900_000) // 15 minutes = 900,000ms
  async checkDLQ(): Promise<void> {
    try {
      this.logger.debug('Starting scheduled DLQ check');

      const unresolvedCount = await this.dlqService.getUnresolvedCount();

      if (unresolvedCount > 0) {
        this.logger.warn({ unresolvedCount }, 'Unresolved DLQ entries found');

        await this.alertService.sendAlert(
          'dlq_entries_found',
          `${unresolvedCount} unresolved entries in Dead Letter Queue`,
          {
            count: unresolvedCount,
            threshold: 0,
          },
        );
      } else {
        this.logger.debug('No unresolved DLQ entries');
      }
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to run scheduled DLQ check',
      );
    }
  }

  /**
   * Cleanup expired sync jobs
   * Runs daily at 2 AM
   */
  @Cron('0 2 * * *')
  async cleanupExpiredJobs(): Promise<void> {
    try {
      this.logger.info('Starting scheduled cleanup of expired jobs');

      const deletedCount = await this.cleanupService.cleanupExpiredJobs();

      this.logger.info({ deletedCount }, 'Scheduled job cleanup completed');
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to run scheduled job cleanup',
      );
    }
  }

  /**
   * Archive old reconciliation events
   * Runs weekly on Sunday at 3 AM
   */
  @Cron('0 3 * * 0')
  async archiveReconEvents(): Promise<void> {
    try {
      this.logger.info('Starting scheduled archive of reconciliation events');

      const deletedCount = await this.cleanupService.archiveReconciliationEvents(30);

      this.logger.info({ deletedCount }, 'Scheduled reconciliation events archive completed');
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to run scheduled reconciliation events archive',
      );
    }
  }

  /**
   * Cleanup old resolved DLQ entries
   * Runs weekly on Saturday at 4 AM
   */
  @Cron('0 4 * * 6')
  async cleanupResolvedDLQ(): Promise<void> {
    try {
      this.logger.info('Starting scheduled cleanup of resolved DLQ entries');

      const deletedCount = await this.cleanupService.cleanupResolvedDLQ(30);

      this.logger.info({ deletedCount }, 'Scheduled DLQ cleanup completed');
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to run scheduled DLQ cleanup',
      );
    }
  }
}
