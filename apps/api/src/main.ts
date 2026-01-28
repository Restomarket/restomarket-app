import { ValidationPipe, VersioningType, type ValidationError } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { setupSwagger } from './config/swagger.config';
import { ValidationException } from './common/exceptions';

/**
 * Bootstrap the NestJS application
 */
async function bootstrap(): Promise<void> {
  try {
    // Create NestJS application
    const app = await NestFactory.create(AppModule, {
      bufferLogs: true,
      cors: false, // Configure CORS manually below
    });

    // Get services
    const configService = app.get(ConfigService);
    const logger = app.get(Logger);

    // Use Pino logger
    app.useLogger(logger);

    // Get configuration with fallbacks
    const nodeEnv = configService.get<string>('app.nodeEnv', 'development');
    const port = configService.get<number>('app.port', 3000);
    const host = configService.get<string>('app.host', '0.0.0.0');
    const apiPrefix = configService.get<string>('app.apiPrefix', 'api');
    const apiVersion = configService.get<string>('app.apiVersion', 'v1');
    const timeout = configService.get<number>('app.timeout', 30000);

    // Log startup environment
    logger.log(`Starting application in ${nodeEnv} mode`);

    // Global prefix
    app.setGlobalPrefix(apiPrefix, {
      exclude: ['/health', '/health/*path'], // Exclude health check endpoints
    });

    // API versioning
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: apiVersion,
    });

    // Security middleware
    app.use(
      helmet({
        contentSecurityPolicy: nodeEnv === 'production',
        crossOriginEmbedderPolicy: nodeEnv === 'production',
      }),
    );

    // CORS configuration
    const allowedOrigins = configService.get<string[]>('cors.origins', ['http://localhost:3000']);

    app.enableCors({
      origin: allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Per-Page'],
      maxAge: 86400, // 24 hours
    });

    // Compression middleware
    app.use(
      compression({
        threshold: 1024, // Only compress responses larger than 1KB
      }),
    );

    // Global validation pipe with custom exception factory
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true, // Strip properties that are not decorated
        forbidNonWhitelisted: true, // Throw error on non-whitelisted properties
        transform: true, // Auto-transform payloads to DTO instances
        transformOptions: {
          enableImplicitConversion: true,
        },
        stopAtFirstError: false, // Collect all validation errors
        exceptionFactory: (errors: ValidationError[]) => {
          // Transform class-validator errors to our custom ValidationException
          const formattedErrors = errors.map(error => ({
            field: error.property,
            constraints: error.constraints ?? {},
            value: error.value as unknown,
          }));

          return new ValidationException('VALIDATION_FAILED', 'Request validation failed', {
            errors: formattedErrors,
            count: errors.length,
          });
        },
      }),
    );

    // Swagger documentation (only in non-production environments)
    if (nodeEnv !== 'production') {
      setupSwagger(app);
    }

    // Graceful shutdown hooks
    app.enableShutdownHooks();

    // Start server
    await app.listen(port, host);

    // Startup messages
    logger.log(`🚀 Application is running on: http://${host}:${port}/${apiPrefix}`);
    logger.log(`🌍 Environment: ${nodeEnv}`);
    logger.log(`⏱️  Request timeout: ${timeout}ms`);
    logger.log(`🔒 CORS enabled for: ${allowedOrigins.join(', ')}`);
    if (nodeEnv !== 'production') {
      logger.log(`📚 Swagger UI: http://${host}:${port}/${apiPrefix}/docs`);
    }

    // Register process event listeners
    registerProcessListeners(logger);
  } catch (error) {
    console.error('❌ Failed to start application:', error);
    process.exit(1);
  }
}

/**
 * Register process event listeners for graceful shutdown and error handling
 */
function registerProcessListeners(logger: Logger): void {
  // Handle uncaught exceptions
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception:', {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
    logger.error('Unhandled Rejection:', {
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
      promise,
    });
    process.exit(1);
  });

  // Handle process termination signals
  process.on('SIGTERM', () => {
    logger.log('SIGTERM signal received: closing HTTP server');
    process.exit(0);
  });

  process.on('SIGINT', () => {
    logger.log('SIGINT signal received: closing HTTP server');
    process.exit(0);
  });
}

// Start the application
void bootstrap();
