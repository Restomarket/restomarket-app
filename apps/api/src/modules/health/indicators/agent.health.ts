import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { AgentRegistryRepository } from '../../../database/adapters/nestjs-agent-registry.repository';

export interface AgentHealthIndicator {
  status: 'up' | 'down' | 'degraded';
  online: number;
  total: number;
  message?: string;
}

@Injectable()
export class AgentHealthService {
  constructor(
    private readonly agentRegistry: AgentRegistryRepository,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AgentHealthService.name);
  }

  async check(): Promise<AgentHealthIndicator> {
    try {
      const agents = await this.agentRegistry.findAll();

      if (!agents || agents.length === 0) {
        return {
          status: 'down',
          online: 0,
          total: 0,
          message: 'No agents registered',
        };
      }

      const onlineCount = agents.filter(a => a.status === 'online').length;
      const total = agents.length;

      // Status logic:
      // - up: at least one agent online
      // - degraded: agents exist but all offline/degraded
      // - down: no agents
      let status: 'up' | 'down' | 'degraded';
      if (onlineCount > 0) {
        status = 'up';
      } else {
        status = 'degraded';
      }

      return {
        status,
        online: onlineCount,
        total,
        ...(onlineCount === 0 && { message: 'All agents offline or degraded' }),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown agent health error';
      this.logger.warn({ error: message }, 'Agent health check failed');

      return {
        status: 'down',
        online: 0,
        total: 0,
        message,
      };
    }
  }
}
