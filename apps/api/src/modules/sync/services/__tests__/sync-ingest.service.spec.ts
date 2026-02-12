import { Test, TestingModule } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';
import { SyncIngestService } from '../sync-ingest.service';
import { ErpMappingService } from '../erp-mapping.service';
import { DATABASE_CONNECTION } from '../../../../database/database.module';

describe('SyncIngestService', () => {
  let service: SyncIngestService;
  let erpMappingService: jest.Mocked<ErpMappingService>;
  let db: any;

  beforeEach(async () => {
    // Mock database connection
    db = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([]),
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      onConflictDoUpdate: jest.fn().mockResolvedValue(undefined),
    };

    // Mock ERP mapping service
    const mockErpMappingService = {
      resolve: jest.fn(),
    };

    // Mock logger
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
          provide: DATABASE_CONNECTION,
          useValue: db,
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

      // Mock existing item with same content hash
      db.limit.mockResolvedValueOnce([
        {
          id: 'item-id-1',
          vendorId,
          sku: 'SKU001',
          contentHash,
          lastSyncedAt: new Date(),
        },
      ]);

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

      // Mock: no existing item
      db.limit.mockResolvedValueOnce([]);

      // Mock: unit mapping not found
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
  });

  describe('handleStockChanges', () => {
    it('should reject payloads exceeding incremental limit', async () => {
      const vendorId = 'vendor123';
      const stock = Array(501).fill({
        itemSku: 'SKU001',
        erpWarehouseId: 'WH01',
        quantity: 100,
        reservedQuantity: 10,
        availableQuantity: 90,
        contentHash: 'hash123',
        lastSyncedAt: new Date().toISOString(),
      });

      await expect(service.handleStockChanges(vendorId, stock, false)).rejects.toThrow(
        'Maximum 500 stock records per incremental sync request',
      );
    });
  });

  describe('handleWarehouseChanges', () => {
    it('should reject payloads exceeding incremental limit', async () => {
      const vendorId = 'vendor123';
      const warehouses = Array(501).fill({
        erpWarehouseId: 'WH01',
        name: 'Warehouse 1',
        contentHash: 'hash123',
        lastSyncedAt: new Date().toISOString(),
      });

      await expect(service.handleWarehouseChanges(vendorId, warehouses, false)).rejects.toThrow(
        'Maximum 500 warehouses per incremental sync request',
      );
    });
  });
});
