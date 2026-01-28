import { registerAs } from '@nestjs/config';
import type { LoggerConfig } from './config.types';

export default registerAs(
  'logger',
  (): LoggerConfig => ({
    level: (process.env.LOG_LEVEL as LoggerConfig['level']) ?? 'info',
    pretty: process.env.LOG_PRETTY === 'true',
  }),
);
