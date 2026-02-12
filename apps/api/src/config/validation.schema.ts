import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  APP_NAME: z.string().default('nestjs-clean-api'),
  APP_PORT: z.string().default('3000').transform(Number).pipe(z.number().min(1).max(65535)),
  APP_HOST: z.string().default('0.0.0.0'),
  API_PREFIX: z.string().default('api'),
  API_VERSION: z.string().default('1').transform(Number).pipe(z.number().min(1)),
  REQUEST_TIMEOUT: z.string().default('30000').transform(Number).pipe(z.number().positive()),

  DATABASE_URL: z.string().url(),
  DATABASE_POOL_MAX: z.string().default('10').transform(Number).pipe(z.number().positive()),
  DATABASE_IDLE_TIMEOUT: z.string().default('20').transform(Number).pipe(z.number().positive()),
  DATABASE_CONNECT_TIMEOUT: z.string().default('10').transform(Number).pipe(z.number().positive()),
  DATABASE_SSL: z
    .string()
    .default('true')
    .transform(val => val === 'true'),
  DATABASE_SSL_CA: z.string().optional(),

  // Supabase-specific configurations
  DATABASE_DIRECT_URL: z.string().url().optional(),
  SUPABASE_PROJECT_REF: z.string().optional(),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  LOG_PRETTY: z
    .string()
    .default('false')
    .transform(val => val === 'true'),

  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  RATE_LIMIT_TTL: z.string().default('60').transform(Number).pipe(z.number().positive()),
  RATE_LIMIT_MAX: z.string().default('100').transform(Number).pipe(z.number().positive()),

  SWAGGER_ENABLED: z
    .string()
    .default('true')
    .transform(val => val === 'true'),
  SWAGGER_TITLE: z.string().default('NestJS Clean API'),
  SWAGGER_DESCRIPTION: z.string().default('Production-ready API'),
  SWAGGER_VERSION: z.string().default('1.0'),

  // Auth Configuration
  BETTER_AUTH_SECRET: z.string().optional(),
  BETTER_AUTH_URL: z.string().url().optional(),

  // Redis Configuration
  REDIS_URL: z.string().url().default('redis://localhost:6379'),

  // ERP Sync Configuration
  AGENT_SECRET: z.string().min(16).optional(), // optional during dev, required in prod
  API_SECRET: z.string().min(32).optional(), // optional during dev, required in prod
  SLACK_WEBHOOK_URL: z.string().url().optional(),
  BULLMQ_CONCURRENCY: z.string().default('5').transform(Number).pipe(z.number().min(1).max(20)),
});

export type EnvironmentVariables = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const errors = result.error.issues.map(issue => {
      return `  - ${issue.path.join('.')}: ${issue.message}`;
    });

    throw new Error(
      `❌ Environment validation failed:\n\n${errors.join('\n')}\n\nPlease check your .env file.`,
    );
  }

  return result.data;
}
