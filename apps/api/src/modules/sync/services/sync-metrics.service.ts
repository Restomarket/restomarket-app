import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import {
  SyncJobsRepository,
  ReconciliationEventsRepository,
  AgentRegistryRepository,
} from '../../../database/adapters';

/**
 * SyncMetricsService
 *
 * Provides PostgreSQL aggregation queries for sync operations:
 * - Sync job metrics (latency, success rate, retry rate)
 * - Reconciliation metrics (event counts, drift frequency)
 * - Agent health metrics (status, heartbeat, uptime)
 * - Individual job details
 *
 * All metrics methods query existing repository aggregations.
 */
@Injectable()
export class SyncMetricsService {
  constructor(
    private readonly syncJobsRepo: SyncJobsRepository,
    private readonly reconciliationRepo: ReconciliationEventsRepository,
    private readonly agentRepo: AgentRegistryRepository,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(SyncMetricsService.name);
  }

  /**
   * Get sync job metrics for a vendor
   *
   * Returns aggregated metrics:
   * - Total, pending, processing, completed, failed counts
   * - Success rate percentage
   * - Average latency (milliseconds)
   * - P95 latency (milliseconds) — TODO: requires percentile implementation
   * - Retry rate percentage
   */
  async getSyncMetrics(vendorId: string): Promise<{
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    successRate: string;
    avgLatencyMs: number;
    p95LatencyMs: number;
    retryRate: string;
  }> {
    try {
      this.logger.debug('Getting sync metrics', { vendorId });

      const metrics = await this.syncJobsRepo.getMetrics(vendorId);

      // Calculate success rate
      const successRate =
        metrics.total > 0 ? ((metrics.completed / metrics.total) * 100).toFixed(1) : '0.0';

      // Format retry rate
      const retryRate = metrics.retryRate.toFixed(1);

      // P95 latency requires percentile_cont aggregation — simplified to avgLatency for now
      // TODO: Implement P95 calculation with percentile_cont in repository
      const p95LatencyMs = Math.round(metrics.avgLatencyMs * 1.5); // Approximation

      this.logger.debug('Sync metrics retrieved', {
        vendorId,
        total: metrics.total,
        successRate,
      });

      return {
        total: metrics.total,
        pending: metrics.pending,
        processing: metrics.processing,
        completed: metrics.completed,
        failed: metrics.failed,
        successRate,
        avgLatencyMs: metrics.avgLatencyMs,
        p95LatencyMs,
        retryRate,
      };
    } catch (error) {
      this.logger.error('Failed to get sync metrics', {
        vendorId,
        error: error instanceof Error ? error.message : String(error),
      });

      // Return zero metrics on error
      return {
        total: 0,
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        successRate: '0.0',
        avgLatencyMs: 0,
        p95LatencyMs: 0,
        retryRate: '0.0',
      };
    }
  }

  /**
   * Get reconciliation metrics for a vendor
   *
   * Returns aggregated reconciliation event metrics:
   * - Total event count
   * - Drift detected/resolved counts
   * - Full checksum and incremental sync counts
   * - Average duration (milliseconds)
   * - Last run timestamp
   * - Drift frequency percentage (drifts / total checks)
   */
  async getReconciliationMetrics(vendorId: string): Promise<{
    eventCount: number;
    driftDetected: number;
    driftResolved: number;
    fullChecksums: number;
    incrementalSyncs: number;
    avgDurationMs: number;
    lastRun: Date | null;
    driftFrequency: string;
  }> {
    try {
      this.logger.debug('Getting reconciliation metrics', { vendorId });

      const metrics = await this.reconciliationRepo.getMetrics(vendorId);

      // Calculate drift frequency (drift_detected / total checks)
      // Full checksums are "checks", drift_detected events indicate drift found
      const totalChecks = metrics.fullChecksums + metrics.incrementalSyncs;
      const driftFrequency =
        totalChecks > 0 ? ((metrics.driftDetected / totalChecks) * 100).toFixed(1) : '0.0';

      this.logger.debug('Reconciliation metrics retrieved', {
        vendorId,
        eventCount: metrics.totalEvents,
        driftFrequency,
      });

      return {
        eventCount: metrics.totalEvents,
        driftDetected: metrics.driftDetected,
        driftResolved: metrics.driftResolved,
        fullChecksums: metrics.fullChecksums,
        incrementalSyncs: metrics.incrementalSyncs,
        avgDurationMs: metrics.avgDurationMs,
        lastRun: metrics.lastRun,
        driftFrequency,
      };
    } catch (error) {
      this.logger.error('Failed to get reconciliation metrics', {
        vendorId,
        error: error instanceof Error ? error.message : String(error),
      });

      // Return zero metrics on error
      return {
        eventCount: 0,
        driftDetected: 0,
        driftResolved: 0,
        fullChecksums: 0,
        incrementalSyncs: 0,
        avgDurationMs: 0,
        lastRun: null,
        driftFrequency: '0.0',
      };
    }
  }

  /**
   * Get agent health dashboard
   *
   * Returns all agents with:
   * - Status (online, degraded, offline)
   * - Last heartbeat timestamp
   * - Uptime percentage (online time / total time) — TODO: requires tracking
   */
  async getAgentHealth(): Promise<{
    agents: Array<{
      vendorId: string;
      status: string;
      lastHeartbeat: Date | null;
      uptimePercentage: string;
    }>;
    totalAgents: number;
    onlineAgents: number;
    degradedAgents: number;
    offlineAgents: number;
  }> {
    try {
      this.logger.debug('Getting agent health dashboard');

      const allAgents = await this.agentRepo.findAll();

      // Calculate uptime percentage (simplified: online = 100%, degraded = 75%, offline = 0%)
      // TODO: Track actual uptime with historical heartbeat data
      const agents = allAgents.map(agent => {
        let uptimePercentage = '0.0';
        if (agent.status === 'online') {
          uptimePercentage = '100.0';
        } else if (agent.status === 'degraded') {
          uptimePercentage = '75.0';
        }

        return {
          vendorId: agent.vendorId,
          status: agent.status,
          lastHeartbeat: agent.lastHeartbeat,
          uptimePercentage,
        };
      });

      // Count by status
      const onlineAgents = agents.filter(a => a.status === 'online').length;
      const degradedAgents = agents.filter(a => a.status === 'degraded').length;
      const offlineAgents = agents.filter(a => a.status === 'offline').length;

      this.logger.debug('Agent health dashboard retrieved', {
        totalAgents: agents.length,
        onlineAgents,
        degradedAgents,
        offlineAgents,
      });

      return {
        agents,
        totalAgents: agents.length,
        onlineAgents,
        degradedAgents,
        offlineAgents,
      };
    } catch (error) {
      this.logger.error('Failed to get agent health', {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        agents: [],
        totalAgents: 0,
        onlineAgents: 0,
        degradedAgents: 0,
        offlineAgents: 0,
      };
    }
  }

  /**
   * Get job details by ID
   *
   * Returns full sync job record including:
   * - All job fields (id, status, operation, payload, etc.)
   * - Retry tracking (retryCount, nextRetryAt)
   * - Error details (errorMessage, errorStack)
   * - Timestamps (createdAt, startedAt, completedAt, expiresAt)
   */
  async getJobDetails(jobId: string): Promise<{
    id: string;
    postgresOrderId: string | null;
    vendorId: string;
    operation: string;
    status: string;
    payload: Record<string, unknown>;
    retryCount: number;
    maxRetries: number;
    nextRetryAt: Date | null;
    errorMessage: string | null;
    errorStack: string | null;
    erpReference: string | null;
    createdAt: Date;
    startedAt: Date | null;
    completedAt: Date | null;
    expiresAt: Date;
  } | null> {
    try {
      this.logger.debug('Getting job details', { jobId });

      const job = await this.syncJobsRepo.findById(jobId);

      if (!job) {
        this.logger.warn('Job not found', { jobId });
        return null;
      }

      this.logger.debug('Job details retrieved', { jobId, status: job.status });

      return {
        id: job.id,
        postgresOrderId: job.postgresOrderId,
        vendorId: job.vendorId,
        operation: job.operation,
        status: job.status,
        payload: job.payload as Record<string, unknown>,
        retryCount: job.retryCount,
        maxRetries: job.maxRetries,
        nextRetryAt: job.nextRetryAt,
        errorMessage: job.errorMessage,
        errorStack: job.errorStack,
        erpReference: job.erpReference,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        expiresAt: job.expiresAt,
      };
    } catch (error) {
      this.logger.error('Failed to get job details', {
        jobId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }
}
