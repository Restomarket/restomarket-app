import { type EnvironmentVariables } from './validation.schema';
import type { ConfigService } from '@nestjs/config';

export interface AppConfig {
  nodeEnv: EnvironmentVariables['NODE_ENV'];
  name: string;
  port: number;
  host: string;
  apiPrefix: string;
  apiVersion: string;
  timeout: number;
}

export interface DatabaseConfig {
  url: string;
  poolMax: number;
  ssl:
    | false
    | {
        rejectUnauthorized: boolean;
        ca?: string;
      };
  idleTimeout: number;
  connectTimeout: number;
}

export interface LoggerConfig {
  level: EnvironmentVariables['LOG_LEVEL'];
  pretty: boolean;
}

export interface CorsConfig {
  origins: string[];
  credentials: boolean;
}

export interface ThrottlerConfig {
  ttl: number;
  limit: number;
}

export interface SwaggerConfig {
  enabled: boolean;
  title: string;
  description: string;
  version: string;
}

export interface Configuration {
  app: AppConfig;
  database: DatabaseConfig;
  logger: LoggerConfig;
  cors: CorsConfig;
  throttler: ThrottlerConfig;
  swagger: SwaggerConfig;
}

export type TypedConfigService = ConfigService<Configuration, true>;
