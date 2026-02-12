import { and, count, desc, eq, isNull, lt, or, sql } from 'drizzle-orm';
import { BaseRepository } from '../base/base.repository.js';
import { agentRegistry } from '../../schema/index.js';
import type { Agent, NewAgent } from '../../../types/database.types.js';

/**
 * Agent Registry Repository Base
 *
 * Framework-agnostic repository for ERP agent lifecycle management.
 * Handles registration, heartbeat tracking, and health monitoring.
 */
export class AgentRegistryRepositoryBase extends BaseRepository<typeof agentRegistry> {
  /**
   * Upsert agent (insert or update on conflict)
   */
  async upsert(data: NewAgent): Promise<Agent | null> {
    try {
      const [agent] = await this.db
        .insert(agentRegistry)
        .values(data)
        .onConflictDoUpdate({
          target: agentRegistry.vendorId,
          set: {
            agentUrl: data.agentUrl,
            erpType: data.erpType,
            authTokenHash: data.authTokenHash,
            version: data.version,
            status: data.status ?? 'offline',
            lastHeartbeat: data.lastHeartbeat,
            updatedAt: sql`now()`,
          },
        })
        .returning();

      if (!agent) {
        this.logger.error('Failed to upsert agent - no row returned', {
          vendorId: data.vendorId,
        });
        return null;
      }

      this.logger.info('Agent upserted successfully', {
        vendorId: agent.vendorId,
        status: agent.status,
      });
      return agent;
    } catch (error) {
      this.handleError('UPSERT', error, { vendorId: data.vendorId });
      return null;
    }
  }

  /**
   * Find agent by vendor ID
   */
  async findByVendorId(vendorId: string): Promise<Agent | null> {
    try {
      const [agent] = await this.db
        .select()
        .from(agentRegistry)
        .where(eq(agentRegistry.vendorId, vendorId))
        .limit(1);

      return agent ?? null;
    } catch (error) {
      this.handleError('FIND_BY_VENDOR_ID', error, { vendorId });
      return null;
    }
  }

  /**
   * Find all agents
   */
  async findAll(): Promise<Agent[]> {
    try {
      const agents = await this.db
        .select()
        .from(agentRegistry)
        .orderBy(desc(agentRegistry.createdAt));

      return agents;
    } catch (error) {
      this.handleError('FIND_ALL', error);
      return [];
    }
  }

  /**
   * Find active agents (online or degraded)
   */
  async findActive(): Promise<Agent[]> {
    try {
      const agents = await this.db
        .select()
        .from(agentRegistry)
        .where(or(eq(agentRegistry.status, 'online'), eq(agentRegistry.status, 'degraded')))
        .orderBy(desc(agentRegistry.lastHeartbeat));

      return agents;
    } catch (error) {
      this.handleError('FIND_ACTIVE', error);
      return [];
    }
  }

  /**
   * Update agent heartbeat
   */
  async updateHeartbeat(vendorId: string, version?: string): Promise<Agent | null> {
    try {
      const updateData: Record<string, unknown> = {
        lastHeartbeat: sql`now()`,
        status: 'online',
        updatedAt: sql`now()`,
      };

      if (version) {
        updateData.version = version;
      }

      const [agent] = await this.db
        .update(agentRegistry)
        .set(updateData)
        .where(eq(agentRegistry.vendorId, vendorId))
        .returning();

      if (!agent) {
        this.logger.warn('Agent not found for heartbeat update', { vendorId });
        return null;
      }

      return agent;
    } catch (error) {
      this.handleError('UPDATE_HEARTBEAT', error, { vendorId });
      return null;
    }
  }

  /**
   * Find stale agents (for health monitoring)
   * @param degradedThresholdMs - Milliseconds after which agent is considered degraded (default: 60s)
   * @param offlineThresholdMs - Milliseconds after which agent is considered offline (default: 300s)
   */
  async findStale(
    degradedThresholdMs = 60_000,
    offlineThresholdMs = 300_000,
  ): Promise<{ degraded: Agent[]; offline: Agent[] }> {
    try {
      const now = new Date();
      const degradedCutoff = new Date(now.getTime() - degradedThresholdMs);
      const offlineCutoff = new Date(now.getTime() - offlineThresholdMs);

      const allAgents = await this.db.select().from(agentRegistry);

      const degraded: Agent[] = [];
      const offline: Agent[] = [];

      for (const agent of allAgents) {
        // Skip if no heartbeat yet
        if (!agent.lastHeartbeat) {
          if (agent.status !== 'offline') {
            offline.push(agent);
          }
          continue;
        }

        const heartbeatTime = agent.lastHeartbeat.getTime();

        // Check if offline (> offlineThresholdMs)
        if (heartbeatTime < offlineCutoff.getTime()) {
          if (agent.status !== 'offline') {
            offline.push(agent);
          }
        }
        // Check if degraded (> degradedThresholdMs but < offlineThresholdMs)
        else if (heartbeatTime < degradedCutoff.getTime()) {
          if (agent.status !== 'degraded') {
            degraded.push(agent);
          }
        }
      }

      return { degraded, offline };
    } catch (error) {
      this.handleError('FIND_STALE', error, { degradedThresholdMs, offlineThresholdMs });
      return { degraded: [], offline: [] };
    }
  }

  /**
   * Update agent status
   */
  async updateStatus(
    vendorId: string,
    status: 'online' | 'offline' | 'degraded',
  ): Promise<Agent | null> {
    try {
      const [agent] = await this.db
        .update(agentRegistry)
        .set({
          status,
          updatedAt: sql`now()`,
        })
        .where(eq(agentRegistry.vendorId, vendorId))
        .returning();

      if (!agent) {
        this.logger.warn('Agent not found for status update', { vendorId, status });
        return null;
      }

      this.logger.info('Agent status updated', { vendorId, status });
      return agent;
    } catch (error) {
      this.handleError('UPDATE_STATUS', error, { vendorId, status });
      return null;
    }
  }

  /**
   * Delete agent by vendor ID (hard delete for deregistration)
   */
  async deleteByVendorId(vendorId: string): Promise<boolean> {
    try {
      const result = await this.db
        .delete(agentRegistry)
        .where(eq(agentRegistry.vendorId, vendorId))
        .returning({ id: agentRegistry.id });

      if (result.length === 0) {
        this.logger.warn('Agent not found for deletion', { vendorId });
        return false;
      }

      this.logger.info('Agent deleted successfully', { vendorId });
      return true;
    } catch (error) {
      this.handleError('DELETE_BY_VENDOR_ID', error, { vendorId });
      return false;
    }
  }

  /**
   * Count agents by status
   */
  async countByStatus(): Promise<{
    online: number;
    degraded: number;
    offline: number;
    total: number;
  }> {
    try {
      const [result] = await this.db
        .select({
          total: count(),
          online: sql<number>`count(*) filter (where ${agentRegistry.status} = 'online')`,
          degraded: sql<number>`count(*) filter (where ${agentRegistry.status} = 'degraded')`,
          offline: sql<number>`count(*) filter (where ${agentRegistry.status} = 'offline')`,
        })
        .from(agentRegistry);

      if (!result) {
        return { online: 0, degraded: 0, offline: 0, total: 0 };
      }

      return {
        total: Number(result.total),
        online: Number(result.online),
        degraded: Number(result.degraded),
        offline: Number(result.offline),
      };
    } catch (error) {
      this.handleError('COUNT_BY_STATUS', error);
      return { online: 0, degraded: 0, offline: 0, total: 0 };
    }
  }
}
