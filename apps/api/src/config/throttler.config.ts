import { registerAs } from '@nestjs/config';
import type { ThrottlerConfig } from './config.types';

export default registerAs(
  'throttler',
  (): ThrottlerConfig => ({
    ttl: parseInt(process.env.RATE_LIMIT_TTL ?? '60', 10) * 1000,
    limit: parseInt(process.env.RATE_LIMIT_MAX ?? '100', 10),
  }),
);
