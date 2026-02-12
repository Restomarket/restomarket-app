import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { PinoLogger } from 'nestjs-pino';
import { SyncJobService } from '../sync-job.service';
import { SyncJobsRepository } from '@database/adapters';
import type { SyncJob } from '@repo/shared';
import type { Queue } from 'bullmq';

describe('SyncJobService', () => {
  let service: SyncJobService;
  let syncJobsRepository: jest.Mocked<SyncJobsRepository>;
  let orderSyncQueue: jest.Mocked<Queue>;
  let logger: jest.Mocked<PinoLogger>;

  beforeEach(async () => {
    // Mock SyncJobsRepository
    syncJobsRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByOrderId: jest.fn(),
      updateStatus: jest.fn(),
      findPending: jest.fn(),
      findRecent: jest.fn(),
    } as unknown as jest.Mocked<SyncJobsRepository>;

    // Mock BullMQ Queue
    orderSyncQueue = {
      add: jest.fn(),
    } as unknown as jest.Mocked<Queue>;

    // Mock PinoLogger
    logger = {
      setContext: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as unknown as jest.Mocked<PinoLogger>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncJobService,
        {
          provide: SyncJobsRepository,
          useValue: syncJobsRepository,
        },
        {
          provide: getQueueToken('order-sync'),
          useValue: orderSyncQueue,
        },
        {
          provide: PinoLogger,
          useValue: logger,
        },
      ],
    }).compile();

    service = module.get<SyncJobService>(SyncJobService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createOrderJob', () => {
    const mockOrderData = {
      customerName: 'Test Customer',
      items: [{ sku: 'ABC123', quantity: 10 }],
    };

    it('should create new sync job and enqueue BullMQ job', async () => {
      const mockJob: SyncJob = {
        id: 'job-123',
        postgresOrderId: 'order-456',
        vendorId: 'vendor-1',
        operation: 'create_order',
        status: 'pending',
        payload: mockOrderData,
        retryCount: 0,
        maxRetries: 5,
        nextRetryAt: null,
        errorMessage: null,
        errorStack: null,
        erpReference: null,
        createdAt: new Date(),
        startedAt: null,
        completedAt: null,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      syncJobsRepository.findByOrderId.mockResolvedValue(null);
      syncJobsRepository.create.mockResolvedValue(mockJob);
      orderSyncQueue.add.mockResolvedValue({} as never);

      const result = await service.createOrderJob('vendor-1', 'order-456', mockOrderData);

      expect(result).toBe('job-123');
      expect(syncJobsRepository.findByOrderId).toHaveBeenCalledWith('order-456');
      expect(syncJobsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          postgresOrderId: 'order-456',
          vendorId: 'vendor-1',
          operation: 'create_order',
          status: 'pending',
          payload: mockOrderData,
          retryCount: 0,
          maxRetries: 5,
        }),
      );
      expect(orderSyncQueue.add).toHaveBeenCalledWith(
        'create-order',
        expect.objectContaining({
          syncJobId: 'job-123',
          vendorId: 'vendor-1',
          orderId: 'order-456',
          orderData: mockOrderData,
        }),
        expect.objectContaining({
          attempts: 5,
          backoff: { type: 'exponential', delay: 60_000 },
          removeOnComplete: { age: 86_400 },
          removeOnFail: false,
        }),
      );
    });

    it('should return existing job ID if pending job exists (idempotency)', async () => {
      const existingJob: SyncJob = {
        id: 'existing-job-123',
        postgresOrderId: 'order-456',
        vendorId: 'vendor-1',
        operation: 'create_order',
        status: 'pending',
        payload: mockOrderData,
        retryCount: 0,
        maxRetries: 5,
        nextRetryAt: null,
        errorMessage: null,
        errorStack: null,
        erpReference: null,
        createdAt: new Date(),
        startedAt: null,
        completedAt: null,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      syncJobsRepository.findByOrderId.mockResolvedValue(existingJob);

      const result = await service.createOrderJob('vendor-1', 'order-456', mockOrderData);

      expect(result).toBe('existing-job-123');
      expect(syncJobsRepository.create).not.toHaveBeenCalled();
      expect(orderSyncQueue.add).not.toHaveBeenCalled();
    });

    it('should return existing job ID if processing job exists (idempotency)', async () => {
      const existingJob: SyncJob = {
        id: 'processing-job-123',
        postgresOrderId: 'order-456',
        vendorId: 'vendor-1',
        operation: 'create_order',
        status: 'processing',
        payload: mockOrderData,
        retryCount: 0,
        maxRetries: 5,
        nextRetryAt: null,
        errorMessage: null,
        errorStack: null,
        erpReference: null,
        createdAt: new Date(),
        startedAt: new Date(),
        completedAt: null,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      syncJobsRepository.findByOrderId.mockResolvedValue(existingJob);

      const result = await service.createOrderJob('vendor-1', 'order-456', mockOrderData);

      expect(result).toBe('processing-job-123');
      expect(syncJobsRepository.create).not.toHaveBeenCalled();
      expect(orderSyncQueue.add).not.toHaveBeenCalled();
    });

    it('should create new job if previous job is completed', async () => {
      const completedJob: SyncJob = {
        id: 'completed-job-123',
        postgresOrderId: 'order-456',
        vendorId: 'vendor-1',
        operation: 'create_order',
        status: 'completed',
        payload: mockOrderData,
        retryCount: 0,
        maxRetries: 5,
        nextRetryAt: null,
        errorMessage: null,
        errorStack: null,
        erpReference: 'ERP-REF-123',
        createdAt: new Date(),
        startedAt: new Date(),
        completedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      const newJob: SyncJob = {
        ...completedJob,
        id: 'new-job-456',
        status: 'pending',
        erpReference: null,
        completedAt: null,
      };

      syncJobsRepository.findByOrderId.mockResolvedValue(completedJob);
      syncJobsRepository.create.mockResolvedValue(newJob);
      orderSyncQueue.add.mockResolvedValue({} as never);

      const result = await service.createOrderJob('vendor-1', 'order-456', mockOrderData);

      expect(result).toBe('new-job-456');
      expect(syncJobsRepository.create).toHaveBeenCalled();
      expect(orderSyncQueue.add).toHaveBeenCalled();
    });

    it('should return null if database create fails', async () => {
      syncJobsRepository.findByOrderId.mockResolvedValue(null);
      syncJobsRepository.create.mockResolvedValue(null);

      const result = await service.createOrderJob('vendor-1', 'order-456', mockOrderData);

      expect(result).toBeNull();
      expect(orderSyncQueue.add).not.toHaveBeenCalled();
    });

    it('should include correlationId in logs and BullMQ payload', async () => {
      const mockJob: SyncJob = {
        id: 'job-123',
        postgresOrderId: 'order-456',
        vendorId: 'vendor-1',
        operation: 'create_order',
        status: 'pending',
        payload: mockOrderData,
        retryCount: 0,
        maxRetries: 5,
        nextRetryAt: null,
        errorMessage: null,
        errorStack: null,
        erpReference: null,
        createdAt: new Date(),
        startedAt: null,
        completedAt: null,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      syncJobsRepository.findByOrderId.mockResolvedValue(null);
      syncJobsRepository.create.mockResolvedValue(mockJob);
      orderSyncQueue.add.mockResolvedValue({} as never);

      const correlationId = 'corr-123';
      await service.createOrderJob('vendor-1', 'order-456', mockOrderData, correlationId);

      expect(orderSyncQueue.add).toHaveBeenCalledWith(
        'create-order',
        expect.objectContaining({
          correlationId,
        }),
        expect.any(Object),
      );
    });
  });

  describe('markProcessing', () => {
    it('should update job status to processing', async () => {
      const mockJob: SyncJob = {
        id: 'job-123',
        postgresOrderId: 'order-456',
        vendorId: 'vendor-1',
        operation: 'create_order',
        status: 'processing',
        payload: {},
        retryCount: 0,
        maxRetries: 5,
        nextRetryAt: null,
        errorMessage: null,
        errorStack: null,
        erpReference: null,
        createdAt: new Date(),
        startedAt: new Date(),
        completedAt: null,
        expiresAt: new Date(),
      };

      syncJobsRepository.updateStatus.mockResolvedValue(mockJob);

      const result = await service.markProcessing('job-123');

      expect(result).toEqual(mockJob);
      expect(syncJobsRepository.updateStatus).toHaveBeenCalledWith('job-123', 'processing');
    });

    it('should return null if job not found', async () => {
      syncJobsRepository.updateStatus.mockResolvedValue(null);

      const result = await service.markProcessing('nonexistent-job');

      expect(result).toBeNull();
    });
  });

  describe('markCompleted', () => {
    it('should update job status to completed with ERP reference', async () => {
      const mockJob: SyncJob = {
        id: 'job-123',
        postgresOrderId: 'order-456',
        vendorId: 'vendor-1',
        operation: 'create_order',
        status: 'completed',
        payload: {},
        retryCount: 0,
        maxRetries: 5,
        nextRetryAt: null,
        errorMessage: null,
        errorStack: null,
        erpReference: 'ERP-REF-789',
        createdAt: new Date(),
        startedAt: new Date(),
        completedAt: new Date(),
        expiresAt: new Date(),
      };

      syncJobsRepository.updateStatus.mockResolvedValue(mockJob);

      const result = await service.markCompleted('job-123', 'ERP-REF-789');

      expect(result).toEqual(mockJob);
      expect(syncJobsRepository.updateStatus).toHaveBeenCalledWith('job-123', 'completed', {
        erpReference: 'ERP-REF-789',
      });
    });

    it('should return null if job not found', async () => {
      syncJobsRepository.updateStatus.mockResolvedValue(null);

      const result = await service.markCompleted('nonexistent-job', 'ERP-REF-789');

      expect(result).toBeNull();
    });
  });

  describe('markFailed', () => {
    it('should update job status to failed with Error object', async () => {
      const mockJob: SyncJob = {
        id: 'job-123',
        postgresOrderId: 'order-456',
        vendorId: 'vendor-1',
        operation: 'create_order',
        status: 'failed',
        payload: {},
        retryCount: 2,
        maxRetries: 5,
        nextRetryAt: new Date(Date.now() + 60_000),
        errorMessage: 'Network timeout',
        errorStack: 'Error: Network timeout\n  at ...',
        erpReference: null,
        createdAt: new Date(),
        startedAt: new Date(),
        completedAt: null,
        expiresAt: new Date(),
      };

      syncJobsRepository.updateStatus.mockResolvedValue(mockJob);

      const error = new Error('Network timeout');
      const nextRetryAt = new Date(Date.now() + 60_000);
      const result = await service.markFailed('job-123', error, 2, nextRetryAt);

      expect(result).toEqual(mockJob);
      expect(syncJobsRepository.updateStatus).toHaveBeenCalledWith('job-123', 'failed', {
        errorMessage: 'Network timeout',
        errorStack: expect.stringContaining('Error: Network timeout'),
        retryCount: 2,
        nextRetryAt,
      });
    });

    it('should update job status to failed with string error message', async () => {
      const mockJob: SyncJob = {
        id: 'job-123',
        postgresOrderId: 'order-456',
        vendorId: 'vendor-1',
        operation: 'create_order',
        status: 'failed',
        payload: {},
        retryCount: 1,
        maxRetries: 5,
        nextRetryAt: null,
        errorMessage: 'ERP system unavailable',
        errorStack: null,
        erpReference: null,
        createdAt: new Date(),
        startedAt: new Date(),
        completedAt: null,
        expiresAt: new Date(),
      };

      syncJobsRepository.updateStatus.mockResolvedValue(mockJob);

      const result = await service.markFailed('job-123', 'ERP system unavailable', 1);

      expect(result).toEqual(mockJob);
      expect(syncJobsRepository.updateStatus).toHaveBeenCalledWith('job-123', 'failed', {
        errorMessage: 'ERP system unavailable',
        errorStack: undefined,
        retryCount: 1,
        nextRetryAt: undefined,
      });
    });

    it('should return null if job not found', async () => {
      syncJobsRepository.updateStatus.mockResolvedValue(null);

      const result = await service.markFailed('nonexistent-job', new Error('Test'));

      expect(result).toBeNull();
    });
  });

  describe('getJob', () => {
    it('should retrieve job by ID', async () => {
      const mockJob: SyncJob = {
        id: 'job-123',
        postgresOrderId: 'order-456',
        vendorId: 'vendor-1',
        operation: 'create_order',
        status: 'completed',
        payload: {},
        retryCount: 0,
        maxRetries: 5,
        nextRetryAt: null,
        errorMessage: null,
        errorStack: null,
        erpReference: 'ERP-REF-123',
        createdAt: new Date(),
        startedAt: new Date(),
        completedAt: new Date(),
        expiresAt: new Date(),
      };

      syncJobsRepository.findById.mockResolvedValue(mockJob);

      const result = await service.getJob('job-123');

      expect(result).toEqual(mockJob);
      expect(syncJobsRepository.findById).toHaveBeenCalledWith('job-123');
    });

    it('should return null if job not found', async () => {
      syncJobsRepository.findById.mockResolvedValue(null);

      const result = await service.getJob('nonexistent-job');

      expect(result).toBeNull();
    });
  });

  describe('getPendingJobs', () => {
    it('should retrieve pending jobs without vendor filter', async () => {
      const mockJobs: SyncJob[] = [
        {
          id: 'job-1',
          postgresOrderId: 'order-1',
          vendorId: 'vendor-1',
          operation: 'create_order',
          status: 'pending',
          payload: {},
          retryCount: 0,
          maxRetries: 5,
          nextRetryAt: null,
          errorMessage: null,
          errorStack: null,
          erpReference: null,
          createdAt: new Date(),
          startedAt: null,
          completedAt: null,
          expiresAt: new Date(),
        },
      ];

      syncJobsRepository.findPending.mockResolvedValue(mockJobs);

      const result = await service.getPendingJobs();

      expect(result).toEqual(mockJobs);
      expect(syncJobsRepository.findPending).toHaveBeenCalledWith(undefined, 100);
    });

    it('should retrieve pending jobs with vendor filter', async () => {
      const mockJobs: SyncJob[] = [];

      syncJobsRepository.findPending.mockResolvedValue(mockJobs);

      const result = await service.getPendingJobs('vendor-2', 50);

      expect(result).toEqual(mockJobs);
      expect(syncJobsRepository.findPending).toHaveBeenCalledWith('vendor-2', 50);
    });
  });

  describe('getRecentJobs', () => {
    it('should retrieve recent jobs with pagination', async () => {
      const mockJobs: SyncJob[] = [
        {
          id: 'job-1',
          postgresOrderId: 'order-1',
          vendorId: 'vendor-1',
          operation: 'create_order',
          status: 'completed',
          payload: {},
          retryCount: 0,
          maxRetries: 5,
          nextRetryAt: null,
          errorMessage: null,
          errorStack: null,
          erpReference: 'ERP-1',
          createdAt: new Date(),
          startedAt: new Date(),
          completedAt: new Date(),
          expiresAt: new Date(),
        },
      ];

      syncJobsRepository.findRecent.mockResolvedValue({ data: mockJobs, total: 1 });

      const result = await service.getRecentJobs('vendor-1', 1, 50);

      expect(result).toEqual({ data: mockJobs, total: 1 });
      expect(syncJobsRepository.findRecent).toHaveBeenCalledWith('vendor-1', 1, 50);
    });

    it('should use default pagination values', async () => {
      syncJobsRepository.findRecent.mockResolvedValue({ data: [], total: 0 });

      await service.getRecentJobs();

      expect(syncJobsRepository.findRecent).toHaveBeenCalledWith(undefined, 1, 50);
    });
  });
});
