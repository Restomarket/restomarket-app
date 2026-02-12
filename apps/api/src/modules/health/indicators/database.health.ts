import { Injectable, Inject } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '../../../database/database.module';

export interface DatabaseHealthIndicator {
  status: 'up' | 'down';
  responseTime: number;
  message?: string;
}

@Injectable()
export class DatabaseHealthService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<Record<string, never>>,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(DatabaseHealthService.name);
  }

  async check(): Promise<DatabaseHealthIndicator> {
    const startTime = Date.now();

    try {
      await this.db.execute(sql`SELECT 1`);
      const responseTime = Date.now() - startTime;

      return {
        status: 'up',
        responseTime,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown database error';
      this.logger.warn({ error: message }, 'Database health check failed');

      return {
        status: 'down',
        responseTime: Date.now() - startTime,
        message,
      };
    }
  }
}
