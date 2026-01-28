import { registerAs } from '@nestjs/config';
import type { CorsConfig } from './config.types';

export default registerAs(
  'cors',
  (): CorsConfig => ({
    origins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000').split(','),
    credentials: true,
  }),
);
