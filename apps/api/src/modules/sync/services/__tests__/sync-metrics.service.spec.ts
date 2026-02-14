import { Test, TestingModule } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';
import { SyncMetricsService } from '../sync-metrics.service';
import {
  SyncJobsRepository,
  ReconciliationEventsRepository,
  AgentRegistryRepository,
} from '../../../../database/adapters';

describe('SyncMetricsService', () => {
  let service: SyncMetricsService;
  let syncJobsRepo: jest.Mocked<SyncJobsRepository>;
  let reconciliationRepo: jest.Mocked<ReconciliationEventsRepository>;
  let agentRepo: jest.Mocked<AgentRegistryRepository>;
  let logger: jest.Mocked<PinoLogger>;

  beforeEach(async () => {
    const mockSyncJobsRepo = {
      getMetrics: jest.fn(),
      findById: jest.fn(),
    };

    const mockReconciliationRepo = {
      getMetrics: jest.fn(),
    };

    const mockAgentRepo = {
      findAll: jest.fn(),
    };

    const mockLogger = {
      setContext: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncMetricsService,
        { provide: SyncJobsRepository, useValue: mockSyncJobsRepo },
        { provide: ReconciliationEventsRepository, useValue: mockReconciliationRepo },
        { provide: AgentRegistryRepository, useValue: mockAgentRepo },
        { provide: PinoLogger, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<SyncMetricsService>(SyncMetricsService);
    syncJobsRepo = module.get(SyncJobsRepository);
    reconciliationRepo = module.get(ReconciliationEventsRepository);
    agentRepo = module.get(AgentRegistryRepository);
    logger = module.get(PinoLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getSyncMetrics', () => {
    it('should return sync metrics with calculated success and retry rates', async () => {
      syncJobsRepo.getMetrics.mockResolvedValue({
        total: 100,
        pending: 5,
        processing: 3,
        completed: 80,
        failed: 12,
        avgLatencyMs: 1500,
        retryRate: 15.5,
      });

      const result = await service.getSyncMetrics('vendor-123');

      expect(result).toEqual({
        total: 100,
        pending: 5,
        processing: 3,
        completed: 80,
        failed: 12,
        successRate: '80.0',
        avgLatencyMs: 1500,
        p95LatencyMs: 2250, // avgLatency * 1.5
        retryRate: '15.5',
      });

      expect(syncJobsRepo.getMetrics).toHaveBeenCalledWith('vendor-123');
      expect(logger.debug).toHaveBeenCalledWith('Getting sync metrics', { vendorId: 'vendor-123' });
    });

    it('should return zero metrics when total is zero', async () => {
      syncJobsRepo.getMetrics.mockResolvedValue({
        total: 0,
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        avgLatencyMs: 0,
        retryRate: 0,
      });

      const result = await service.getSyncMetrics('vendor-123');

      expect(result.successRate).toBe('0.0');
      expect(result.retryRate).toBe('0.0');
      expect(result.total).toBe(0);
    });

    it('should return zero metrics on repository error', async () => {
      syncJobsRepo.getMetrics.mockRejectedValue(new Error('Database error'));

      const result = await service.getSyncMetrics('vendor-123');

      expect(result).toEqual({
        total: 0,
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        successRate: '0.0',
        avgLatencyMs: 0,
        p95LatencyMs: 0,
        retryRate: '0.0',
      });

      expect(logger.error).toHaveBeenCalledWith('Failed to get sync metrics', {
        vendorId: 'vendor-123',
        error: 'Database error',
      });
    });

    it('should calculate success rate correctly', async () => {
      syncJobsRepo.getMetrics.mockResolvedValue({
        total: 200,
        pending: 10,
        processing: 5,
        completed: 170,
        failed: 15,
        avgLatencyMs: 2000,
        retryRate: 12.5,
      });

      const result = await service.getSyncMetrics('vendor-123');

      expect(result.successRate).toBe('85.0'); // (170 / 200) * 100
    });
  });

  describe('getReconciliationMetrics', () => {
    it('should return reconciliation metrics with calculated drift frequency', async () => {
      reconciliationRepo.getMetrics.mockResolvedValue({
        totalEvents: 50,
        driftDetected: 5,
        driftResolved: 4,
        fullChecksums: 20,
        incrementalSyncs: 30,
        avgDurationMs: 3500,
        lastRun: new Date('2025-01-15T10:00:00Z'),
      });

      const result = await service.getReconciliationMetrics('vendor-123');

      expect(result).toEqual({
        eventCount: 50,
        driftDetected: 5,
        driftResolved: 4,
        fullChecksums: 20,
        incrementalSyncs: 30,
        avgDurationMs: 3500,
        lastRun: new Date('2025-01-15T10:00:00Z'),
        driftFrequency: '10.0', // (5 / 50) * 100
      });

      expect(reconciliationRepo.getMetrics).toHaveBeenCalledWith('vendor-123');
    });

    it('should return zero drift frequency when no checks', async () => {
      reconciliationRepo.getMetrics.mockResolvedValue({
        totalEvents: 0,
        driftDetected: 0,
        driftResolved: 0,
        fullChecksums: 0,
        incrementalSyncs: 0,
        avgDurationMs: 0,
        lastRun: null,
      });

      const result = await service.getReconciliationMetrics('vendor-123');

      expect(result.driftFrequency).toBe('0.0');
      expect(result.lastRun).toBeNull();
    });

    it('should return zero metrics on repository error', async () => {
      reconciliationRepo.getMetrics.mockRejectedValue(new Error('Database error'));

      const result = await service.getReconciliationMetrics('vendor-123');

      expect(result).toEqual({
        eventCount: 0,
        driftDetected: 0,
        driftResolved: 0,
        fullChecksums: 0,
        incrementalSyncs: 0,
        avgDurationMs: 0,
        lastRun: null,
        driftFrequency: '0.0',
      });

      expect(logger.error).toHaveBeenCalledWith('Failed to get reconciliation metrics', {
        vendorId: 'vendor-123',
        error: 'Database error',
      });
    });
  });

  describe('getAgentHealth', () => {
    it('should return agent health dashboard with uptime percentages', async () => {
      agentRepo.findAll.mockResolvedValue([
        {
          id: '1',
          vendorId: 'vendor-1',
          agentUrl: 'http://agent1.local',
          erpType: 'ebp',
          status: 'online',
          lastHeartbeat: new Date('2025-01-15T10:00:00Z'),
          version: '1.0.0',
          authTokenHash: 'hash1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          vendorId: 'vendor-2',
          agentUrl: 'http://agent2.local',
          erpType: 'sage',
          status: 'degraded',
          lastHeartbeat: new Date('2025-01-15T09:55:00Z'),
          version: '1.0.0',
          authTokenHash: 'hash2',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '3',
          vendorId: 'vendor-3',
          agentUrl: 'http://agent3.local',
          erpType: 'odoo',
          status: 'offline',
          lastHeartbeat: new Date('2025-01-15T09:00:00Z'),
          version: '1.0.0',
          authTokenHash: 'hash3',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await service.getAgentHealth();

      expect(result.totalAgents).toBe(3);
      expect(result.onlineAgents).toBe(1);
      expect(result.degradedAgents).toBe(1);
      expect(result.offlineAgents).toBe(1);

      expect(result.agents).toHaveLength(3);
      expect(result.agents[0]).toEqual({
        vendorId: 'vendor-1',
        status: 'online',
        lastHeartbeat: expect.any(Date),
        uptimePercentage: '100.0',
      });
      expect(result.agents[1]).toEqual({
        vendorId: 'vendor-2',
        status: 'degraded',
        lastHeartbeat: expect.any(Date),
        uptimePercentage: '75.0',
      });
      expect(result.agents[2]).toEqual({
        vendorId: 'vendor-3',
        status: 'offline',
        lastHeartbeat: expect.any(Date),
        uptimePercentage: '0.0',
      });
    });

    it('should return empty dashboard when no agents', async () => {
      agentRepo.findAll.mockResolvedValue([]);

      const result = await service.getAgentHealth();

      expect(result).toEqual({
        agents: [],
        totalAgents: 0,
        onlineAgents: 0,
        degradedAgents: 0,
        offlineAgents: 0,
      });
    });

    it('should return empty dashboard on repository error', async () => {
      agentRepo.findAll.mockRejectedValue(new Error('Database error'));

      const result = await service.getAgentHealth();

      expect(result).toEqual({
        agents: [],
        totalAgents: 0,
        onlineAgents: 0,
        degradedAgents: 0,
        offlineAgents: 0,
      });

      expect(logger.error).toHaveBeenCalledWith('Failed to get agent health', {
        error: 'Database error',
      });
    });
  });

  describe('getJobDetails', () => {
    it('should return full job details when job exists', async () => {
      const mockJob = {
        id: 'job-123',
        postgresOrderId: 'order-456',
        vendorId: 'vendor-123',
        operation: 'create_order',
        status: 'completed',
        payload: { orderId: 'order-456', orderData: {} },
        retryCount: 1,
        maxRetries: 5,
        nextRetryAt: null,
        errorMessage: null,
        errorStack: null,
        erpReference: 'ERP-789',
        createdAt: new Date('2025-01-15T10:00:00Z'),
        startedAt: new Date('2025-01-15T10:00:05Z'),
        completedAt: new Date('2025-01-15T10:00:10Z'),
        expiresAt: new Date('2025-01-16T10:00:00Z'),
      };

      syncJobsRepo.findById.mockResolvedValue(mockJob);

      const result = await service.getJobDetails('job-123');

      expect(result).toEqual({
        id: 'job-123',
        postgresOrderId: 'order-456',
        vendorId: 'vendor-123',
        operation: 'create_order',
        status: 'completed',
        payload: { orderId: 'order-456', orderData: {} },
        retryCount: 1,
        maxRetries: 5,
        nextRetryAt: null,
        errorMessage: null,
        errorStack: null,
        erpReference: 'ERP-789',
        createdAt: expect.any(Date),
        startedAt: expect.any(Date),
        completedAt: expect.any(Date),
        expiresAt: expect.any(Date),
      });

      expect(syncJobsRepo.findById).toHaveBeenCalledWith('job-123');
    });

    it('should return null when job not found', async () => {
      syncJobsRepo.findById.mockResolvedValue(null);

      const result = await service.getJobDetails('job-123');

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith('Job not found', { jobId: 'job-123' });
    });

    it('should return null on repository error', async () => {
      syncJobsRepo.findById.mockRejectedValue(new Error('Database error'));

      const result = await service.getJobDetails('job-123');

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith('Failed to get job details', {
        jobId: 'job-123',
        error: 'Database error',
      });
    });
  });
});
