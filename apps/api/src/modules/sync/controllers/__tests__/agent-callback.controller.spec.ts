import { Test, TestingModule } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';
import { ExecutionContext } from '@nestjs/common';
import { AgentCallbackController } from '../agent-callback.controller';
import { SyncJobService } from '../../services/sync-job.service';
import { OrdersService } from '../../../orders/orders.service';
import { AgentCallbackDto } from '../../dto/agent-callback.dto';
import { AgentAuthGuard } from '../../../../common/guards/agent-auth.guard';

describe('AgentCallbackController', () => {
  let controller: AgentCallbackController;
  let syncJobService: jest.Mocked<SyncJobService>;
  let ordersService: jest.Mocked<OrdersService>;
  let logger: jest.Mocked<PinoLogger>;

  const mockJob = {
    id: 'job-123',
    postgresOrderId: 'order-uuid',
    vendorId: 'vendor-1',
    operation: 'create_order',
    status: 'completed',
  };

  beforeEach(async () => {
    const mockSyncJobService = {
      markCompleted: jest.fn().mockResolvedValue(mockJob),
      markFailed: jest.fn().mockResolvedValue(undefined),
    };

    const mockOrdersService = {
      updateErpReference: jest.fn().mockResolvedValue(null),
    };

    const mockLogger = {
      setContext: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    // Mock guard to always allow access
    const mockGuard = {
      canActivate: (_context: ExecutionContext) => true,
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AgentCallbackController],
      providers: [
        {
          provide: SyncJobService,
          useValue: mockSyncJobService,
        },
        {
          provide: OrdersService,
          useValue: mockOrdersService,
        },
        {
          provide: PinoLogger,
          useValue: mockLogger,
        },
      ],
    })
      .overrideGuard(AgentAuthGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<AgentCallbackController>(AgentCallbackController);
    syncJobService = module.get(SyncJobService) as jest.Mocked<SyncJobService>;
    ordersService = module.get(OrdersService) as jest.Mocked<OrdersService>;
    logger = module.get(PinoLogger) as jest.Mocked<PinoLogger>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleCallback', () => {
    it('should handle completed job callback with ERP reference', async () => {
      const dto: AgentCallbackDto = {
        jobId: 'job-123',
        status: 'completed',
        erpReference: 'ERP-ORD-12345',
        metadata: { erpCustomerId: '67890' },
      };

      const result = await controller.handleCallback(dto);

      expect(syncJobService.markCompleted).toHaveBeenCalledWith('job-123', 'ERP-ORD-12345', {
        erpCustomerId: '67890',
      });

      // Should update order ERP reference
      expect(ordersService.updateErpReference).toHaveBeenCalledWith(
        'order-uuid',
        'ERP-ORD-12345',
        undefined,
      );

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'Received agent callback',
          jobId: 'job-123',
          status: 'completed',
          erpReference: 'ERP-ORD-12345',
        }),
      );

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'Job marked as completed',
          jobId: 'job-123',
          erpReference: 'ERP-ORD-12345',
        }),
      );

      expect(result).toEqual({
        success: true,
        message: 'Job completed successfully',
      });
    });

    it('should handle completed job callback without ERP reference', async () => {
      const dto: AgentCallbackDto = {
        jobId: 'job-456',
        status: 'completed',
      };

      const result = await controller.handleCallback(dto);

      expect(syncJobService.markCompleted).toHaveBeenCalledWith('job-456', undefined, undefined);

      // Should NOT update order ERP reference (no erpReference provided)
      expect(ordersService.updateErpReference).not.toHaveBeenCalled();

      expect(result).toEqual({
        success: true,
        message: 'Job completed successfully',
      });
    });

    it('should handle failed job callback with error message', async () => {
      const dto: AgentCallbackDto = {
        jobId: 'job-789',
        status: 'failed',
        error: 'Failed to create order in ERP system',
      };

      const result = await controller.handleCallback(dto);

      expect(syncJobService.markFailed).toHaveBeenCalledWith(
        'job-789',
        'Failed to create order in ERP system',
      );

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'Job marked as failed',
          jobId: 'job-789',
          error: 'Failed to create order in ERP system',
        }),
      );

      expect(result).toEqual({
        success: true,
        message: 'Job failure recorded',
      });
    });

    it('should handle failed job callback without error message', async () => {
      const dto: AgentCallbackDto = {
        jobId: 'job-abc',
        status: 'failed',
      };

      const result = await controller.handleCallback(dto);

      expect(syncJobService.markFailed).toHaveBeenCalledWith('job-abc', 'Unknown error');

      expect(result).toEqual({
        success: true,
        message: 'Job failure recorded',
      });
    });

    it('should log metadata presence in callback', async () => {
      const dto: AgentCallbackDto = {
        jobId: 'job-def',
        status: 'completed',
        erpReference: 'ERP-123',
        metadata: { key: 'value' },
      };

      await controller.handleCallback(dto);

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'Received agent callback',
          hasMetadata: true,
        }),
      );
    });

    it('should log error presence in callback', async () => {
      const dto: AgentCallbackDto = {
        jobId: 'job-ghi',
        status: 'failed',
        error: 'Some error',
      };

      await controller.handleCallback(dto);

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'Received agent callback',
          hasError: true,
        }),
      );
    });

    it('should handle callback with all optional fields missing', async () => {
      const dto: AgentCallbackDto = {
        jobId: 'job-jkl',
        status: 'completed',
      };

      await controller.handleCallback(dto);

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'Received agent callback',
          hasError: false,
          hasMetadata: false,
        }),
      );

      expect(syncJobService.markCompleted).toHaveBeenCalledWith('job-jkl', undefined, undefined);
    });
  });
});
