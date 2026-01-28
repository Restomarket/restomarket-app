import { registerAs } from '@nestjs/config';
import type { SwaggerConfig } from './config.types';

export default registerAs(
  'swagger',
  (): SwaggerConfig => ({
    enabled: process.env.SWAGGER_ENABLED !== 'false',
    title: process.env.SWAGGER_TITLE ?? 'NestJS Clean API',
    description: process.env.SWAGGER_DESCRIPTION ?? 'Production-ready API',
    version: process.env.SWAGGER_VERSION ?? '1.0',
  }),
);
