import { Injectable, Inject } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import {
  DeadLetterQueueRepositoryBase,
  deadLetterQueue,
  type DatabaseConnection,
  type ILogger,
} from '@repo/shared';
import { DATABASE_CONNECTION } from '../database.constants';

/**
 * NestJS adapter for DeadLetterQueueRepositoryBase
 * Wraps the framework-agnostic repository with NestJS-specific functionality
 */
@Injectable()
export class DeadLetterQueueRepository extends DeadLetterQueueRepositoryBase {
  constructor(@Inject(DATABASE_CONNECTION) db: DatabaseConnection, pinoLogger: PinoLogger) {
    // Adapt PinoLogger to ILogger interface
    const logger: ILogger = {
      info: (msg, ctx) => pinoLogger.info(ctx ?? {}, msg),
      error: (msg, ctx) => pinoLogger.error(ctx ?? {}, msg),
      warn: (msg, ctx) => pinoLogger.warn(ctx ?? {}, msg),
      debug: (msg, ctx) => pinoLogger.debug(ctx ?? {}, msg),
    };

    super(db, deadLetterQueue, logger);
    pinoLogger.setContext(DeadLetterQueueRepository.name);
  }
}
