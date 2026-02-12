import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { ApiKeyGuard } from '../../../common/guards/api-key.guard';
import { ErpMappingService } from '../services/erp-mapping.service';
import {
  CreateErpMappingDto,
  UpdateErpMappingDto,
  SeedErpMappingsDto,
} from '../dto/erp-mapping.dto';

/**
 * ErpMappingController
 *
 * Admin endpoints for managing ERP code mappings.
 * All endpoints require X-API-Key authentication.
 */
@ApiTags('mappings')
@ApiSecurity('api-key')
@UseGuards(ApiKeyGuard)
@Controller('admin/mappings')
export class ErpMappingController {
  constructor(private readonly mappingService: ErpMappingService) {}

  /**
   * List mappings with pagination and filtering
   */
  @Get()
  @ApiOperation({
    summary: 'List ERP code mappings',
    description:
      'Retrieve paginated list of ERP code mappings with optional filtering by vendor and type.',
  })
  @ApiQuery({ name: 'vendorId', required: false, description: 'Filter by vendor ID' })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['unit', 'vat', 'family', 'subfamily'],
    description: 'Filter by mapping type',
  })
  @ApiQuery({
    name: 'includeInactive',
    required: false,
    type: Boolean,
    description: 'Include inactive mappings',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 50, max: 100)',
  })
  @ApiResponse({ status: 200, description: 'Mappings retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid API key' })
  async listMappings(
    @Query('vendorId') vendorId?: string,
    @Query('type') type?: string,
    @Query('includeInactive') includeInactive?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? Math.min(parseInt(limit, 10), 100) : 50;
    const includeInactiveBool = includeInactive === 'true';

    const result = await this.mappingService.listMappings(
      vendorId,
      type,
      includeInactiveBool,
      pageNum,
      limitNum,
    );

    const totalPages = Math.ceil(result.total / limitNum);

    return {
      data: result.data,
      meta: {
        page: pageNum,
        limit: limitNum,
        totalCount: result.total,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPreviousPage: pageNum > 1,
      },
    };
  }

  /**
   * Create a single mapping
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create ERP code mapping',
    description:
      'Create a new ERP code mapping. If a mapping with the same vendor/type/erpCode exists, it will be updated.',
  })
  @ApiResponse({ status: 201, description: 'Mapping created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - Validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid API key' })
  async createMapping(@Body() dto: CreateErpMappingDto) {
    const mapping = await this.mappingService.createMapping(dto);

    if (!mapping) {
      return {
        success: false,
        message: 'Failed to create mapping',
      };
    }

    return {
      success: true,
      data: mapping,
    };
  }

  /**
   * Update an existing mapping
   */
  @Put(':id')
  @ApiOperation({
    summary: 'Update ERP code mapping',
    description: 'Update an existing mapping by ID. Cache will be invalidated.',
  })
  @ApiParam({ name: 'id', description: 'Mapping UUID' })
  @ApiResponse({ status: 200, description: 'Mapping updated successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - Validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid API key' })
  @ApiResponse({ status: 404, description: 'Mapping not found' })
  async updateMapping(@Param('id') id: string, @Body() dto: UpdateErpMappingDto) {
    const mapping = await this.mappingService.updateMapping(id, dto);

    if (!mapping) {
      return {
        success: false,
        message: 'Mapping not found',
      };
    }

    return {
      success: true,
      data: mapping,
    };
  }

  /**
   * Soft-delete a mapping
   */
  @Delete(':id')
  @ApiOperation({
    summary: 'Soft-delete ERP code mapping',
    description: 'Deactivate a mapping by setting isActive=false. Cache will be invalidated.',
  })
  @ApiParam({ name: 'id', description: 'Mapping UUID' })
  @ApiResponse({ status: 200, description: 'Mapping deactivated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid API key' })
  @ApiResponse({ status: 404, description: 'Mapping not found' })
  async deleteMapping(@Param('id') id: string) {
    const mapping = await this.mappingService.deleteMapping(id);

    if (!mapping) {
      return {
        success: false,
        message: 'Mapping not found',
      };
    }

    return {
      success: true,
      message: 'Mapping deactivated',
      data: mapping,
    };
  }

  /**
   * Bulk seed mappings
   */
  @Post('seed')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Bulk seed ERP code mappings',
    description:
      'Insert or update multiple mappings in a single operation. Entire cache will be cleared.',
  })
  @ApiResponse({ status: 201, description: 'Mappings seeded successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - Validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid API key' })
  async seedMappings(@Body() dto: SeedErpMappingsDto) {
    const mappings = await this.mappingService.seed(dto);

    return {
      success: true,
      message: `${mappings.length} mappings seeded`,
      data: {
        vendorId: dto.vendorId,
        count: mappings.length,
      },
    };
  }

  /**
   * Get cache statistics
   */
  @Get('cache/stats')
  @ApiOperation({
    summary: 'Get cache statistics',
    description: 'Retrieve in-memory cache statistics for monitoring.',
  })
  @ApiResponse({ status: 200, description: 'Cache stats retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid API key' })
  getCacheStats() {
    return this.mappingService.getCacheStats();
  }

  /**
   * Clear cache
   */
  @Post('cache/clear')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Clear cache',
    description: 'Clear all cached mappings. Use after bulk operations or troubleshooting.',
  })
  @ApiResponse({ status: 200, description: 'Cache cleared successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid API key' })
  clearCache() {
    this.mappingService.clearCache();
    return {
      success: true,
      message: 'Cache cleared',
    };
  }
}
