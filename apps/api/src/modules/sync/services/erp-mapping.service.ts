import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { ErpCodeMappingsRepository } from '../../../database/adapters';
import type { MappingResult, CacheEntry, MappingType } from '../interfaces/erp-mapping.interface';
import type {
  CreateErpMappingDto,
  UpdateErpMappingDto,
  SeedErpMappingsDto,
} from '../dto/erp-mapping.dto';
import type { ErpCodeMapping } from '@repo/shared/types/database.types';

/**
 * ERP Mapping Service
 *
 * Manages ERP code translation with in-memory LRU cache.
 * Cache TTL: 5 minutes, Max size: 10,000 entries per vendor.
 *
 * Mapping types:
 * - unit: e.g., ERP 'KG' → RestoMarket 'kilogram'
 * - vat: e.g., ERP 'TVA20' → RestoMarket 'vat_20'
 * - family: e.g., ERP 'FRUITS' → RestoMarket 'fresh_produce'
 * - subfamily: e.g., ERP 'POMME' → RestoMarket 'apples'
 */
@Injectable()
export class ErpMappingService {
  private readonly cache: Map<string, CacheEntry> = new Map();
  private readonly MAX_CACHE_SIZE = 10_000;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(
    private readonly mappingsRepository: ErpCodeMappingsRepository,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(ErpMappingService.name);
  }

  /**
   * Resolve ERP code to RestoMarket code
   *
   * Flow:
   * 1. Check cache → return if hit and not expired
   * 2. Query database → cache result → return
   * 3. Return null if not found
   */
  async resolve(
    vendorId: string,
    type: MappingType,
    erpCode: string,
  ): Promise<MappingResult | null> {
    const cacheKey = this.buildCacheKey(vendorId, type, erpCode);

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      this.cacheHits++;
      this.logger.debug('Cache hit for mapping', { vendorId, type, erpCode });
      return cached.result;
    }

    // Cache miss or expired (only increment if we didn't return above)
    this.cacheMisses++;
    this.logger.debug('Cache miss for mapping', { vendorId, type, erpCode });

    // Query database
    const mapping = await this.mappingsRepository.findByVendorTypeCode(vendorId, type, erpCode);

    if (!mapping) {
      this.logger.warn('Mapping not found', { vendorId, type, erpCode });
      return null;
    }

    // Cache result
    const result: MappingResult = {
      restoCode: mapping.restoCode,
      restoLabel: mapping.restoLabel,
    };

    this.setCacheEntry(cacheKey, result);

    return result;
  }

  /**
   * Create a single mapping
   */
  async createMapping(dto: CreateErpMappingDto): Promise<ErpCodeMapping | null> {
    const mapping = await this.mappingsRepository.upsert({
      vendorId: dto.vendorId,
      mappingType: dto.mappingType,
      erpCode: dto.erpCode,
      restoCode: dto.restoCode,
      restoLabel: dto.restoLabel,
      isActive: dto.isActive ?? true,
    });

    if (mapping) {
      // Invalidate cache for this specific key
      const cacheKey = this.buildCacheKey(dto.vendorId, dto.mappingType, dto.erpCode);
      this.cache.delete(cacheKey);
      this.logger.info('Mapping created and cache invalidated', {
        mappingId: mapping.id,
        vendorId: dto.vendorId,
        type: dto.mappingType,
      });
    }

    return mapping;
  }

  /**
   * Update an existing mapping
   */
  async updateMapping(id: string, dto: UpdateErpMappingDto): Promise<ErpCodeMapping | null> {
    // Get existing mapping to invalidate cache
    const existing = await this.mappingsRepository.findById(id);
    if (!existing) {
      this.logger.warn('Mapping not found for update', { id });
      return null;
    }

    const updated = await this.mappingsRepository.update(id, dto);

    if (updated) {
      // Invalidate cache for this mapping
      const cacheKey = this.buildCacheKey(
        existing.vendorId,
        existing.mappingType,
        existing.erpCode,
      );
      this.cache.delete(cacheKey);
      this.logger.info('Mapping updated and cache invalidated', { mappingId: id });
    }

    return updated;
  }

  /**
   * Soft-delete mapping (set isActive = false)
   */
  async deleteMapping(id: string): Promise<ErpCodeMapping | null> {
    // Get existing mapping to invalidate cache
    const existing = await this.mappingsRepository.findById(id);
    if (!existing) {
      this.logger.warn('Mapping not found for deletion', { id });
      return null;
    }

    const deactivated = await this.mappingsRepository.deactivate(id);

    if (deactivated) {
      // Invalidate cache for this mapping
      const cacheKey = this.buildCacheKey(
        existing.vendorId,
        existing.mappingType,
        existing.erpCode,
      );
      this.cache.delete(cacheKey);
      this.logger.info('Mapping deactivated and cache invalidated', { mappingId: id });
    }

    return deactivated;
  }

  /**
   * List mappings with pagination and filtering
   */
  async listMappings(
    vendorId?: string,
    type?: string,
    includeInactive = false,
    page = 1,
    limit = 50,
  ): Promise<{ data: ErpCodeMapping[]; total: number; page: number; limit: number }> {
    const result = await this.mappingsRepository.findAll(
      vendorId,
      type,
      includeInactive,
      page,
      limit,
    );

    return {
      ...result,
      page,
      limit,
    };
  }

  /**
   * Bulk seed mappings
   */
  async seed(dto: SeedErpMappingsDto): Promise<ErpCodeMapping[]> {
    const mappingsToInsert = dto.mappings.map(m => ({
      vendorId: dto.vendorId,
      mappingType: m.mappingType,
      erpCode: m.erpCode,
      restoCode: m.restoCode,
      restoLabel: m.restoLabel,
      isActive: true,
    }));

    const inserted = await this.mappingsRepository.bulkInsert(mappingsToInsert);

    // Invalidate entire cache after bulk operation
    this.clearCache();
    this.logger.info('Mappings seeded and cache cleared', {
      vendorId: dto.vendorId,
      count: inserted.length,
    });

    return inserted;
  }

  /**
   * Clear entire cache
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.logger.info('Cache cleared');
  }

  /**
   * Get cache statistics (for monitoring)
   */
  getCacheStats() {
    const totalRequests = this.cacheHits + this.cacheMisses;
    return {
      size: this.cache.size,
      maxSize: this.MAX_CACHE_SIZE,
      hitRate: totalRequests > 0 ? (this.cacheHits / totalRequests) * 100 : 0,
      missRate: totalRequests > 0 ? (this.cacheMisses / totalRequests) * 100 : 0,
      hits: this.cacheHits,
      misses: this.cacheMisses,
    };
  }

  /**
   * Build cache key from vendor, type, and ERP code
   */
  private buildCacheKey(vendorId: string, type: string, erpCode: string): string {
    return `${vendorId}:${type}:${erpCode}`;
  }

  /**
   * Set cache entry with LRU eviction
   */
  private setCacheEntry(key: string, result: MappingResult): void {
    // LRU eviction: remove oldest entry if cache is full
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
        this.logger.debug('LRU eviction triggered', { evictedKey: firstKey });
      }
    }

    this.cache.set(key, {
      result,
      expiresAt: Date.now() + this.CACHE_TTL_MS,
    });
  }
}
