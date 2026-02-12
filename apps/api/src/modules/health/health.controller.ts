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
      'Returns the health status of the application including database, Redis, BullMQ, agents, memory usage, and system information. Returns 200 when healthy, 503 when unhealthy.',
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
        info: {
          type: 'object',
          properties: {
            database: {
              type: 'object',
              properties: {
                status: { type: 'string', enum: ['up', 'down'], example: 'up' },
                responseTime: { type: 'number', example: 5 },
              },
            },
            redis: {
              type: 'object',
              properties: {
                status: { type: 'string', enum: ['up', 'down'], example: 'up' },
                responseTime: { type: 'number', example: 2 },
              },
            },
            bullmq: {
              type: 'object',
              properties: {
                status: { type: 'string', enum: ['up', 'down', 'warning'], example: 'up' },
                queues: {
                  type: 'object',
                  properties: {
                    'order-sync': { type: 'number', example: 0 },
                    reconciliation: { type: 'number', example: 0 },
                    'image-sync': { type: 'number', example: 0 },
                  },
                },
              },
            },
            agents: {
              type: 'object',
              properties: {
                status: { type: 'string', enum: ['up', 'down', 'degraded'], example: 'up' },
                online: { type: 'number', example: 2 },
                total: { type: 'number', example: 3 },
              },
            },
            memory_heap: {
              type: 'object',
              properties: {
                status: { type: 'string', example: 'up' },
                heapUsed: { type: 'string', example: '30.00 MB' },
                heapTotal: { type: 'string', example: '40.00 MB' },
              },
            },
            disk: {
              type: 'object',
              properties: {
                status: { type: 'string', example: 'up' },
                rss: { type: 'string', example: '50.00 MB' },
                external: { type: 'string', example: '2.00 MB' },
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
