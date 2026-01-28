import { registerAs } from '@nestjs/config';
import type { AppConfig } from './config.types';

export default registerAs(
  'app',
  (): AppConfig => ({
    nodeEnv: (process.env.NODE_ENV as AppConfig['nodeEnv']) ?? 'development',
    name: process.env.APP_NAME ?? 'nestjs-clean-api',
    port: parseInt(process.env.APP_PORT ?? '3000', 10),
    host: process.env.APP_HOST ?? '0.0.0.0',
    apiPrefix: process.env.API_PREFIX ?? 'api',
    apiVersion: process.env.API_VERSION ?? '1',
    timeout: parseInt(process.env.REQUEST_TIMEOUT ?? '30000', 10),
  }),
);
