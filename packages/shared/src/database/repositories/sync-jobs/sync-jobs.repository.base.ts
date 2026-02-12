import { and, count, desc, eq, gte, lte, sql, type SQL } from 'drizzle-orm';
import { BaseRepository } from '../base/base.repository.js';
import { syncJobs } from '../../schema/index.js';
import type { SyncJob, NewSyncJob } from '../../../types/database.types.js';

/**
 * Sync Jobs Repository Base
 *
 * Framework-agnostic repository for sync job lifecycle management.
 * Handles job creation, status transitions, retry tracking, and metrics.
 */
export class SyncJobsRepositoryBase extends BaseRepository<typeof syncJobs> {
  /**
   * Create a new sync job
   */
  async create(data: NewSyncJob): Promise<SyncJob | null> {
    try {
      const [job] = await this.db.insert(syncJobs).values(data).returning();

      if (!job) {
        this.logger.error('Failed to create sync job - no row returned', {
          operation: data.operation,
          vendorId: data.vendorId,
        });
        return null;
      }

      this.logger.info('Sync job created successfully', {
        jobId: job.id,
        operation: job.operation,
        vendorId: job.vendorId,
      });
      return job;
    } catch (error) {
      this.handleError('CREATE', error, { operation: data.operation, vendorId: data.vendorId });
      return null;
    }
  }

  /**
   * Find sync job by ID
   */
  async findById(id: string): Promise<SyncJob | null> {
    try {
      const [job] = await this.db.select().from(syncJobs).where(eq(syncJobs.id, id)).limit(1);

      return job ?? null;
    } catch (error) {
      this.handleError('FIND_BY_ID', error, { id });
      return null;
    }
  }

  /**
   * Find sync job by order ID
   */
  async findByOrderId(orderId: string): Promise<SyncJob | null> {
    try {
      const [job] = await this.db
        .select()
        .from(syncJobs)
        .where(eq(syncJobs.postgresOrderId, orderId))
        .orderBy(desc(syncJobs.createdAt))
        .limit(1);

      return job ?? null;
    } catch (error) {
      this.handleError('FIND_BY_ORDER_ID', error, { orderId });
      return null;
    }
  }

  /**
   * Update job status
   */
  async updateStatus(
    id: string,
    status: string,
    additionalData?: {
      errorMessage?: string;
      errorStack?: string;
      erpReference?: string;
      retryCount?: number;
      nextRetryAt?: Date;
    },
  ): Promise<SyncJob | null> {
    try {
      const updateData: Record<string, unknown> = {
        status,
        updatedAt: this.getUpdatedTimestamp(),
      };

      if (status === 'processing') {
        updateData.startedAt = this.getUpdatedTimestamp();
      }

      if (status === 'completed') {
        updateData.completedAt = this.getUpdatedTimestamp();
        if (additionalData?.erpReference) {
          updateData.erpReference = additionalData.erpReference;
        }
      }

      if (status === 'failed' && additionalData) {
        updateData.errorMessage = additionalData.errorMessage;
        updateData.errorStack = additionalData.errorStack;
        if (additionalData.retryCount !== undefined) {
          updateData.retryCount = additionalData.retryCount;
        }
        if (additionalData.nextRetryAt) {
          updateData.nextRetryAt = additionalData.nextRetryAt;
        }
      }

      const [job] = await this.db
        .update(syncJobs)
        .set(updateData)
        .where(eq(syncJobs.id, id))
        .returning();

      if (!job) {
        this.logger.warn('Sync job not found for status update', { id, status });
        return null;
      }

      this.logger.info('Sync job status updated', { jobId: id, status });
      return job;
    } catch (error) {
      this.handleError('UPDATE_STATUS', error, { id, status });
      return null;
    }
  }

  /**
   * Find pending jobs (optionally filtered by vendor)
   */
  async findPending(vendorId?: string, limit = 100): Promise<SyncJob[]> {
    try {
      const conditions = [eq(syncJobs.status, 'pending')];
      if (vendorId) {
        conditions.push(eq(syncJobs.vendorId, vendorId));
      }

      const jobs = await this.db
        .select()
        .from(syncJobs)
        .where(and(...conditions))
        .orderBy(syncJobs.createdAt)
        .limit(limit);

      return jobs;
    } catch (error) {
      this.handleError('FIND_PENDING', error, { vendorId });
      return [];
    }
  }

  /**
   * Find expired jobs (for cleanup)
   */
  async findExpired(beforeDate: Date, limit = 1000): Promise<SyncJob[]> {
    try {
      const jobs = await this.db
        .select()
        .from(syncJobs)
        .where(lte(syncJobs.expiresAt, beforeDate))
        .limit(limit);

      return jobs;
    } catch (error) {
      this.handleError('FIND_EXPIRED', error, { beforeDate });
      return [];
    }
  }

  /**
   * Count jobs by status (optionally filtered by vendor)
   */
  async countByStatus(status: string, vendorId?: string): Promise<number> {
    try {
      const conditions: SQL<unknown>[] = [eq(syncJobs.status, status)];
      if (vendorId) {
        conditions.push(eq(syncJobs.vendorId, vendorId));
      }

      const [result] = await this.db
        .select({ value: count() })
        .from(syncJobs)
        .where(and(...conditions));

      return Number(result?.value ?? 0);
    } catch (error) {
      this.handleError('COUNT_BY_STATUS', error, { status, vendorId });
      return 0;
    }
  }

  /**
   * Get sync job metrics for a vendor
   */
  async getMetrics(vendorId: string): Promise<{
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    avgLatencyMs: number;
    retryRate: number;
  }> {
    try {
      const [result] = await this.db
        .select({
          total: count(),
          pending: sql<number>`count(*) filter (where ${syncJobs.status} = 'pending')`,
          processing: sql<number>`count(*) filter (where ${syncJobs.status} = 'processing')`,
          completed: sql<number>`count(*) filter (where ${syncJobs.status} = 'completed')`,
          failed: sql<number>`count(*) filter (where ${syncJobs.status} = 'failed')`,
          avgLatency: sql<number>`avg(extract(epoch from (${syncJobs.completedAt} - ${syncJobs.createdAt})) * 1000) filter (where ${syncJobs.status} = 'completed')`,
          retried: sql<number>`count(*) filter (where ${syncJobs.retryCount} > 0)`,
        })
        .from(syncJobs)
        .where(eq(syncJobs.vendorId, vendorId));

      if (!result) {
        return {
          total: 0,
          pending: 0,
          processing: 0,
          completed: 0,
          failed: 0,
          avgLatencyMs: 0,
          retryRate: 0,
        };
      }

      const total = Number(result.total);
      const retried = Number(result.retried);
      const avgLatency = result.avgLatency ? Number(result.avgLatency) : 0;

      return {
        total,
        pending: Number(result.pending),
        processing: Number(result.processing),
        completed: Number(result.completed),
        failed: Number(result.failed),
        avgLatencyMs: Math.round(avgLatency),
        retryRate: total > 0 ? Number(((retried / total) * 100).toFixed(2)) : 0,
      };
    } catch (error) {
      this.handleError('GET_METRICS', error, { vendorId });
      return {
        total: 0,
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        avgLatencyMs: 0,
        retryRate: 0,
      };
    }
  }

  /**
   * Delete expired jobs (for cleanup)
   */
  async deleteExpired(beforeDate: Date, limit = 1000): Promise<number> {
    try {
      const result = await this.db
        .delete(syncJobs)
        .where(lte(syncJobs.expiresAt, beforeDate))
        .returning({ id: syncJobs.id });

      this.logger.info('Expired sync jobs deleted', { count: result.length });
      return result.length;
    } catch (error) {
      this.handleError('DELETE_EXPIRED', error, { beforeDate });
      return 0;
    }
  }

  /**
   * Find recent jobs (paginated)
   */
  async findRecent(
    vendorId?: string,
    page = 1,
    limit = 50,
  ): Promise<{ data: SyncJob[]; total: number }> {
    try {
      const conditions: SQL<unknown>[] = [];
      if (vendorId) {
        conditions.push(eq(syncJobs.vendorId, vendorId));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [data, countResult] = await Promise.all([
        this.db
          .select()
          .from(syncJobs)
          .where(whereClause)
          .orderBy(desc(syncJobs.createdAt))
          .limit(limit)
          .offset((page - 1) * limit),

        this.db.select({ value: count() }).from(syncJobs).where(whereClause),
      ]);

      const total = Number(countResult[0]?.value ?? 0);

      return { data, total };
    } catch (error) {
      this.handleError('FIND_RECENT', error, { vendorId, page, limit });
      return { data: [], total: 0 };
    }
  }
}
