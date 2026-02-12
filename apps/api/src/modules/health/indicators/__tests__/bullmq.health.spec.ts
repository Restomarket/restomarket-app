import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { PinoLogger } from 'nestjs-pino';
import { BullMQHealthService } from '../bullmq.health';
import { Queue } from 'bullmq';

describe('BullMQHealthService', () => {
  let service: BullMQHealthService;
  let mockOrderSyncQueue: Partial<Queue>;
  let mockReconciliationQueue: Partial<Queue>;
  let mockImageSyncQueue: Partial<Queue>;
  let mockLogger: Partial<PinoLogger>;

  beforeEach(async () => {
    mockOrderSyncQueue = {
      getWaitingCount: jest.fn().mockResolvedValue(0),
    };

    mockReconciliationQueue = {
      getWaitingCount: jest.fn().mockResolvedValue(0),
    };

    mockImageSyncQueue = {
      getWaitingCount: jest.fn().mockResolvedValue(0),
    };

    mockLogger = {
      setContext: jest.fn(),
      warn: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BullMQHealthService,
        { provide: getQueueToken('order-sync'), useValue: mockOrderSyncQueue },
        { provide: getQueueToken('reconciliation'), useValue: mockReconciliationQueue },
        { provide: getQueueToken('image-sync'), useValue: mockImageSyncQueue },
        { provide: PinoLogger, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<BullMQHealthService>(BullMQHealthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return up status when all queues have low counts', async () => {
    const result = await service.check();

    expect(result.status).toBe('up');
    expect(result.queues).toEqual({
      'order-sync': 0,
      reconciliation: 0,
      'image-sync': 0,
    });
    expect(result.message).toBeUndefined();
  });

  it('should return warning status when queue has > 100 waiting jobs', async () => {
    mockOrderSyncQueue.getWaitingCount = jest.fn().mockResolvedValue(150);

    const result = await service.check();

    expect(result.status).toBe('warning');
    expect(result.queues['order-sync']).toBe(150);
    expect(result.message).toBe('Queue backlog detected: 150 jobs waiting');
  });

  it('should return down status on queue error', async () => {
    mockOrderSyncQueue.getWaitingCount = jest.fn().mockRejectedValue(new Error('Queue error'));

    const result = await service.check();

    expect(result.status).toBe('down');
    expect(result.message).toBe('Queue error');
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it('should set logger context on initialization', () => {
    expect(mockLogger.setContext).toHaveBeenCalledWith('BullMQHealthService');
  });
});
