import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Configuration } from '@config/config.types';
import { DatabaseHealthService } from './indicators/database.health';
import { RedisHealthService } from './indicators/redis.health';
import { BullMQHealthService } from './indicators/bullmq.health';
import { AgentHealthService } from './indicators/agent.health';

export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  environment: string;
  info: {
    database: {
      status: 'up' | 'down';
      responseTime?: number;
      message?: string;
    };
    redis: {
      status: 'up' | 'down';
      responseTime?: number;
      message?: string;
    };
    bullmq: {
      status: 'up' | 'down' | 'warning';
      queues: {
        [queueName: string]: number;
      };
      message?: string;
    };
    agents: {
      status: 'up' | 'down' | 'degraded';
      online: number;
      total: number;
      message?: string;
    };
    memory_heap: {
      status: 'up';
      heapUsed: string;
      heapTotal: string;
    };
    disk: {
      status: 'up';
      rss: string;
      external: string;
    };
  };
}

@Injectable()
export class HealthService {
  constructor(
    private readonly config: ConfigService<Configuration, true>,
    private readonly databaseHealth: DatabaseHealthService,
    private readonly redisHealth: RedisHealthService,
    private readonly bullmqHealth: BullMQHealthService,
    private readonly agentHealth: AgentHealthService,
  ) {}

  async check(): Promise<HealthCheckResponse> {
    // Run all health checks in parallel
    const [database, redis, bullmq, agents] = await Promise.all([
      this.databaseHealth.check(),
      this.redisHealth.check(),
      this.bullmqHealth.check(),
      this.agentHealth.check(),
    ]);

    const memoryUsage = process.memoryUsage();
    const environment = this.config.get('app.nodeEnv', { infer: true });

    // Determine overall health status
    // Unhealthy if database is down
    // Redis is optional in test environments
    // BullMQ warning and agents degraded are not critical failures
    const isHealthy = database.status === 'up' && (environment === 'test' || redis.status === 'up');

    const response: HealthCheckResponse = {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      environment,
      info: {
        database: {
          status: database.status,
          ...(database.responseTime !== undefined && { responseTime: database.responseTime }),
          ...(database.message && { message: database.message }),
        },
        redis: {
          status: redis.status,
          ...(redis.responseTime !== undefined && { responseTime: redis.responseTime }),
          ...(redis.message && { message: redis.message }),
        },
        bullmq: {
          status: bullmq.status,
          queues: bullmq.queues,
          ...(bullmq.message && { message: bullmq.message }),
        },
        agents: {
          status: agents.status,
          online: agents.online,
          total: agents.total,
          ...(agents.message && { message: agents.message }),
        },
        memory_heap: {
          status: 'up',
          heapUsed: this.formatBytes(memoryUsage.heapUsed),
          heapTotal: this.formatBytes(memoryUsage.heapTotal),
        },
        disk: {
          status: 'up',
          rss: this.formatBytes(memoryUsage.rss),
          external: this.formatBytes(memoryUsage.external),
        },
      },
    };

    return response;
  }

  private formatBytes(bytes: number): string {
    const mb = bytes / 1024 / 1024;
    return `${mb.toFixed(2)} MB`;
  }
}
