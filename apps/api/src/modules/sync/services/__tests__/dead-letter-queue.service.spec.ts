import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';
import { DeadLetterQueueService } from '../dead-letter-queue.service';
import { DeadLetterQueueRepository } from '@database/adapters';
import type { DeadLetterQueueEntry } from '@repo/shared';

describe('DeadLetterQueueService', () => {
  let service: DeadLetterQueueService;
  let dlqRepository: jest.Mocked<DeadLetterQueueRepository>;
  let orderSyncQueue: jest.Mocked<Queue>;
  let logger: jest.Mocked<PinoLogger>;

  const mockDlqEntry: DeadLetterQueueEntry = {
    id: 'dlq-123',
    originalJobId: 'job-456',
    vendorId: 'vendor-1',
    operation: 'create_order',
    payload: { orderId: 'order-789', orderData: { total: 100 } },
    failureReason: 'Agent timeout',
    failureStack: 'Error stack...',
    attemptCount: 5,
    lastAttemptAt: new Date('2025-01-15T12:00:00Z'),
    resolved: false,
    resolvedAt: null,
    resolvedBy: null,
    createdAt: new Date('2025-01-15T10:00:00Z'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeadLetterQueueService,
        {
          provide: DeadLetterQueueRepository,
          useValue: {
            create: jest.fn(),
            findById: jest.fn(),
            findUnresolved: jest.fn(),
            markResolved: jest.fn(),
            deleteOldResolved: jest.fn(),
            countUnresolved: jest.fn(),
          },
        },
        {
          provide: getQueueToken('order-sync'),
          useValue: {
            add: jest.fn(),
          },
        },
        {
          provide: PinoLogger,
          useValue: {
            setContext: jest.fn(),
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DeadLetterQueueService>(DeadLetterQueueService);
    dlqRepository = module.get(DeadLetterQueueRepository);
    orderSyncQueue = module.get(getQueueToken('order-sync'));
    logger = module.get(PinoLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('add', () => {
    it('should add failed job to DLQ', async () => {
      dlqRepository.create.mockResolvedValue(mockDlqEntry);

      const result = await service.add({
        originalJobId: 'job-456',
        vendorId: 'vendor-1',
        operation: 'create_order',
        payload: { orderId: 'order-789' },
        failureReason: 'Agent timeout',
        failureStack: 'Error stack...',
        attemptCount: 5,
      });

      expect(result).toBe('dlq-123');
      expect(dlqRepository.create).toHaveBeenCalledWith({
        originalJobId: 'job-456',
        vendorId: 'vendor-1',
        operation: 'create_order',
        payload: { orderId: 'order-789' },
        failureReason: 'Agent timeout',
        failureStack: 'Error stack...',
        attemptCount: 5,
        lastAttemptAt: expect.any(Date),
        resolved: false,
      });
      expect(logger.warn).toHaveBeenCalledWith(
        'Job added to DLQ',
        expect.objectContaining({
          dlqId: 'dlq-123',
          originalJobId: 'job-456',
          vendorId: 'vendor-1',
        }),
      );
    });

    it('should return null if repository create fails', async () => {
      dlqRepository.create.mockResolvedValue(null);

      const result = await service.add({
        originalJobId: 'job-456',
        vendorId: 'vendor-1',
        operation: 'create_order',
        payload: { orderId: 'order-789' },
        failureReason: 'Agent timeout',
        attemptCount: 5,
      });

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to add entry to DLQ',
        expect.objectContaining({
          originalJobId: 'job-456',
        }),
      );
    });

    it('should handle exceptions', async () => {
      dlqRepository.create.mockRejectedValue(new Error('Database error'));

      const result = await service.add({
        originalJobId: 'job-456',
        vendorId: 'vendor-1',
        operation: 'create_order',
        payload: {},
        failureReason: 'Test',
        attemptCount: 5,
      });

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getUnresolved', () => {
    it('should retrieve unresolved entries without vendor filter', async () => {
      dlqRepository.findUnresolved.mockResolvedValue({
        data: [mockDlqEntry],
        total: 1,
      });

      const result = await service.getUnresolved();

      expect(result).toEqual({
        data: [mockDlqEntry],
        total: 1,
      });
      expect(dlqRepository.findUnresolved).toHaveBeenCalledWith(undefined, 1, 50);
    });

    it('should retrieve unresolved entries with vendor filter', async () => {
      dlqRepository.findUnresolved.mockResolvedValue({
        data: [mockDlqEntry],
        total: 1,
      });

      const result = await service.getUnresolved('vendor-1', 2, 100);

      expect(result).toEqual({
        data: [mockDlqEntry],
        total: 1,
      });
      expect(dlqRepository.findUnresolved).toHaveBeenCalledWith('vendor-1', 2, 100);
    });

    it('should return empty result on error', async () => {
      dlqRepository.findUnresolved.mockRejectedValue(new Error('Database error'));

      const result = await service.getUnresolved();

      expect(result).toEqual({ data: [], total: 0 });
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getDetails', () => {
    it('should retrieve DLQ entry by ID', async () => {
      dlqRepository.findById.mockResolvedValue(mockDlqEntry);

      const result = await service.getDetails('dlq-123');

      expect(result).toEqual(mockDlqEntry);
      expect(dlqRepository.findById).toHaveBeenCalledWith('dlq-123');
    });

    it('should return null if entry not found', async () => {
      dlqRepository.findById.mockResolvedValue(null);

      const result = await service.getDetails('nonexistent');

      expect(result).toBeNull();
      expect(logger.debug).toHaveBeenCalledWith(
        'DLQ entry not found',
        expect.objectContaining({ id: 'nonexistent' }),
      );
    });

    it('should handle exceptions', async () => {
      dlqRepository.findById.mockRejectedValue(new Error('Database error'));

      const result = await service.getDetails('dlq-123');

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('retry', () => {
    it('should re-enqueue DLQ entry to BullMQ', async () => {
      dlqRepository.findById.mockResolvedValue(mockDlqEntry);
      orderSyncQueue.add.mockResolvedValue({ id: 'new-bullmq-job-123' } as any);

      const result = await service.retry('dlq-123');

      expect(result).toBe('new-bullmq-job-123');
      expect(dlqRepository.findById).toHaveBeenCalledWith('dlq-123');
      expect(orderSyncQueue.add).toHaveBeenCalledWith(
        'create-order',
        mockDlqEntry.payload,
        expect.objectContaining({
          attempts: 5,
          backoff: { type: 'exponential', delay: 60_000 },
        }),
      );
      expect(logger.info).toHaveBeenCalledWith(
        'DLQ entry retried',
        expect.objectContaining({
          dlqId: 'dlq-123',
          newBullMQJobId: 'new-bullmq-job-123',
        }),
      );
    });

    it('should return null if DLQ entry not found', async () => {
      dlqRepository.findById.mockResolvedValue(null);

      const result = await service.retry('nonexistent');

      expect(result).toBeNull();
      expect(orderSyncQueue.add).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        'DLQ entry not found for retry',
        expect.objectContaining({ id: 'nonexistent' }),
      );
    });

    it('should handle BullMQ errors', async () => {
      dlqRepository.findById.mockResolvedValue(mockDlqEntry);
      orderSyncQueue.add.mockRejectedValue(new Error('Queue error'));

      const result = await service.retry('dlq-123');

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('resolve', () => {
    it('should mark DLQ entry as resolved', async () => {
      const resolvedEntry = { ...mockDlqEntry, resolved: true, resolvedBy: 'admin-1' };
      dlqRepository.markResolved.mockResolvedValue(resolvedEntry);

      const result = await service.resolve('dlq-123', 'admin-1');

      expect(result).toEqual(resolvedEntry);
      expect(dlqRepository.markResolved).toHaveBeenCalledWith('dlq-123', 'admin-1');
      expect(logger.info).toHaveBeenCalledWith(
        'DLQ entry resolved',
        expect.objectContaining({
          dlqId: 'dlq-123',
          resolvedBy: 'admin-1',
        }),
      );
    });

    it('should return null if entry not found', async () => {
      dlqRepository.markResolved.mockResolvedValue(null);

      const result = await service.resolve('nonexistent', 'admin-1');

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        'Failed to resolve DLQ entry (not found)',
        expect.objectContaining({ id: 'nonexistent' }),
      );
    });

    it('should handle exceptions', async () => {
      dlqRepository.markResolved.mockRejectedValue(new Error('Database error'));

      const result = await service.resolve('dlq-123', 'admin-1');

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should delete old resolved entries', async () => {
      dlqRepository.deleteOldResolved.mockResolvedValue(5);

      const result = await service.cleanup(30);

      expect(result).toBe(5);
      expect(dlqRepository.deleteOldResolved).toHaveBeenCalledWith(30);
      expect(logger.info).toHaveBeenCalledWith(
        'DLQ cleanup completed',
        expect.objectContaining({
          deletedCount: 5,
          olderThanDays: 30,
        }),
      );
    });

    it('should use default age threshold', async () => {
      dlqRepository.deleteOldResolved.mockResolvedValue(3);

      const result = await service.cleanup();

      expect(result).toBe(3);
      expect(dlqRepository.deleteOldResolved).toHaveBeenCalledWith(30);
    });

    it('should return 0 on error', async () => {
      dlqRepository.deleteOldResolved.mockRejectedValue(new Error('Database error'));

      const result = await service.cleanup();

      expect(result).toBe(0);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getUnresolvedCount', () => {
    it('should return count of unresolved entries', async () => {
      dlqRepository.countUnresolved.mockResolvedValue(7);

      const result = await service.getUnresolvedCount();

      expect(result).toBe(7);
      expect(dlqRepository.countUnresolved).toHaveBeenCalledWith(undefined);
    });

    it('should filter by vendor', async () => {
      dlqRepository.countUnresolved.mockResolvedValue(3);

      const result = await service.getUnresolvedCount('vendor-1');

      expect(result).toBe(3);
      expect(dlqRepository.countUnresolved).toHaveBeenCalledWith('vendor-1');
    });

    it('should return 0 on error', async () => {
      dlqRepository.countUnresolved.mockRejectedValue(new Error('Database error'));

      const result = await service.getUnresolvedCount();

      expect(result).toBe(0);
      expect(logger.error).toHaveBeenCalled();
    });
  });
});
