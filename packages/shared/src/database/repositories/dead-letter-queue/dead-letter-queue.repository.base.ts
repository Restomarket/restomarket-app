import { and, count, desc, eq, lt, sql } from 'drizzle-orm';
import { BaseRepository } from '../base/base.repository.js';
import { deadLetterQueue } from '../../schema/index.js';
import type {
  DeadLetterQueueEntry,
  NewDeadLetterQueueEntry,
} from '../../../types/database.types.js';

/**
 * Dead Letter Queue Repository Base
 *
 * Framework-agnostic repository for permanently failed sync jobs.
 * Handles DLQ entry creation, retry, resolution, and cleanup.
 */
export class DeadLetterQueueRepositoryBase extends BaseRepository<typeof deadLetterQueue> {
  /**
   * Create DLQ entry
   */
  async create(data: NewDeadLetterQueueEntry): Promise<DeadLetterQueueEntry | null> {
    try {
      const [entry] = await this.db.insert(deadLetterQueue).values(data).returning();

      if (!entry) {
        this.logger.error('Failed to create DLQ entry - no row returned', {
          vendorId: data.vendorId,
          operation: data.operation,
        });
        return null;
      }

      this.logger.info('DLQ entry created', {
        dlqId: entry.id,
        vendorId: entry.vendorId,
        operation: entry.operation,
      });
      return entry;
    } catch (error) {
      this.handleError('CREATE', error, { vendorId: data.vendorId, operation: data.operation });
      return null;
    }
  }

  /**
   * Find DLQ entry by ID
   */
  async findById(id: string): Promise<DeadLetterQueueEntry | null> {
    try {
      const [entry] = await this.db
        .select()
        .from(deadLetterQueue)
        .where(eq(deadLetterQueue.id, id))
        .limit(1);

      return entry ?? null;
    } catch (error) {
      this.handleError('FIND_BY_ID', error, { id });
      return null;
    }
  }

  /**
   * Find unresolved entries (paginated, optionally filtered by vendor)
   */
  async findUnresolved(
    vendorId?: string,
    page = 1,
    limit = 50,
  ): Promise<{ data: DeadLetterQueueEntry[]; total: number }> {
    try {
      const conditions = [eq(deadLetterQueue.resolved, false)];
      if (vendorId) {
        conditions.push(eq(deadLetterQueue.vendorId, vendorId));
      }

      const whereClause = and(...conditions);

      const [data, countResult] = await Promise.all([
        this.db
          .select()
          .from(deadLetterQueue)
          .where(whereClause)
          .orderBy(desc(deadLetterQueue.createdAt))
          .limit(limit)
          .offset((page - 1) * limit),

        this.db.select({ value: count() }).from(deadLetterQueue).where(whereClause),
      ]);

      const total = Number(countResult[0]?.value ?? 0);

      return { data, total };
    } catch (error) {
      this.handleError('FIND_UNRESOLVED', error, { vendorId, page, limit });
      return { data: [], total: 0 };
    }
  }

  /**
   * Mark DLQ entry as resolved
   */
  async markResolved(id: string, resolvedBy: string): Promise<DeadLetterQueueEntry | null> {
    try {
      const [entry] = await this.db
        .update(deadLetterQueue)
        .set({
          resolved: true,
          resolvedAt: sql`now()`,
          resolvedBy,
        })
        .where(eq(deadLetterQueue.id, id))
        .returning();

      if (!entry) {
        this.logger.warn('DLQ entry not found for resolution', { id });
        return null;
      }

      this.logger.info('DLQ entry marked as resolved', { dlqId: id, resolvedBy });
      return entry;
    } catch (error) {
      this.handleError('MARK_RESOLVED', error, { id, resolvedBy });
      return null;
    }
  }

  /**
   * Update attempt count (for manual retries)
   */
  async updateAttemptCount(id: string): Promise<DeadLetterQueueEntry | null> {
    try {
      const [entry] = await this.db
        .update(deadLetterQueue)
        .set({
          attemptCount: sql`${deadLetterQueue.attemptCount} + 1`,
          lastAttemptAt: sql`now()`,
        })
        .where(eq(deadLetterQueue.id, id))
        .returning();

      if (!entry) {
        this.logger.warn('DLQ entry not found for attempt count update', { id });
        return null;
      }

      return entry;
    } catch (error) {
      this.handleError('UPDATE_ATTEMPT_COUNT', error, { id });
      return null;
    }
  }

  /**
   * Delete old resolved entries (for cleanup)
   */
  async deleteOldResolved(olderThanDays: number): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const result = await this.db
        .delete(deadLetterQueue)
        .where(and(eq(deadLetterQueue.resolved, true), lt(deadLetterQueue.resolvedAt, cutoffDate)))
        .returning({ id: deadLetterQueue.id });

      this.logger.info('Old resolved DLQ entries deleted', { count: result.length, olderThanDays });
      return result.length;
    } catch (error) {
      this.handleError('DELETE_OLD_RESOLVED', error, { olderThanDays });
      return 0;
    }
  }

  /**
   * Count unresolved entries (for alerting)
   */
  async countUnresolved(vendorId?: string): Promise<number> {
    try {
      const conditions = [eq(deadLetterQueue.resolved, false)];
      if (vendorId) {
        conditions.push(eq(deadLetterQueue.vendorId, vendorId));
      }

      const [result] = await this.db
        .select({ value: count() })
        .from(deadLetterQueue)
        .where(and(...conditions));

      return Number(result?.value ?? 0);
    } catch (error) {
      this.handleError('COUNT_UNRESOLVED', error, { vendorId });
      return 0;
    }
  }

  /**
   * Find entries by original job ID
   */
  async findByOriginalJobId(originalJobId: string): Promise<DeadLetterQueueEntry[]> {
    try {
      const entries = await this.db
        .select()
        .from(deadLetterQueue)
        .where(eq(deadLetterQueue.originalJobId, originalJobId))
        .orderBy(desc(deadLetterQueue.createdAt));

      return entries;
    } catch (error) {
      this.handleError('FIND_BY_ORIGINAL_JOB_ID', error, { originalJobId });
      return [];
    }
  }

  /**
   * Find all entries (paginated)
   */
  async findAll(page = 1, limit = 50): Promise<{ data: DeadLetterQueueEntry[]; total: number }> {
    try {
      const [data, countResult] = await Promise.all([
        this.db
          .select()
          .from(deadLetterQueue)
          .orderBy(desc(deadLetterQueue.createdAt))
          .limit(limit)
          .offset((page - 1) * limit),

        this.db.select({ value: count() }).from(deadLetterQueue),
      ]);

      const total = Number(countResult[0]?.value ?? 0);

      return { data, total };
    } catch (error) {
      this.handleError('FIND_ALL', error, { page, limit });
      return { data: [], total: 0 };
    }
  }
}
