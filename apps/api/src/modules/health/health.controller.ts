import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Health check endpoint',
    description:
      'Returns the health status of the application including database connectivity, memory usage, and system information',
  })
  @ApiResponse({
    status: 200,
    description: 'Service is healthy',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['healthy', 'unhealthy'], example: 'healthy' },
        timestamp: { type: 'string', format: 'date-time', example: '2024-01-01T00:00:00.000Z' },
        uptime: { type: 'number', example: 3600 },
        environment: { type: 'string', example: 'production' },
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
  async check() {
    return this.healthService.check();
  }
}
