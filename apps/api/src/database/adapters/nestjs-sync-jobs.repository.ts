import { Injectable, Inject } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import {
  SyncJobsRepositoryBase,
  syncJobs,
  type DatabaseConnection,
  type ILogger,
} from '@repo/shared';
import { DATABASE_CONNECTION } from '../database.module';

/**
 * NestJS adapter for SyncJobsRepositoryBase
 * Wraps the framework-agnostic repository with NestJS-specific functionality
 */
@Injectable()
export class SyncJobsRepository extends SyncJobsRepositoryBase {
  constructor(@Inject(DATABASE_CONNECTION) db: DatabaseConnection, pinoLogger: PinoLogger) {
    // Adapt PinoLogger to ILogger interface
    const logger: ILogger = {
      info: (msg, ctx) => pinoLogger.info(ctx ?? {}, msg),
      error: (msg, ctx) => pinoLogger.error(ctx ?? {}, msg),
      warn: (msg, ctx) => pinoLogger.warn(ctx ?? {}, msg),
      debug: (msg, ctx) => pinoLogger.debug(ctx ?? {}, msg),
    };

    super(db, syncJobs, logger);
    pinoLogger.setContext(SyncJobsRepository.name);
  }
}
