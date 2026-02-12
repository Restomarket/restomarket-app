import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import Redis from 'ioredis';
import type { Configuration } from '@config/config.types';

export interface RedisHealthIndicator {
  status: 'up' | 'down';
  responseTime?: number;
  message?: string;
}

@Injectable()
export class RedisHealthService {
  private redis: Redis | null = null;

  constructor(
    private readonly config: ConfigService<Configuration, true>,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(RedisHealthService.name);
    this.initializeRedis();
  }

  private initializeRedis() {
    try {
      const redisUrl = this.config.get('redis.url', { infer: true });
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        lazyConnect: true,
      });

      this.redis.on('error', error => {
        this.logger.warn({ error: error.message }, 'Redis connection error');
      });
    } catch (error) {
      this.logger.error({ error }, 'Failed to initialize Redis client');
      this.redis = null;
    }
  }

  async check(): Promise<RedisHealthIndicator> {
    if (!this.redis) {
      return {
        status: 'down',
        message: 'Redis client not initialized',
      };
    }

    const startTime = Date.now();

    try {
      await this.redis.ping();
      const responseTime = Date.now() - startTime;

      return {
        status: 'up',
        responseTime,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown Redis error';
      this.logger.warn({ error: message }, 'Redis health check failed');

      return {
        status: 'down',
        responseTime: Date.now() - startTime,
        message,
      };
    }
  }

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit();
    }
  }
}
