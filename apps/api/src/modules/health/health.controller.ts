import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { AllowAnonymous } from '../../auth/decorators';
import { HealthService } from './health.service';

@ApiTags('health')
@AllowAnonymous()
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({
    summary: 'Health check endpoint',
    description:
      'Returns the health status of the application including database and Redis connectivity, memory usage, and system information. Returns 200 when healthy, 503 when unhealthy.',
  })
  @ApiResponse({
    status: 200,
    description: 'Service is healthy',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['healthy', 'unhealthy'], example: 'healthy' },
        timestamp: { type: 'string', format: 'date-time', example: '2025-01-29T12:00:00.000Z' },
        uptime: { type: 'number', example: 3600 },
        environment: { type: 'string', example: 'production' },
        services: {
          type: 'object',
          properties: {
            database: {
              type: 'string',
              enum: ['connected', 'disconnected', 'error'],
              example: 'connected',
            },
            redis: {
              type: 'string',
              enum: ['connected', 'disconnected', 'error'],
              example: 'connected',
            },
          },
        },
        database: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['connected', 'disconnected', 'error'],
              example: 'connected',
            },
            responseTime: { type: 'number', example: 5 },
          },
        },
        redis: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['connected', 'disconnected', 'error'],
              example: 'connected',
            },
            responseTime: { type: 'number', example: 2 },
          },
        },
        memory: {
          type: 'object',
          properties: {
            rss: { type: 'string', example: '50.00 MB' },
            heapUsed: { type: 'string', example: '30.00 MB' },
            heapTotal: { type: 'string', example: '40.00 MB' },
            external: { type: 'string', example: '2.00 MB' },
          },
        },
        cpu: {
          type: 'object',
          properties: {
            usage: {
              type: 'object',
              properties: {
                user: { type: 'number' },
                system: { type: 'number' },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 503, description: 'Service is unhealthy' })
  async check(@Res() res: Response) {
    const healthStatus = await this.healthService.check();

    // Return 503 if unhealthy, 200 if healthy
    const statusCode =
      healthStatus.status === 'healthy' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;

    return res.status(statusCode).json(healthStatus);
  }

  @Get('ping')
  @ApiOperation({
    summary: 'Simple ping endpoint',
    description:
      'Returns a static pong response to verify API is responding. Used for CI/CD testing.',
  })
  @ApiResponse({
    status: 200,
    description: 'Pong response',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'pong' },
        timestamp: { type: 'string', format: 'date-time' },
        turboCacheEnabled: { type: 'boolean', example: true },
      },
    },
  })
  ping() {
    return {
      message: 'pong',
      timestamp: new Date().toISOString(),
      turboCacheEnabled: true,
    };
  }
}
