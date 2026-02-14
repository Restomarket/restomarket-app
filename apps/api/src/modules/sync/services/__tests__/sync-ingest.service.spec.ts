import { Test, TestingModule } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';
import { SyncIngestService } from '../sync-ingest.service';
import { ErpMappingService } from '../erp-mapping.service';
import { ItemsRepository, WarehousesRepository, StockRepository } from '@database/adapters';

describe('SyncIngestService', () => {
  let service: SyncIngestService;
  let erpMappingService: jest.Mocked<ErpMappingService>;
  let itemsRepository: jest.Mocked<ItemsRepository>;
  let warehousesRepository: jest.Mocked<WarehousesRepository>;

  beforeEach(async () => {
    const mockItemsRepository = {
      findByVendorAndSku: jest.fn().mockResolvedValue(null),
      upsertBatch: jest.fn().mockResolvedValue([]),
    };

    const mockWarehousesRepository = {
      findByVendorAndErpId: jest.fn().mockResolvedValue(null),
      upsertBatch: jest.fn().mockResolvedValue([]),
    };

    const mockStockRepository = {
      findByVendorWarehouseItem: jest.fn().mockResolvedValue(null),
      upsertBatch: jest.fn().mockResolvedValue([]),
    };

    const mockErpMappingService = {
      resolve: jest.fn(),
    };

    const mockLogger = {
      setContext: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncIngestService,
        {
          provide: ItemsRepository,
          useValue: mockItemsRepository,
        },
        {
          provide: WarehousesRepository,
          useValue: mockWarehousesRepository,
        },
        {
          provide: StockRepository,
          useValue: mockStockRepository,
        },
        {
          provide: ErpMappingService,
          useValue: mockErpMappingService,
        },
        {
          provide: PinoLogger,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<SyncIngestService>(SyncIngestService);
    erpMappingService = module.get(ErpMappingService);
    itemsRepository = module.get(ItemsRepository);
    warehousesRepository = module.get(WarehousesRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handleItemChanges', () => {
    it('should reject payloads exceeding incremental limit', async () => {
      const vendorId = 'vendor123';
      const items = Array(501).fill({
        sku: 'SKU001',
        name: 'Test Item',
        erpUnitCode: 'KG',
        erpVatCode: 'VAT20',
        contentHash: 'hash123',
        lastSyncedAt: new Date().toISOString(),
      });

      await expect(service.handleItemChanges(vendorId, items, false)).rejects.toThrow(
        'Maximum 500 items per incremental sync request',
      );
    });

    it('should reject payloads exceeding batch limit', async () => {
      const vendorId = 'vendor123';
      const items = Array(5001).fill({
        sku: 'SKU001',
        name: 'Test Item',
        erpUnitCode: 'KG',
        erpVatCode: 'VAT20',
        contentHash: 'hash123',
        lastSyncedAt: new Date().toISOString(),
      });

      await expect(service.handleItemChanges(vendorId, items, true)).rejects.toThrow(
        'Maximum 5000 items per batch sync request',
      );
    });

    it('should skip items with matching content hash', async () => {
      const vendorId = 'vendor123';
      const contentHash = 'hash123';

      itemsRepository.findByVendorAndSku.mockResolvedValueOnce({
        id: 'item-id-1',
        vendorId,
        sku: 'SKU001',
        contentHash,
        lastSyncedAt: new Date(),
      } as any);

      const items = [
        {
          sku: 'SKU001',
          name: 'Test Item',
          erpUnitCode: 'KG',
          erpVatCode: 'VAT20',
          contentHash,
          lastSyncedAt: new Date().toISOString(),
        },
      ];

      const result = await service.handleItemChanges(vendorId, items, false);

      expect(result.skipped).toBe(1);
      expect(result.processed).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.results[0]?.status).toBe('skipped');
      expect(result.results[0]?.reason).toBe('no_changes');
    });

    it('should fail items with unmapped unit codes', async () => {
      const vendorId = 'vendor123';

      itemsRepository.findByVendorAndSku.mockResolvedValueOnce(null);
      erpMappingService.resolve.mockResolvedValueOnce(null);

      const items = [
        {
          sku: 'SKU001',
          name: 'Test Item',
          erpUnitCode: 'UNKNOWN_UNIT',
          erpVatCode: 'VAT20',
          contentHash: 'hash123',
          lastSyncedAt: new Date().toISOString(),
        },
      ];

      const result = await service.handleItemChanges(vendorId, items, false);

      expect(result.failed).toBe(1);
      expect(result.processed).toBe(0);
      expect(result.results[0]?.status).toBe('failed');
      expect(result.results[0]?.reason).toContain('unmapped_unit');
    });

    it('should process valid items and call upsertBatch', async () => {
      const vendorId = 'vendor123';

      itemsRepository.findByVendorAndSku.mockResolvedValueOnce(null);
      erpMappingService.resolve
        .mockResolvedValueOnce({ restoCode: 'KG', restoLabel: 'Kilogram' })
        .mockResolvedValueOnce({ restoCode: 'TVA20', restoLabel: '20' });

      const items = [
        {
          sku: 'SKU001',
          name: 'Test Item',
          erpUnitCode: 'KG',
          erpVatCode: 'VAT20',
          contentHash: 'hash123',
          lastSyncedAt: new Date().toISOString(),
        },
      ];

      const result = await service.handleItemChanges(vendorId, items, false);

      expect(result.processed).toBe(1);
      expect(result.failed).toBe(0);
      expect(itemsRepository.upsertBatch).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            vendorId,
            sku: 'SKU001',
            unitCode: 'KG',
            vatCode: 'TVA20',
          }),
        ]),
      );
    });
  });

  describe('handleStockChanges', () => {
    it('should reject payloads exceeding incremental limit', async () => {
      const vendorId = 'vendor123';
      const stockPayloads = Array(501).fill({
        itemSku: 'SKU001',
        erpWarehouseId: 'WH01',
        quantity: 100,
        reservedQuantity: 10,
        availableQuantity: 90,
        contentHash: 'hash123',
        lastSyncedAt: new Date().toISOString(),
      });

      await expect(service.handleStockChanges(vendorId, stockPayloads, false)).rejects.toThrow(
        'Maximum 500 stock records per incremental sync request',
      );
    });

    it('should fail stock when item not found', async () => {
      const vendorId = 'vendor123';

      itemsRepository.findByVendorAndSku.mockResolvedValueOnce(null);

      const stockPayloads = [
        {
          itemSku: 'SKU001',
          erpWarehouseId: 'WH01',
          realStock: 100,
          virtualStock: 90,
          reservedQuantity: 10,
          contentHash: 'hash123',
          lastSyncedAt: new Date().toISOString(),
        },
      ];

      const result = await service.handleStockChanges(vendorId, stockPayloads, false);

      expect(result.failed).toBe(1);
      expect(result.results[0]?.reason).toContain('item_not_found');
    });

    it('should fail stock when warehouse not found', async () => {
      const vendorId = 'vendor123';

      itemsRepository.findByVendorAndSku.mockResolvedValueOnce({ id: 'item-id-1' } as any);
      warehousesRepository.findByVendorAndErpId.mockResolvedValueOnce(null);

      const stockPayloads = [
        {
          itemSku: 'SKU001',
          erpWarehouseId: 'WH_UNKNOWN',
          realStock: 100,
          virtualStock: 90,
          reservedQuantity: 10,
          contentHash: 'hash123',
          lastSyncedAt: new Date().toISOString(),
        },
      ];

      const result = await service.handleStockChanges(vendorId, stockPayloads, false);

      expect(result.failed).toBe(1);
      expect(result.results[0]?.reason).toContain('warehouse_not_found');
    });
  });

  describe('handleWarehouseChanges', () => {
    it('should reject payloads exceeding incremental limit', async () => {
      const vendorId = 'vendor123';
      const warehousePayloads = Array(501).fill({
        erpWarehouseId: 'WH01',
        name: 'Warehouse 1',
        code: 'WH-01',
        contentHash: 'hash123',
        lastSyncedAt: new Date().toISOString(),
      });

      await expect(
        service.handleWarehouseChanges(vendorId, warehousePayloads, false),
      ).rejects.toThrow('Maximum 500 warehouses per incremental sync request');
    });

    it('should skip warehouses with matching content hash', async () => {
      const vendorId = 'vendor123';
      const contentHash = 'hash123';

      warehousesRepository.findByVendorAndErpId.mockResolvedValueOnce({
        id: 'wh-id-1',
        vendorId,
        erpWarehouseId: 'WH01',
        contentHash,
        lastSyncedAt: new Date(),
      } as any);

      const warehousePayloads = [
        {
          erpWarehouseId: 'WH01',
          name: 'Warehouse 1',
          code: 'WH-01',
          contentHash,
          lastSyncedAt: new Date().toISOString(),
        },
      ];

      const result = await service.handleWarehouseChanges(vendorId, warehousePayloads, false);

      expect(result.skipped).toBe(1);
      expect(result.results[0]?.reason).toBe('no_changes');
    });

    it('should process valid warehouses and call upsertBatch', async () => {
      const vendorId = 'vendor123';

      warehousesRepository.findByVendorAndErpId.mockResolvedValueOnce(null);

      const warehousePayloads = [
        {
          erpWarehouseId: 'WH01',
          name: 'Warehouse 1',
          code: 'WH-01',
          contentHash: 'hash123',
          lastSyncedAt: new Date().toISOString(),
        },
      ];

      const result = await service.handleWarehouseChanges(vendorId, warehousePayloads, false);

      expect(result.processed).toBe(1);
      expect(warehousesRepository.upsertBatch).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            vendorId,
            erpWarehouseId: 'WH01',
          }),
        ]),
      );
    });
  });
});
