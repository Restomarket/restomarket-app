import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { SyncIngestService, type SyncResponse } from '../services/sync-ingest.service';
import { AgentAuthGuard } from '../../../common/guards/agent-auth.guard';
import {
  ItemSyncIngestDto,
  ItemSyncBatchIngestDto,
  StockSyncIngestDto,
  StockSyncBatchIngestDto,
  WarehouseSyncIngestDto,
  WarehouseSyncBatchIngestDto,
} from '../dto';

/**
 * AgentIngestController
 *
 * Handles direct ingest from ERP agents:
 * - POST /api/sync/items (incremental item sync)
 * - POST /api/sync/items/batch (full catalog sync)
 * - POST /api/sync/stock (incremental stock sync)
 * - POST /api/sync/stock/batch (full stock sync)
 * - POST /api/sync/warehouses (incremental warehouse sync)
 * - POST /api/sync/warehouses/batch (full warehouse sync)
 */
@ApiTags('sync')
@Controller('sync')
@UseGuards(AgentAuthGuard)
@ApiBearerAuth()
export class AgentIngestController {
  constructor(private readonly syncIngestService: SyncIngestService) {}

  @Post('items')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Incremental item sync from ERP agent' })
  @ApiResponse({
    status: 200,
    description: 'Items synced successfully',
    schema: {
      type: 'object',
      properties: {
        processed: { type: 'number', example: 45 },
        skipped: { type: 'number', example: 3 },
        failed: { type: 'number', example: 2 },
        results: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              identifier: { type: 'string', example: 'ABC001' },
              status: { type: 'string', enum: ['processed', 'skipped', 'failed'] },
              reason: { type: 'string', example: 'no_changes' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid agent token' })
  @ApiResponse({ status: 413, description: 'Payload too large - Max 500 items per request' })
  @ApiResponse({ status: 429, description: 'Too many requests - Rate limit exceeded' })
  async syncItems(@Body() dto: ItemSyncIngestDto): Promise<SyncResponse> {
    return this.syncIngestService.handleItemChanges(dto.vendorId, dto.items, false);
  }

  @Post('items/batch')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Batch item sync from ERP agent (full catalog push)' })
  @ApiResponse({
    status: 200,
    description: 'Items synced successfully (batch mode)',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid agent token' })
  @ApiResponse({ status: 413, description: 'Payload too large - Max 5000 items per request' })
  @ApiResponse({ status: 429, description: 'Too many requests - Rate limit exceeded' })
  async syncItemsBatch(@Body() dto: ItemSyncBatchIngestDto): Promise<SyncResponse> {
    return this.syncIngestService.handleItemChanges(dto.vendorId, dto.items, true);
  }

  @Post('stock')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Incremental stock sync from ERP agent' })
  @ApiResponse({
    status: 200,
    description: 'Stock synced successfully',
    schema: {
      type: 'object',
      properties: {
        processed: { type: 'number', example: 120 },
        skipped: { type: 'number', example: 10 },
        failed: { type: 'number', example: 0 },
        results: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              identifier: { type: 'string', example: 'ABC001@WH01' },
              status: { type: 'string', enum: ['processed', 'skipped', 'failed'] },
              reason: { type: 'string', example: 'no_changes' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid agent token' })
  @ApiResponse({
    status: 413,
    description: 'Payload too large - Max 500 stock records per request',
  })
  @ApiResponse({ status: 429, description: 'Too many requests - Rate limit exceeded' })
  async syncStock(@Body() dto: StockSyncIngestDto): Promise<SyncResponse> {
    return this.syncIngestService.handleStockChanges(dto.vendorId, dto.stock, false);
  }

  @Post('stock/batch')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Batch stock sync from ERP agent (full stock push)' })
  @ApiResponse({
    status: 200,
    description: 'Stock synced successfully (batch mode)',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid agent token' })
  @ApiResponse({
    status: 413,
    description: 'Payload too large - Max 5000 stock records per request',
  })
  @ApiResponse({ status: 429, description: 'Too many requests - Rate limit exceeded' })
  async syncStockBatch(@Body() dto: StockSyncBatchIngestDto): Promise<SyncResponse> {
    return this.syncIngestService.handleStockChanges(dto.vendorId, dto.stock, true);
  }

  @Post('warehouses')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Incremental warehouse sync from ERP agent' })
  @ApiResponse({
    status: 200,
    description: 'Warehouses synced successfully',
    schema: {
      type: 'object',
      properties: {
        processed: { type: 'number', example: 5 },
        skipped: { type: 'number', example: 0 },
        failed: { type: 'number', example: 0 },
        results: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              identifier: { type: 'string', example: 'WH01' },
              status: { type: 'string', enum: ['processed', 'skipped', 'failed'] },
              reason: { type: 'string', example: 'no_changes' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid agent token' })
  @ApiResponse({ status: 413, description: 'Payload too large - Max 500 warehouses per request' })
  @ApiResponse({ status: 429, description: 'Too many requests - Rate limit exceeded' })
  async syncWarehouses(@Body() dto: WarehouseSyncIngestDto): Promise<SyncResponse> {
    return this.syncIngestService.handleWarehouseChanges(dto.vendorId, dto.warehouses, false);
  }

  @Post('warehouses/batch')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Batch warehouse sync from ERP agent (full warehouse push)' })
  @ApiResponse({
    status: 200,
    description: 'Warehouses synced successfully (batch mode)',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid agent token' })
  @ApiResponse({ status: 413, description: 'Payload too large - Max 5000 warehouses per request' })
  @ApiResponse({ status: 429, description: 'Too many requests - Rate limit exceeded' })
  async syncWarehousesBatch(@Body() dto: WarehouseSyncBatchIngestDto): Promise<SyncResponse> {
    return this.syncIngestService.handleWarehouseChanges(dto.vendorId, dto.warehouses, true);
  }
}
