import { Test, TestingModule } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';
import { OrdersService } from '../orders.service';
import { OrdersRepository } from '@database/adapters';
import { OrderItemsRepository } from '@database/adapters';
import { SyncJobService } from '../../sync/services/sync-job.service';
import { CreateOrderDto } from '../dto/create-order.dto';

describe('OrdersService', () => {
  let service: OrdersService;
  let ordersRepository: jest.Mocked<OrdersRepository>;
  let orderItemsRepository: jest.Mocked<OrderItemsRepository>;
  let syncJobService: jest.Mocked<SyncJobService>;

  const mockOrder = {
    id: 'order-uuid',
    vendorId: 'vendor-uuid',
    orderNumber: 'ORDER-001',
    reference: null,
    documentDate: new Date(),
    documentType: 1,
    validationState: 0,
    deliveryState: 0,
    customerId: null,
    customerEmail: null,
    customerPhone: null,
    erpCustomerCode: null,
    billingAddress: null,
    shippingAddress: null,
    warehouseId: null,
    deliveryDate: null,
    amountVatExcluded: '0',
    discountRate: '0',
    discountAmount: '0',
    amountVatExcludedWithDiscount: '0',
    amountVatExcludedWithDiscountAndShipping: '0',
    shippingAmountVatExcluded: '0',
    shippingAmountVatIncluded: '0',
    shippingVatRate: '0',
    shippingMethod: null,
    currencyCode: 'EUR',
    vatAmount: '0',
    amountVatIncluded: '0',
    costPrice: '0',
    paymentMethod: null,
    paymentStatus: 'pending',
    paymentProvider: null,
    paymentTransactionId: null,
    paymentAuthNumber: null,
    paymentProcessedAt: null,
    paymentAmount: null,
    status: 'PENDING_RESERVATION',
    totalAmount: '0',
    erpReference: null,
    erpStatus: null,
    erpDocumentId: null,
    erpSerialId: null,
    erpVatId: null,
    erpTerritorialityId: null,
    erpSettlementModeId: null,
    erpSyncedAt: null,
    erpSyncError: null,
    contentHash: null,
    reservationJobId: null,
    customerNotes: null,
    internalNotes: null,
    cancelledAt: null,
    cancelledBy: null,
    cancellationReason: null,
    expectedShipDate: null,
    createdBy: null,
    updatedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    ordersRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      updateErpReference: jest.fn(),
      findByVendor: jest.fn(),
    } as unknown as jest.Mocked<OrdersRepository>;

    orderItemsRepository = {
      createBatch: jest.fn(),
    } as unknown as jest.Mocked<OrderItemsRepository>;

    syncJobService = {
      createOrderJob: jest.fn(),
    } as unknown as jest.Mocked<SyncJobService>;

    const pinoLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      setContext: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: OrdersRepository, useValue: ordersRepository },
        { provide: OrderItemsRepository, useValue: orderItemsRepository },
        { provide: SyncJobService, useValue: syncJobService },
        { provide: PinoLogger, useValue: pinoLogger },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  describe('createOrder', () => {
    const dto: CreateOrderDto = {
      vendorId: 'vendor-uuid',
      orderNumber: 'ORDER-001',
      items: [{ sku: 'SKU-001', quantity: 5, unitPrice: 9.99, description: 'Test item' }],
    };

    it('should create an order, create order items, and enqueue sync job', async () => {
      ordersRepository.create.mockResolvedValue(mockOrder);
      orderItemsRepository.createBatch.mockResolvedValue([]);
      syncJobService.createOrderJob.mockResolvedValue('sync-job-id');

      const result = await service.createOrder(dto);

      expect(result).toEqual(mockOrder);
      expect(ordersRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ vendorId: 'vendor-uuid' }),
      );
      expect(orderItemsRepository.createBatch).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ sku: 'SKU-001', orderId: 'order-uuid' }),
        ]),
      );
      expect(syncJobService.createOrderJob).toHaveBeenCalledWith(
        'vendor-uuid',
        'order-uuid',
        expect.objectContaining({ vendorId: 'vendor-uuid' }),
      );
    });

    it('should return null if order creation fails', async () => {
      ordersRepository.create.mockResolvedValue(null);

      const result = await service.createOrder(dto);

      expect(result).toBeNull();
      expect(orderItemsRepository.createBatch).not.toHaveBeenCalled();
      expect(syncJobService.createOrderJob).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should return order when found', async () => {
      ordersRepository.findById.mockResolvedValue(mockOrder);
      const result = await service.findById('order-uuid');
      expect(result).toEqual(mockOrder);
    });

    it('should return null when not found', async () => {
      ordersRepository.findById.mockResolvedValue(null);
      const result = await service.findById('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('findByVendor', () => {
    it('should return paginated orders', async () => {
      ordersRepository.findByVendor.mockResolvedValue({ data: [mockOrder], total: 1 });
      const result = await service.findByVendor('vendor-uuid');
      expect(result).toEqual({ data: [mockOrder], total: 1 });
    });
  });

  describe('updateErpReference', () => {
    it('should update ERP reference', async () => {
      ordersRepository.updateErpReference.mockResolvedValue({
        ...mockOrder,
        erpReference: 'ERP-123',
      });
      const result = await service.updateErpReference('order-uuid', 'ERP-123');
      expect(result?.erpReference).toBe('ERP-123');
    });
  });
});
