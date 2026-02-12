import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import type { Configuration } from './config/config.types';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import loggerConfig from './config/logger.config';
import corsConfig from './config/cors.config';
import throttlerConfig from './config/throttler.config';
import swaggerConfigFactory from './config/swagger-config.config';
import redisConfig from './config/redis.config';
import syncConfig from './config/sync.config';
import { validateEnv } from './config/validation.schema';
import { getPinoConfig } from './logger/pino.config';
import { DatabaseModule } from './database/database.module';
import { SharedModule } from './shared/shared.module';
import { HealthModule } from './modules/health/health.module';
import { UsersModule } from './modules/users/users.module';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { LoggerContextMiddleware } from './common/middleware/logger-context.middleware';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor';
import { AuthModule } from './auth';

@Module({
  imports: [
    // Configuration with Zod validation and type inference
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV === 'test' ? '.env.test' : '.env',
      load: [
        appConfig,
        databaseConfig,
        loggerConfig,
        corsConfig,
        throttlerConfig,
        swaggerConfigFactory,
        redisConfig,
        syncConfig,
      ],
      validate: validateEnv,
      cache: true,
      expandVariables: true,
    }),

    // Logger
    LoggerModule.forRoot(getPinoConfig()),

    // Rate limiting - using configuration
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Configuration, true>) => [
        {
          ttl: config.get('throttler.ttl', { infer: true }),
          limit: config.get('throttler.limit', { infer: true }),
        },
      ],
    }),

    // Scheduling - for cron jobs and intervals
    ScheduleModule.forRoot(),

    // BullMQ - for job queues
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Configuration, true>) => ({
        connection: {
          url: config.get('redis.url', { infer: true }),
        },
      }),
    }),

    // Core modules
    DatabaseModule,
    SharedModule,
    AuthModule,

    // Feature modules
    HealthModule,
    UsersModule,
  ],
  providers: [
    // Global rate limiting guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // Global exception filter
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    // Global interceptors (registered in reverse order of execution)
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor, // Last: Format responses
    },
    {
      provide: APP_INTERCEPTOR,
      useFactory: (config: ConfigService<Configuration, true>) => {
        const timeout = config.get('app.timeout', { infer: true });
        return new TimeoutInterceptor(timeout);
      },
      inject: [ConfigService],
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor, // First: Log requests
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware, LoggerContextMiddleware).forRoutes('*path');
  }
}
