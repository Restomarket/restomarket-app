import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DATABASE_CONNECTION } from 'src/database/database.module';
import { sql } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { Configuration } from '@config/config.types';

export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  environment: string;
  database: {
    status: 'connected' | 'disconnected' | 'error';
    responseTime: number;
    message?: string;
  };
  memory: {
    rss: string;
    heapUsed: string;
    heapTotal: string;
    external: string;
  };
  cpu: {
    usage: NodeJS.CpuUsage;
  };
}

@Injectable()
export class HealthService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<Record<string, never>>,
    private readonly config: ConfigService<Configuration, true>,
  ) {}

  async check(): Promise<HealthCheckResponse> {
    const startTime = Date.now();
    let dbStatus: 'connected' | 'disconnected' | 'error' = 'disconnected';
    let dbMessage: string | undefined;

    try {
      await this.db.execute(sql`SELECT 1`);
      dbStatus = 'connected';
    } catch (error) {
      dbStatus = 'error';
      dbMessage = error instanceof Error ? error.message : 'Unknown database error';
    }

    const dbResponseTime = Date.now() - startTime;

    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const environment = this.config.get('app.nodeEnv', { infer: true });

    return {
      status: dbStatus === 'connected' ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      environment,
      database: {
        status: dbStatus,
        responseTime: dbResponseTime,
        ...(dbMessage && { message: dbMessage }),
      },
      memory: {
        rss: this.formatBytes(memoryUsage.rss),
        heapUsed: this.formatBytes(memoryUsage.heapUsed),
        heapTotal: this.formatBytes(memoryUsage.heapTotal),
        external: this.formatBytes(memoryUsage.external),
      },
      cpu: {
        usage: cpuUsage,
      },
    };
  }

  private formatBytes(bytes: number): string {
    const mb = bytes / 1024 / 1024;
    return `${mb.toFixed(2)} MB`;
  }
}
