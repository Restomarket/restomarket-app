import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { OrdersRepository } from '@database/adapters';
import { OrderItemsRepository } from '@database/adapters';
import { SyncJobService } from '../sync/services/sync-job.service';
import { CreateOrderDto } from './dto/create-order.dto';
import type { Order } from '@repo/shared';

@Injectable()
export class OrdersService {
  constructor(
    private readonly ordersRepository: OrdersRepository,
    private readonly orderItemsRepository: OrderItemsRepository,
    private readonly syncJobService: SyncJobService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(OrdersService.name);
  }

  async createOrder(dto: CreateOrderDto): Promise<Order | null> {
    const order = await this.ordersRepository.create({
      vendorId: dto.vendorId,
      orderNumber: dto.orderNumber,
      customerId: dto.customerId,
      customerEmail: dto.customerEmail,
      customerPhone: dto.customerPhone,
      erpCustomerCode: dto.erpCustomerCode,
      billingAddress: dto.billingAddress ?? null,
      shippingAddress: dto.shippingAddress ?? null,
      warehouseId: dto.warehouseId,
      customerNotes: dto.customerNotes,
      internalNotes: dto.internalNotes,
    });

    if (!order) {
      this.logger.error('Failed to create order', { vendorId: dto.vendorId });
      return null;
    }

    // Create order items
    const itemRecords = dto.items.map((item, index) => ({
      orderId: order.id,
      lineOrder: index,
      sku: item.sku,
      description: item.description,
      quantity: String(item.quantity),
      unitCode: item.unitCode,
      unitPrice: item.unitPrice !== undefined ? String(item.unitPrice) : undefined,
      vatRate: item.vatRate !== undefined ? String(item.vatRate) : undefined,
    }));

    await this.orderItemsRepository.createBatch(itemRecords);

    // Enqueue ERP sync job for this order
    const orderData: Record<string, unknown> = {
      orderNumber: order.orderNumber,
      customerId: order.customerId,
      vendorId: order.vendorId,
    };

    await this.syncJobService.createOrderJob(order.vendorId, order.id, orderData);
    this.logger.info('Order created and sync job enqueued', {
      orderId: order.id,
      vendorId: order.vendorId,
    });

    return order;
  }

  async findById(id: string): Promise<Order | null> {
    return this.ordersRepository.findById(id);
  }

  async findByVendor(
    vendorId: string,
    page = 1,
    limit = 50,
  ): Promise<{ data: Order[]; total: number }> {
    return this.ordersRepository.findByVendor(vendorId, page, limit);
  }

  async updateErpReference(
    orderId: string,
    erpReference: string,
    erpDocumentId?: string,
  ): Promise<Order | null> {
    return this.ordersRepository.updateErpReference(orderId, erpReference, erpDocumentId);
  }
}
