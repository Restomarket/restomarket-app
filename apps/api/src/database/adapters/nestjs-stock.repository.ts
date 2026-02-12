import { Injectable, Inject } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { StockRepositoryBase, stock, type DatabaseConnection, type ILogger } from '@repo/shared';
import { DATABASE_CONNECTION } from '../database.constants';

@Injectable()
export class StockRepository extends StockRepositoryBase {
  constructor(@Inject(DATABASE_CONNECTION) db: DatabaseConnection, pinoLogger: PinoLogger) {
    const logger: ILogger = {
      info: (msg, ctx) => pinoLogger.info(ctx ?? {}, msg),
      error: (msg, ctx) => pinoLogger.error(ctx ?? {}, msg),
      warn: (msg, ctx) => pinoLogger.warn(ctx ?? {}, msg),
      debug: (msg, ctx) => pinoLogger.debug(ctx ?? {}, msg),
    };
    super(db, stock, logger);
    pinoLogger.setContext(StockRepository.name);
  }
}
