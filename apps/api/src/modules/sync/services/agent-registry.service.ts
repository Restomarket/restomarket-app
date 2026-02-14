import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import * as bcrypt from 'bcrypt';
import { AgentRegistryRepository } from '../../../database/adapters';
import { RegisterAgentDto } from '../dto/agent-register.dto';
import type { Agent } from '@repo/shared';

/**
 * Agent Registry Service
 *
 * Manages the full lifecycle of ERP agents:
 * - Registration with secure token hashing
 * - Heartbeat tracking for health monitoring
 * - Status transitions (online -> degraded -> offline)
 * - Deregistration
 */
@Injectable()
export class AgentRegistryService {
  constructor(
    private readonly agentRepository: AgentRegistryRepository,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AgentRegistryService.name);
  }

  /**
   * Register or update an agent
   * Hashes the auth token with bcrypt before storing
   */
  async register(dto: RegisterAgentDto): Promise<Omit<Agent, 'authTokenHash'> | null> {
    this.logger.info('Registering agent', { vendorId: dto.vendorId, erpType: dto.erpType });

    try {
      // Hash the token with bcrypt (10 rounds)
      const authTokenHash = await bcrypt.hash(dto.authToken, 10);

      // Upsert agent (update if vendorId exists)
      const agent = await this.agentRepository.upsert({
        vendorId: dto.vendorId,
        agentUrl: dto.agentUrl,
        erpType: dto.erpType as 'ebp' | 'sage' | 'odoo' | 'custom',
        authTokenHash,
        version: dto.version,
        status: 'online',
        lastHeartbeat: new Date(),
      });

      if (!agent) {
        this.logger.error('Failed to register agent', { vendorId: dto.vendorId });
        return null;
      }

      // Return agent without sensitive hash
      const { authTokenHash: _, ...agentWithoutHash } = agent;
      return agentWithoutHash;
    } catch (error) {
      this.logger.error('Error during agent registration', {
        vendorId: dto.vendorId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Update agent heartbeat
   * Sets status to 'online' and updates lastHeartbeat timestamp
   */
  async heartbeat(vendorId: string, version?: string): Promise<Agent | null> {
    this.logger.debug('Agent heartbeat received', { vendorId, version });

    const agent = await this.agentRepository.updateHeartbeat(vendorId, version);

    if (!agent) {
      this.logger.warn('Heartbeat failed - agent not found', { vendorId });
      return null;
    }

    return agent;
  }

  /**
   * Deregister an agent
   * Sets status to 'offline' (soft delete - keeps record for audit)
   */
  async deregister(vendorId: string): Promise<boolean> {
    this.logger.info('Deregistering agent', { vendorId });

    const agent = await this.agentRepository.updateStatus(vendorId, 'offline');

    if (!agent) {
      this.logger.warn('Deregistration failed - agent not found', { vendorId });
      return false;
    }

    return true;
  }

  /**
   * Get a single agent by vendor ID
   * Returns agent without sensitive hash
   */
  async getAgent(vendorId: string): Promise<Omit<Agent, 'authTokenHash'> | null> {
    const agent = await this.agentRepository.findByVendorId(vendorId);

    if (!agent) {
      return null;
    }

    const { authTokenHash: _, ...agentWithoutHash } = agent;
    return agentWithoutHash;
  }

  /**
   * Get all agents with computed health status
   * Returns agents without sensitive hashes
   */
  async getAllAgents(): Promise<Omit<Agent, 'authTokenHash'>[]> {
    const agents = await this.agentRepository.findAll();

    // Remove sensitive hashes from all agents
    return agents.map(agent => {
      const { authTokenHash: _, ...agentWithoutHash } = agent;
      return agentWithoutHash;
    });
  }

  /**
   * Check agent health and update status based on heartbeat staleness
   *
   * Status transitions:
   * - online: heartbeat within last 60 seconds
   * - degraded: heartbeat 60-300 seconds ago
   * - offline: heartbeat > 300 seconds ago (or never)
   *
   * @returns Agents whose status changed (for alerting)
   */
  async checkHealth(): Promise<{ vendorId: string; oldStatus: string; newStatus: string }[]> {
    this.logger.debug('Running agent health check');

    const { degraded: degradedAgents, offline: offlineAgents } =
      await this.agentRepository.findStale(
        60_000, // 60 seconds for degraded
        300_000, // 300 seconds (5 minutes) for offline
      );

    const statusChanges: { vendorId: string; oldStatus: string; newStatus: string }[] = [];

    // Update degraded agents
    for (const agent of degradedAgents) {
      const updated = await this.agentRepository.updateStatus(agent.vendorId, 'degraded');
      if (updated) {
        statusChanges.push({
          vendorId: agent.vendorId,
          oldStatus: agent.status,
          newStatus: 'degraded',
        });
        this.logger.warn('Agent degraded due to stale heartbeat', {
          vendorId: agent.vendorId,
          lastHeartbeat: agent.lastHeartbeat,
        });
      }
    }

    // Update offline agents
    for (const agent of offlineAgents) {
      const updated = await this.agentRepository.updateStatus(agent.vendorId, 'offline');
      if (updated) {
        statusChanges.push({
          vendorId: agent.vendorId,
          oldStatus: agent.status,
          newStatus: 'offline',
        });
        this.logger.error('Agent offline due to stale heartbeat', {
          vendorId: agent.vendorId,
          lastHeartbeat: agent.lastHeartbeat,
        });
      }
    }

    if (statusChanges.length > 0) {
      this.logger.info('Agent health check completed', {
        statusChanges: statusChanges.length,
        degraded: degradedAgents.length,
        offline: offlineAgents.length,
      });
    }

    return statusChanges;
  }

  /**
   * Get agent count by status (for health dashboard)
   */
  async getAgentStats(): Promise<{
    online: number;
    degraded: number;
    offline: number;
    total: number;
  }> {
    return this.agentRepository.countByStatus();
  }
}
