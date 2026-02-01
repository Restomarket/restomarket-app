import { registerAs } from '@nestjs/config';
import type { DatabaseConfig } from './config.types';

export const DATABASE_DEFAULTS = {
  POOL_MAX: 10,
  IDLE_TIMEOUT: 20,
  CONNECT_TIMEOUT: 10,
} as const;

export default registerAs('database', (): DatabaseConfig => {
  const sslEnabled = process.env.DATABASE_SSL === 'true';

  return {
    url: process.env.DATABASE_URL!,
    directUrl: process.env.DATABASE_DIRECT_URL || process.env.DATABASE_URL!,
    poolMax: parseInt(process.env.DATABASE_POOL_MAX ?? String(DATABASE_DEFAULTS.POOL_MAX), 10),
    ssl: sslEnabled
      ? {
          rejectUnauthorized: false,
          ...(process.env.DATABASE_SSL_CA ? { ca: process.env.DATABASE_SSL_CA } : {}),
        }
      : false,
    idleTimeout: parseInt(
      process.env.DATABASE_IDLE_TIMEOUT ?? String(DATABASE_DEFAULTS.IDLE_TIMEOUT),
      10,
    ),
    connectTimeout: parseInt(
      process.env.DATABASE_CONNECT_TIMEOUT ?? String(DATABASE_DEFAULTS.CONNECT_TIMEOUT),
      10,
    ),
  };
});
