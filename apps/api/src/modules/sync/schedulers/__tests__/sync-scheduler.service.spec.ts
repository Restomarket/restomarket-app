import { Test, TestingModule } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';
import { SyncSchedulerService } from '../sync-scheduler.service';
import { ReconciliationService } from '../../services/reconciliation.service';
import { AgentRegistryService } from '../../services/agent-registry.service';
import { DeadLetterQueueService } from '../../services/dead-letter-queue.service';
import { SyncCleanupService } from '../../services/sync-cleanup.service';
import { AlertService } from '../../services/alert.service';

describe('SyncSchedulerService', () => {
  let service: SyncSchedulerService;
  let reconciliationService: jest.Mocked<ReconciliationService>;
  let agentRegistryService: jest.Mocked<AgentRegistryService>;
  let dlqService: jest.Mocked<DeadLetterQueueService>;
  let cleanupService: jest.Mocked<SyncCleanupService>;
  let alertService: jest.Mocked<AlertService>;
  let logger: jest.Mocked<PinoLogger>;

  beforeEach(async () => {
    const mockReconciliationService = {
      triggerFullSyncAll: jest.fn(),
    };

    const mockAgentRegistryService = {
      checkHealth: jest.fn(),
    };

    const mockDlqService = {
      getUnresolvedCount: jest.fn(),
    };

    const mockCleanupService = {
      cleanupExpiredJobs: jest.fn(),
      archiveReconciliationEvents: jest.fn(),
      cleanupResolvedDLQ: jest.fn(),
    };

    const mockAlertService = {
      sendAlert: jest.fn(),
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
        SyncSchedulerService,
        { provide: ReconciliationService, useValue: mockReconciliationService },
        { provide: AgentRegistryService, useValue: mockAgentRegistryService },
        { provide: DeadLetterQueueService, useValue: mockDlqService },
        { provide: SyncCleanupService, useValue: mockCleanupService },
        { provide: AlertService, useValue: mockAlertService },
        { provide: PinoLogger, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<SyncSchedulerService>(SyncSchedulerService);
    reconciliationService = module.get(ReconciliationService) as jest.Mocked<ReconciliationService>;
    agentRegistryService = module.get(AgentRegistryService) as jest.Mocked<AgentRegistryService>;
    dlqService = module.get(DeadLetterQueueService) as jest.Mocked<DeadLetterQueueService>;
    cleanupService = module.get(SyncCleanupService) as jest.Mocked<SyncCleanupService>;
    alertService = module.get(AlertService) as jest.Mocked<AlertService>;
    logger = module.get(PinoLogger) as jest.Mocked<PinoLogger>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('detectDrift', () => {
    it('should trigger full sync for all vendors', async () => {
      const mockResults = [
        {
          vendorId: 'vendor1',
          hasDrift: false,
          erpChecksum: 'abc123',
          dbChecksum: 'abc123',
          itemCount: 10,
          detectedAt: new Date(),
          durationMs: 100,
        },
        {
          vendorId: 'vendor2',
          hasDrift: true,
          erpChecksum: 'def456',
          dbChecksum: 'xyz789',
          itemCount: 20,
          driftedItems: ['SKU1', 'SKU2'],
          detectedAt: new Date(),
          durationMs: 200,
        },
      ];
      reconciliationService.triggerFullSyncAll.mockResolvedValue(mockResults);

      await service.detectDrift();

      expect(reconciliationService.triggerFullSyncAll).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          vendorsProcessed: 2,
          driftDetected: 1,
        }),
        'Scheduled drift detection completed',
      );
    });

    it('should send alerts for vendors with drift', async () => {
      const mockResults = [
        {
          vendorId: 'vendor2',
          hasDrift: true,
          erpChecksum: 'def456',
          dbChecksum: 'xyz789',
          itemCount: 20,
          driftedItems: ['SKU1', 'SKU2'],
          detectedAt: new Date(),
          durationMs: 200,
        },
      ];
      reconciliationService.triggerFullSyncAll.mockResolvedValue(mockResults);

      await service.detectDrift();

      expect(alertService.sendAlert).toHaveBeenCalledWith(
        'reconciliation_drift',
        'Drift detected and resolved for vendor vendor2',
        {
          vendorId: 'vendor2',
          count: 2,
          details: { driftedSkusFound: 2 },
        },
      );
    });

    it('should handle errors during drift detection', async () => {
      reconciliationService.triggerFullSyncAll.mockRejectedValue(new Error('Database error'));

      await service.detectDrift();

      expect(logger.error).toHaveBeenCalledWith(
        { error: 'Database error' },
        'Failed to run scheduled drift detection',
      );
    });
  });

  describe('checkAgentHealth', () => {
    it('should check agent health and log changes', async () => {
      const mockChangedAgents = [
        {
          vendorId: 'vendor1',
          oldStatus: 'online',
          newStatus: 'degraded',
        },
      ];
      agentRegistryService.checkHealth.mockResolvedValue(mockChangedAgents);

      await service.checkAgentHealth();

      expect(agentRegistryService.checkHealth).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          changedCount: 1,
          agents: [{ vendorId: 'vendor1', newStatus: 'degraded' }],
        }),
        'Agent status changes detected',
      );
    });

    it('should send alerts for agents that went offline', async () => {
      const mockChangedAgents = [
        {
          vendorId: 'vendor1',
          oldStatus: 'degraded',
          newStatus: 'offline',
        },
      ];
      agentRegistryService.checkHealth.mockResolvedValue(mockChangedAgents);

      await service.checkAgentHealth();

      expect(alertService.sendAlert).toHaveBeenCalledWith(
        'agent_offline',
        'Agent vendor1 is now offline',
        expect.objectContaining({
          vendorId: 'vendor1',
          details: expect.objectContaining({
            oldStatus: 'degraded',
            newStatus: 'offline',
          }),
        }),
      );
    });

    it('should log debug when no status changes', async () => {
      agentRegistryService.checkHealth.mockResolvedValue([]);

      await service.checkAgentHealth();

      expect(logger.debug).toHaveBeenCalledWith('No agent status changes detected');
    });

    it('should handle errors during health check', async () => {
      agentRegistryService.checkHealth.mockRejectedValue(new Error('Connection error'));

      await service.checkAgentHealth();

      expect(logger.error).toHaveBeenCalledWith(
        { error: 'Connection error' },
        'Failed to run scheduled agent health check',
      );
    });
  });

  describe('checkDLQ', () => {
    it('should send alert when unresolved entries exist', async () => {
      dlqService.getUnresolvedCount.mockResolvedValue(5);

      await service.checkDLQ();

      expect(dlqService.getUnresolvedCount).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        { unresolvedCount: 5 },
        'Unresolved DLQ entries found',
      );
      expect(alertService.sendAlert).toHaveBeenCalledWith(
        'dlq_entries_found',
        '5 unresolved entries in Dead Letter Queue',
        { count: 5, threshold: 0 },
      );
    });

    it('should not send alert when no unresolved entries', async () => {
      dlqService.getUnresolvedCount.mockResolvedValue(0);

      await service.checkDLQ();

      expect(logger.debug).toHaveBeenCalledWith('No unresolved DLQ entries');
      expect(alertService.sendAlert).not.toHaveBeenCalled();
    });

    it('should handle errors during DLQ check', async () => {
      dlqService.getUnresolvedCount.mockRejectedValue(new Error('Query error'));

      await service.checkDLQ();

      expect(logger.error).toHaveBeenCalledWith(
        { error: 'Query error' },
        'Failed to run scheduled DLQ check',
      );
    });
  });

  describe('cleanupExpiredJobs', () => {
    it('should cleanup expired jobs and log result', async () => {
      cleanupService.cleanupExpiredJobs.mockResolvedValue(10);

      await service.cleanupExpiredJobs();

      expect(cleanupService.cleanupExpiredJobs).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        { deletedCount: 10 },
        'Scheduled job cleanup completed',
      );
    });

    it('should handle errors during cleanup', async () => {
      cleanupService.cleanupExpiredJobs.mockRejectedValue(new Error('Delete error'));

      await service.cleanupExpiredJobs();

      expect(logger.error).toHaveBeenCalledWith(
        { error: 'Delete error' },
        'Failed to run scheduled job cleanup',
      );
    });
  });

  describe('archiveReconEvents', () => {
    it('should archive reconciliation events and log result', async () => {
      cleanupService.archiveReconciliationEvents.mockResolvedValue(25);

      await service.archiveReconEvents();

      expect(cleanupService.archiveReconciliationEvents).toHaveBeenCalledWith(30);
      expect(logger.info).toHaveBeenCalledWith(
        { deletedCount: 25 },
        'Scheduled reconciliation events archive completed',
      );
    });

    it('should handle errors during archive', async () => {
      cleanupService.archiveReconciliationEvents.mockRejectedValue(new Error('Archive error'));

      await service.archiveReconEvents();

      expect(logger.error).toHaveBeenCalledWith(
        { error: 'Archive error' },
        'Failed to run scheduled reconciliation events archive',
      );
    });
  });

  describe('cleanupResolvedDLQ', () => {
    it('should cleanup resolved DLQ entries and log result', async () => {
      cleanupService.cleanupResolvedDLQ.mockResolvedValue(15);

      await service.cleanupResolvedDLQ();

      expect(cleanupService.cleanupResolvedDLQ).toHaveBeenCalledWith(30);
      expect(logger.info).toHaveBeenCalledWith(
        { deletedCount: 15 },
        'Scheduled DLQ cleanup completed',
      );
    });

    it('should handle errors during DLQ cleanup', async () => {
      cleanupService.cleanupResolvedDLQ.mockRejectedValue(new Error('DLQ cleanup error'));

      await service.cleanupResolvedDLQ();

      expect(logger.error).toHaveBeenCalledWith(
        { error: 'DLQ cleanup error' },
        'Failed to run scheduled DLQ cleanup',
      );
    });
  });
});
