/**
 * ReconciliationService Unit Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';
import { ReconciliationService } from '../reconciliation.service';
import { ReconciliationEventsRepository } from '../../../../database/adapters';
import { AgentRegistryService } from '../agent-registry.service';
import { AgentCommunicationService } from '../agent-communication.service';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import type { DatabaseConnection } from '@repo/shared';

describe('ReconciliationService', () => {
  let service: ReconciliationService;
  let reconciliationRepo: jest.Mocked<ReconciliationEventsRepository>;
  let agentRegistryService: jest.Mocked<AgentRegistryService>;
  let agentCommunicationService: jest.Mocked<AgentCommunicationService>;
  let db: any;
  let logger: jest.Mocked<PinoLogger>;

  beforeEach(async () => {
    // Mock repositories
    reconciliationRepo = {
      create: jest.fn().mockResolvedValue({ id: 'event-1' }),
      findByVendor: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      findRecent: jest.fn().mockResolvedValue([]),
      deleteOlderThan: jest.fn().mockResolvedValue(null),
      getMetrics: jest.fn().mockResolvedValue(null),
    } as unknown as jest.Mocked<ReconciliationEventsRepository>;

    agentRegistryService = {
      getAllAgents: jest.fn(),
    } as unknown as jest.Mocked<AgentRegistryService>;

    agentCommunicationService = {
      callAgent: jest.fn(),
    } as unknown as jest.Mocked<AgentCommunicationService>;

    // Mock database connection with proper chaining
    db = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      onConflictDoUpdate: jest.fn().mockResolvedValue(undefined),
    };

    logger = {
      setContext: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as unknown as jest.Mocked<PinoLogger>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReconciliationService,
        { provide: PinoLogger, useValue: logger },
        { provide: ReconciliationEventsRepository, useValue: reconciliationRepo },
        { provide: AgentRegistryService, useValue: agentRegistryService },
        { provide: AgentCommunicationService, useValue: agentCommunicationService },
        { provide: DATABASE_CONNECTION, useValue: db },
      ],
    }).compile();

    service = module.get<ReconciliationService>(ReconciliationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('detectDrift', () => {
    it('should return null when agent checksum call fails', async () => {
      agentCommunicationService.callAgent.mockResolvedValue(null);

      const result = await service.detectDrift('vendor-1');

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to get checksum'));
    });

    it('should handle errors gracefully', async () => {
      agentCommunicationService.callAgent.mockRejectedValue(new Error('Network error'));

      const result = await service.detectDrift('vendor-1');

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Drift detection failed'),
        expect.any(Object),
      );
    });
  });

  describe('binarySearchSync', () => {
    it('should return empty array when no items found', async () => {
      const vendorId = 'vendor-1';

      // Mock SKU range query - no items
      db.orderBy.mockResolvedValueOnce([{ minSku: null, maxSku: null }]);

      const result = await service.binarySearchSync(vendorId, null, null);

      expect(result).toEqual([]);
    });
  });

  describe('resolveConflict', () => {
    it('should return null when agent call fails', async () => {
      agentCommunicationService.callAgent.mockResolvedValue(null);

      const result = await service.resolveConflict('vendor-1', ['SKU001']);

      expect(result).toBeNull();
    });

    it('should resolve conflicts with ERP data (ERP wins)', async () => {
      const vendorId = 'vendor-1';
      const driftedSkus = ['SKU001'];

      // Mock agent call to get ERP items
      agentCommunicationService.callAgent.mockResolvedValue([
        {
          sku: 'SKU001',
          name: 'Item from ERP',
          description: 'ERP description',
          unitCode: 'KG',
          unitLabel: 'Kilogramme',
          vatCode: 'FR20',
          vatRate: 20.0,
          unitPrice: 10.99,
        },
      ]);

      // Mock DB insert chain
      const mockOnConflictDoUpdate = jest.fn().mockResolvedValue(undefined);
      const mockValues = jest.fn().mockReturnValue({
        onConflictDoUpdate: mockOnConflictDoUpdate,
      });
      db.insert.mockReturnValue({
        values: mockValues,
      });

      const result = await service.resolveConflict(vendorId, driftedSkus);

      expect(result).toBeDefined();
      expect(result?.conflictsFound).toBe(1);
      expect(result?.conflictsResolved).toBe(1);
      expect(reconciliationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          vendorId,
          eventType: 'drift_resolved',
        }),
      );
    });

    it('should handle individual item upsert failures gracefully', async () => {
      const vendorId = 'vendor-1';
      const driftedSkus = ['SKU001', 'SKU002'];

      // Mock agent call
      agentCommunicationService.callAgent.mockResolvedValue([
        {
          sku: 'SKU001',
          name: 'Item 1',
          unitCode: 'KG',
          unitLabel: 'Kilogramme',
          vatCode: 'FR20',
          vatRate: 20.0,
          unitPrice: 10.0,
        },
        {
          sku: 'SKU002',
          name: 'Item 2',
          unitCode: 'KG',
          unitLabel: 'Kilogramme',
          vatCode: 'FR20',
          vatRate: 20.0,
          unitPrice: 20.0,
        },
      ]);

      // Mock DB insert to fail on second item
      let callCount = 0;
      db.insert.mockImplementation(() => {
        callCount++;
        return {
          values: jest.fn().mockReturnValue({
            onConflictDoUpdate: jest.fn().mockImplementation(() => {
              if (callCount === 2) {
                throw new Error('DB error');
              }
              return Promise.resolve();
            }),
          }),
        };
      });

      const result = await service.resolveConflict(vendorId, driftedSkus);

      expect(result).toBeDefined();
      expect(result?.conflictsFound).toBe(2);
      expect(result?.conflictsResolved).toBe(1); // Only first succeeded
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('triggerFullSync', () => {
    it('should trigger drift detection for specific vendor', async () => {
      const vendorId = 'vendor-1';

      agentCommunicationService.callAgent.mockResolvedValue({
        checksum: 'abc123',
        itemCount: 100,
      });

      db.orderBy.mockResolvedValue([]);

      const result = await service.triggerFullSync(vendorId);

      expect(result).toBeDefined();
      expect(result?.vendorId).toBe(vendorId);
    });
  });

  describe('triggerFullSyncAll', () => {
    it('should trigger drift detection for all active vendors', async () => {
      agentRegistryService.getAllAgents.mockResolvedValue([
        { vendorId: 'vendor-1', status: 'online', agentUrl: 'http://agent1' },
        { vendorId: 'vendor-2', status: 'degraded', agentUrl: 'http://agent2' },
        { vendorId: 'vendor-3', status: 'offline', agentUrl: 'http://agent3' },
      ] as any);

      agentCommunicationService.callAgent.mockResolvedValue({
        checksum: 'abc123',
        itemCount: 100,
      });

      db.orderBy.mockResolvedValue([]);

      const results = await service.triggerFullSyncAll();

      expect(results).toHaveLength(2); // Only online and degraded
      expect(agentCommunicationService.callAgent).toHaveBeenCalledTimes(2);
    });
  });
});
