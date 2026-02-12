import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';
import { OrderSyncProcessor, OrderSyncPayload } from '../order-sync.processor';
import { SyncJobService } from '../../services/sync-job.service';
import { AgentCommunicationService } from '../../services/agent-communication.service';
import { DeadLetterQueueService } from '../../services/dead-letter-queue.service';

describe('OrderSyncProcessor', () => {
  let processor: OrderSyncProcessor;
  let syncJobService: jest.Mocked<SyncJobService>;
  let agentCommunication: jest.Mocked<AgentCommunicationService>;
  let dlqService: jest.Mocked<DeadLetterQueueService>;
  let logger: jest.Mocked<PinoLogger>;

  const mockPayload: OrderSyncPayload = {
    syncJobId: 'job-123',
    vendorId: 'vendor-abc',
    orderId: 'order-456',
    orderData: {
      customerName: 'Test Customer',
      items: [{ sku: 'ITEM-001', quantity: 5 }],
    },
    correlationId: 'corr-789',
  };

  beforeEach(async () => {
    const mockSyncJobService = {
      markProcessing: jest.fn().mockResolvedValue(undefined),
      markCompleted: jest.fn().mockResolvedValue(undefined),
      markFailed: jest.fn().mockResolvedValue(undefined),
    };

    const mockAgentCommunication = {
      callAgent: jest.fn().mockResolvedValue(undefined),
    };

    const mockDlqService = {
      add: jest.fn().mockResolvedValue('dlq-123'),
    };

    const mockLogger = {
      setContext: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderSyncProcessor,
        {
          provide: SyncJobService,
          useValue: mockSyncJobService,
        },
        {
          provide: AgentCommunicationService,
          useValue: mockAgentCommunication,
        },
        {
          provide: DeadLetterQueueService,
          useValue: mockDlqService,
        },
        {
          provide: PinoLogger,
          useValue: mockLogger,
        },
      ],
    }).compile();

    processor = module.get<OrderSyncProcessor>(OrderSyncProcessor);
    syncJobService = module.get(SyncJobService) as jest.Mocked<SyncJobService>;
    agentCommunication = module.get(
      AgentCommunicationService,
    ) as jest.Mocked<AgentCommunicationService>;
    dlqService = module.get(DeadLetterQueueService) as jest.Mocked<DeadLetterQueueService>;
    logger = module.get(PinoLogger) as jest.Mocked<PinoLogger>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('process', () => {
    it('should successfully process order sync job', async () => {
      const mockJob = {
        data: mockPayload,
        attemptsMade: 1,
      } as Job<OrderSyncPayload, void, 'create-order'>;

      await processor.process(mockJob);

      // Should mark as processing
      expect(syncJobService.markProcessing).toHaveBeenCalledWith('job-123');

      // Should call agent
      expect(agentCommunication.callAgent).toHaveBeenCalledWith(
        'vendor-abc',
        'orders',
        '/sync/create-order',
        {
          syncJobId: 'job-123',
          orderId: 'order-456',
          orderData: mockPayload.orderData,
        },
        'corr-789',
      );

      // Should log success
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'Processing order sync job',
          syncJobId: 'job-123',
          vendorId: 'vendor-abc',
          orderId: 'order-456',
        }),
      );

      expect(logger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'Order sync request sent to agent',
          syncJobId: 'job-123',
        }),
      );

      // Should NOT mark as completed (agent will callback)
      expect(syncJobService.markCompleted).not.toHaveBeenCalled();
    });

    it('should handle agent communication failure and mark job as failed', async () => {
      const error = new Error('Agent communication failed');
      agentCommunication.callAgent.mockRejectedValueOnce(error);

      const mockJob = {
        data: mockPayload,
        attemptsMade: 2,
      } as Job<OrderSyncPayload, void, 'create-order'>;

      await expect(processor.process(mockJob)).rejects.toThrow('Agent communication failed');

      // Should mark as processing first
      expect(syncJobService.markProcessing).toHaveBeenCalledWith('job-123');

      // Should mark as failed with retry count
      expect(syncJobService.markFailed).toHaveBeenCalledWith(
        'job-123',
        'Agent communication failed',
        3, // attemptsMade + 1
      );

      // Should log error
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'Order sync job failed',
          syncJobId: 'job-123',
          error: 'Agent communication failed',
          attemptsMade: 2,
        }),
      );
    });

    it('should propagate correlation ID to agent call', async () => {
      const mockJob = {
        data: mockPayload,
        attemptsMade: 1,
      } as Job<OrderSyncPayload, void, 'create-order'>;

      await processor.process(mockJob);

      expect(agentCommunication.callAgent).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        'corr-789', // correlation ID
      );
    });

    it('should handle job without correlation ID', async () => {
      const payloadWithoutCorrelation = { ...mockPayload, correlationId: undefined };
      const mockJob = {
        data: payloadWithoutCorrelation,
        attemptsMade: 1,
      } as Job<OrderSyncPayload, void, 'create-order'>;

      await processor.process(mockJob);

      expect(agentCommunication.callAgent).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        undefined, // no correlation ID
      );
    });
  });

  describe('onFailed', () => {
    it('should handle exhausted retries and add to DLQ', async () => {
      const error = new Error('Permanent failure');
      error.stack = 'Error stack trace...';
      const mockJob = {
        data: mockPayload,
        attemptsMade: 5,
        opts: { attempts: 5 },
      } as Job<OrderSyncPayload>;

      await processor.onFailed(mockJob, error);

      // Should mark as failed
      expect(syncJobService.markFailed).toHaveBeenCalledWith('job-123', 'Permanent failure', 5);

      // Should add to DLQ
      expect(dlqService.add).toHaveBeenCalledWith({
        originalJobId: 'job-123',
        vendorId: 'vendor-abc',
        operation: 'create_order',
        payload: mockPayload,
        failureReason: 'Permanent failure',
        failureStack: 'Error stack trace...',
        attemptCount: 5,
      });

      // Should log error about exhausted retries
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'Order sync job exhausted all retries',
          syncJobId: 'job-123',
          attemptsMade: 5,
        }),
      );
    });

    it('should handle non-exhausted retries with warning', async () => {
      const error = new Error('Temporary failure');
      const mockJob = {
        data: mockPayload,
        attemptsMade: 2,
        opts: { attempts: 5 },
      } as Job<OrderSyncPayload>;

      await processor.onFailed(mockJob, error);

      // Should NOT mark as failed (BullMQ will retry)
      expect(syncJobService.markFailed).not.toHaveBeenCalled();

      // Should NOT add to DLQ (still retrying)
      expect(dlqService.add).not.toHaveBeenCalled();

      // Should log warning about retry
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'Order sync job failed, will retry',
          syncJobId: 'job-123',
          attemptsMade: 2,
          remainingAttempts: 3,
        }),
      );
    });

    it('should handle missing opts.attempts (default to 5)', async () => {
      const error = new Error('Failure');
      const mockJob = {
        data: mockPayload,
        attemptsMade: 5,
        opts: {}, // No attempts specified
      } as Job<OrderSyncPayload>;

      await processor.onFailed(mockJob, error);

      // Should treat as exhausted (5 >= default 5)
      expect(syncJobService.markFailed).toHaveBeenCalled();
      expect(dlqService.add).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'Order sync job exhausted all retries',
        }),
      );
    });
  });

  describe('onCompleted', () => {
    it('should log completion with duration', async () => {
      const mockJob = {
        data: mockPayload,
        processedOn: 1000,
        finishedOn: 3500,
      } as Job<OrderSyncPayload>;

      await processor.onCompleted(mockJob);

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'Order sync job completed (agent request sent)',
          syncJobId: 'job-123',
          vendorId: 'vendor-abc',
          orderId: 'order-456',
          duration: 2500, // finishedOn - processedOn
        }),
      );
    });

    it('should handle missing timing info', async () => {
      const mockJob = {
        data: mockPayload,
      } as Job<OrderSyncPayload>;

      await processor.onCompleted(mockJob);

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'Order sync job completed (agent request sent)',
          duration: undefined,
        }),
      );
    });
  });
});
