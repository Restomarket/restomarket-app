import { type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { TypedConfigService } from './config.types';
import { writeFileSync } from 'fs';
import { join } from 'path';

export function setupSwagger(app: INestApplication): void {
  const configService = app.get<TypedConfigService>(ConfigService);
  const swaggerEnabled = configService.get('swagger.enabled', { infer: true });

  if (!swaggerEnabled) {
    return;
  }

  const config = new DocumentBuilder()
    .setTitle(configService.get('swagger.title', { infer: true }))
    .setDescription(
      `${configService.get('swagger.description', { infer: true })}

## Features
- Clean Architecture with Domain-Driven Design
- Type-safe with TypeScript strict mode
- Drizzle ORM with PostgreSQL
- Comprehensive logging with Pino
- Request correlation tracking
- Rate limiting
- Input validation
- Pagination support
- Health checks

## Authentication
Bearer token authentication (to be implemented)`,
    )
    .setVersion(configService.get('swagger.version', { infer: true }))
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('health', 'System health and status checks')
    .addTag('users', 'User management and CRUD operations')
    .addServer('http://localhost:3000', 'Local development')
    .addServer('https://api.example.com', 'Production')
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (controllerKey: string, methodKey: string) => methodKey,
  });

  // Add global error responses
  for (const path in document.paths) {
    const pathItem = document.paths[path];
    if (!pathItem) continue;

    for (const method in pathItem) {
      const operation = pathItem[method as keyof typeof pathItem];
      if (!operation || typeof operation !== 'object' || !('responses' in operation)) continue;

      operation.responses['400'] ??= {
        description: 'Bad Request - Invalid input',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: false },
                statusCode: { type: 'number', example: 400 },
                message: { type: 'string', example: 'Validation failed' },
                timestamp: { type: 'string', format: 'date-time' },
                path: { type: 'string' },
                correlationId: { type: 'string' },
                validationErrors: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      field: { type: 'string' },
                      message: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      };

      operation.responses['500'] ??= {
        description: 'Internal Server Error',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: false },
                statusCode: { type: 'number', example: 500 },
                message: { type: 'string', example: 'Internal server error' },
                timestamp: { type: 'string', format: 'date-time' },
                path: { type: 'string' },
                correlationId: { type: 'string' },
              },
            },
          },
        },
      };
    }
  }

  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
      docExpansion: 'none',
      filter: true,
      showRequestDuration: true,
      syntaxHighlight: {
        theme: 'monokai',
      },
    },
    customSiteTitle: 'NestJS API Documentation',
    customfavIcon: '/favicon.ico',
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .information-container { margin: 20px 0 }
    `,
    jsonDocumentUrl: 'api/docs/json', // JSON endpoint
    yamlDocumentUrl: 'api/docs/yaml', // YAML endpoint
  });

  // Export OpenAPI spec to file in development mode
  const nodeEnv = configService.get('app.nodeEnv', { infer: true });
  if (nodeEnv === 'development') {
    const outputPath = join(process.cwd(), 'swagger-spec.json');
    writeFileSync(outputPath, JSON.stringify(document, null, 2), { encoding: 'utf8' });
  }
}
