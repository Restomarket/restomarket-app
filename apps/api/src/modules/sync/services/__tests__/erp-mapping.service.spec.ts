import { Test, TestingModule } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';
import { ErpMappingService } from '../erp-mapping.service';
import { ErpCodeMappingsRepository } from '../../../../database/adapters';
import type { ErpCodeMapping } from '@repo/shared/types/database.types';

describe('ErpMappingService', () => {
  let service: ErpMappingService;
  let repository: jest.Mocked<ErpCodeMappingsRepository>;
  let logger: jest.Mocked<PinoLogger>;

  const mockMapping: ErpCodeMapping = {
    id: 'mapping-uuid',
    vendorId: 'vendor-123',
    mappingType: 'unit',
    erpCode: 'KG',
    restoCode: 'kilogram',
    restoLabel: 'Kilogramme',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockRepository = {
      findByVendorTypeCode: jest.fn(),
      findById: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      deactivate: jest.fn(),
      findAll: jest.fn(),
      bulkInsert: jest.fn(),
    };

    const mockLogger = {
      setContext: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ErpMappingService,
        { provide: ErpCodeMappingsRepository, useValue: mockRepository },
        { provide: PinoLogger, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<ErpMappingService>(ErpMappingService);
    repository = module.get(ErpCodeMappingsRepository);
    logger = module.get(PinoLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks(); // Restore Date.now and any other spies
    // Note: Don't clear cache in afterEach as it resets stats needed by some tests
  });

  describe('resolve', () => {
    it('should return mapping from database on cache miss', async () => {
      repository.findByVendorTypeCode.mockResolvedValue(mockMapping);

      const result = await service.resolve('vendor-123', 'unit', 'KG');

      expect(result).toEqual({
        restoCode: 'kilogram',
        restoLabel: 'Kilogramme',
      });
      expect(repository.findByVendorTypeCode).toHaveBeenCalledWith('vendor-123', 'unit', 'KG');
      expect(logger.debug).toHaveBeenCalledWith('Cache miss for mapping', {
        vendorId: 'vendor-123',
        type: 'unit',
        erpCode: 'KG',
      });
    });

    it('should return mapping from cache on cache hit', async () => {
      repository.findByVendorTypeCode.mockResolvedValue(mockMapping);

      // First call - cache miss
      await service.resolve('vendor-123', 'unit', 'KG');

      // Second call - cache hit
      const result = await service.resolve('vendor-123', 'unit', 'KG');

      expect(result).toEqual({
        restoCode: 'kilogram',
        restoLabel: 'Kilogramme',
      });
      expect(repository.findByVendorTypeCode).toHaveBeenCalledTimes(1); // Only called once
      expect(logger.debug).toHaveBeenCalledWith('Cache hit for mapping', {
        vendorId: 'vendor-123',
        type: 'unit',
        erpCode: 'KG',
      });
    });

    it('should return null if mapping not found', async () => {
      repository.findByVendorTypeCode.mockResolvedValue(null);

      const result = await service.resolve('vendor-123', 'unit', 'UNKNOWN');

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith('Mapping not found', {
        vendorId: 'vendor-123',
        type: 'unit',
        erpCode: 'UNKNOWN',
      });
    });

    it('should refresh cache on expiry', async () => {
      repository.findByVendorTypeCode.mockResolvedValue(mockMapping);

      // First call
      await service.resolve('vendor-123', 'unit', 'KG');

      // Mock time passing (5 minutes + 1 second)
      jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 5 * 60 * 1000 + 1000);

      // Second call should be cache miss due to expiry
      await service.resolve('vendor-123', 'unit', 'KG');

      expect(repository.findByVendorTypeCode).toHaveBeenCalledTimes(2);
    });
  });

  describe('createMapping', () => {
    it('should create mapping and invalidate cache', async () => {
      repository.upsert.mockResolvedValue(mockMapping);

      const dto = {
        vendorId: 'vendor-123',
        mappingType: 'unit',
        erpCode: 'KG',
        restoCode: 'kilogram',
        restoLabel: 'Kilogramme',
      };

      const result = await service.createMapping(dto);

      expect(result).toEqual(mockMapping);
      expect(repository.upsert).toHaveBeenCalledWith({
        ...dto,
        isActive: true,
      });
      expect(logger.info).toHaveBeenCalledWith('Mapping created and cache invalidated', {
        mappingId: 'mapping-uuid',
        vendorId: 'vendor-123',
        type: 'unit',
      });
    });

    it('should return null if creation fails', async () => {
      repository.upsert.mockResolvedValue(null);

      const dto = {
        vendorId: 'vendor-123',
        mappingType: 'unit',
        erpCode: 'KG',
        restoCode: 'kilogram',
        restoLabel: 'Kilogramme',
      };

      const result = await service.createMapping(dto);

      expect(result).toBeNull();
    });
  });

  describe('updateMapping', () => {
    it('should update mapping and invalidate cache', async () => {
      repository.findById.mockResolvedValue(mockMapping);
      repository.update.mockResolvedValue({ ...mockMapping, restoLabel: 'Kilogrammes' });

      const result = await service.updateMapping('mapping-uuid', { restoLabel: 'Kilogrammes' });

      expect(result?.restoLabel).toBe('Kilogrammes');
      expect(repository.findById).toHaveBeenCalledWith('mapping-uuid');
      expect(repository.update).toHaveBeenCalledWith('mapping-uuid', { restoLabel: 'Kilogrammes' });
      expect(logger.info).toHaveBeenCalledWith('Mapping updated and cache invalidated', {
        mappingId: 'mapping-uuid',
      });
    });

    it('should return null if mapping not found', async () => {
      repository.findById.mockResolvedValue(null);

      const result = await service.updateMapping('mapping-uuid', { restoLabel: 'Updated' });

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith('Mapping not found for update', {
        id: 'mapping-uuid',
      });
    });
  });

  describe('deleteMapping', () => {
    it('should deactivate mapping and invalidate cache', async () => {
      repository.findById.mockResolvedValue(mockMapping);
      repository.deactivate.mockResolvedValue({ ...mockMapping, isActive: false });

      const result = await service.deleteMapping('mapping-uuid');

      expect(result?.isActive).toBe(false);
      expect(repository.findById).toHaveBeenCalledWith('mapping-uuid');
      expect(repository.deactivate).toHaveBeenCalledWith('mapping-uuid');
      expect(logger.info).toHaveBeenCalledWith('Mapping deactivated and cache invalidated', {
        mappingId: 'mapping-uuid',
      });
    });

    it('should return null if mapping not found', async () => {
      repository.findById.mockResolvedValue(null);

      const result = await service.deleteMapping('mapping-uuid');

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith('Mapping not found for deletion', {
        id: 'mapping-uuid',
      });
    });
  });

  describe('listMappings', () => {
    it('should list mappings with pagination', async () => {
      const mappings = [mockMapping];
      repository.findAll.mockResolvedValue({ data: mappings, total: 1 });

      const result = await service.listMappings('vendor-123', 'unit', false, 1, 50);

      expect(result).toEqual({
        data: mappings,
        total: 1,
        page: 1,
        limit: 50,
      });
      expect(repository.findAll).toHaveBeenCalledWith('vendor-123', 'unit', false, 1, 50);
    });
  });

  describe('seed', () => {
    it('should bulk insert mappings and clear cache', async () => {
      const seedDto = {
        vendorId: 'vendor-123',
        mappings: [
          {
            mappingType: 'unit',
            erpCode: 'KG',
            restoCode: 'kilogram',
            restoLabel: 'Kilogramme',
          },
          { mappingType: 'unit', erpCode: 'L', restoCode: 'liter', restoLabel: 'Litre' },
        ],
      };

      const inserted = [mockMapping, { ...mockMapping, erpCode: 'L', restoCode: 'liter' }];
      repository.bulkInsert.mockResolvedValue(inserted);

      const result = await service.seed(seedDto);

      expect(result.length).toBe(2);
      expect(repository.bulkInsert).toHaveBeenCalledWith([
        {
          vendorId: 'vendor-123',
          mappingType: 'unit',
          erpCode: 'KG',
          restoCode: 'kilogram',
          restoLabel: 'Kilogramme',
          isActive: true,
        },
        {
          vendorId: 'vendor-123',
          mappingType: 'unit',
          erpCode: 'L',
          restoCode: 'liter',
          restoLabel: 'Litre',
          isActive: true,
        },
      ]);
      expect(logger.info).toHaveBeenCalledWith('Mappings seeded and cache cleared', {
        vendorId: 'vendor-123',
        count: 2,
      });
    });
  });

  describe('cache management', () => {
    it('should evict oldest entry when cache exceeds max size', async () => {
      // Fill cache to max size
      for (let i = 0; i < 10_000; i++) {
        repository.findByVendorTypeCode.mockResolvedValue({
          ...mockMapping,
          erpCode: `CODE-${i}`,
        });
        await service.resolve('vendor-123', 'unit', `CODE-${i}`);
      }

      const statsBefore = service.getCacheStats();
      expect(statsBefore.size).toBe(10_000);

      // Add one more - should trigger LRU eviction
      repository.findByVendorTypeCode.mockResolvedValue({
        ...mockMapping,
        erpCode: 'CODE-NEW',
      });
      await service.resolve('vendor-123', 'unit', 'CODE-NEW');

      const statsAfter = service.getCacheStats();
      expect(statsAfter.size).toBe(10_000); // Should still be at max
      expect(logger.debug).toHaveBeenCalledWith('LRU eviction triggered', {
        evictedKey: expect.any(String),
      });
    });

    it('should clear all cache entries', () => {
      repository.findByVendorTypeCode.mockResolvedValue(mockMapping);

      // Add some cache entries
      service.resolve('vendor-123', 'unit', 'KG');

      // Clear cache
      service.clearCache();

      const stats = service.getCacheStats();
      expect(stats.size).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(logger.info).toHaveBeenCalledWith('Cache cleared');
    });

    it('should track cache hit rate', async () => {
      // Clear any previous cache/stats for this test
      service.clearCache();
      repository.findByVendorTypeCode.mockResolvedValue(mockMapping);

      // First call - miss
      const result1 = await service.resolve('vendor-123', 'unit', 'KG');
      expect(result1).not.toBeNull();

      // Three more calls - hits
      const result2 = await service.resolve('vendor-123', 'unit', 'KG');
      const result3 = await service.resolve('vendor-123', 'unit', 'KG');
      const result4 = await service.resolve('vendor-123', 'unit', 'KG');
      expect(result2).not.toBeNull();
      expect(result3).not.toBeNull();
      expect(result4).not.toBeNull();

      const stats = service.getCacheStats();
      expect(stats.hits).toBe(3);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(75); // 3/4 = 75%
      expect(stats.missRate).toBe(25); // 1/4 = 25%
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', async () => {
      repository.findByVendorTypeCode.mockResolvedValue(mockMapping);

      // Add some cache entries
      await service.resolve('vendor-123', 'unit', 'KG');
      await service.resolve('vendor-123', 'unit', 'L');

      const stats = service.getCacheStats();

      expect(stats).toEqual({
        size: 2,
        maxSize: 10_000,
        hitRate: 0,
        missRate: 100,
        hits: 0,
        misses: 2,
      });
    });
  });
});
