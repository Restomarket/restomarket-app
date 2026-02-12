import { Injectable, Inject } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import {
  ReconciliationEventsRepositoryBase,
  reconciliationEvents,
  type DatabaseConnection,
  type ILogger,
} from '@repo/shared';
import { DATABASE_CONNECTION } from '../database.module';

/**
 * NestJS adapter for ReconciliationEventsRepositoryBase
 * Wraps the framework-agnostic repository with NestJS-specific functionality
 */
@Injectable()
export class ReconciliationEventsRepository extends ReconciliationEventsRepositoryBase {
  constructor(@Inject(DATABASE_CONNECTION) db: DatabaseConnection, pinoLogger: PinoLogger) {
    // Adapt PinoLogger to ILogger interface
    const logger: ILogger = {
      info: (msg, ctx) => pinoLogger.info(ctx ?? {}, msg),
      error: (msg, ctx) => pinoLogger.error(ctx ?? {}, msg),
      warn: (msg, ctx) => pinoLogger.warn(ctx ?? {}, msg),
      debug: (msg, ctx) => pinoLogger.debug(ctx ?? {}, msg),
    };

    super(db, reconciliationEvents, logger);
    pinoLogger.setContext(ReconciliationEventsRepository.name);
  }
}
