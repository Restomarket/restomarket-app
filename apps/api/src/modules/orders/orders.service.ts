import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { OrdersRepository } from '@database/adapters';
import { OrderItemsRepository } from '@database/adapters';
import { SyncJobService } from '../sync/services/sync-job.service';
import { CreateOrderDto } from './dto/create-order.dto';
import type { Order, NewOrderItem } from '@repo/shared';
import { randomUUID } from 'crypto';

@Injectable()
export class OrdersService {
  constructor(
    private readonly ordersRepository: OrdersRepository,
    private readonly orderItemsRepository: OrderItemsRepository,
    @Inject(forwardRef(() => SyncJobService)) private readonly syncJobService: SyncJobService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(OrdersService.name);
  }

  /**
   * Generate a unique order number if not provided
   * Format: ORD-YYYYMMDD-XXXXX (e.g., ORD-20260213-a1b2c)
   */
  private generateOrderNumber(): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const suffix = randomUUID().slice(0, 5);
    return `ORD-${date}-${suffix}`;
  }

  async createOrder(dto: CreateOrderDto): Promise<Order | null> {
    // Calculate financial totals from line items
    let amountVatExcluded = 0;
    let totalVatAmount = 0;

    const lineItems = dto.items.map((item, index) => {
      const qty = item.quantity;
      const price = item.unitPrice;
      const vatRate = item.vatRate ?? 0;
      const discountRate = item.discountRate ?? 0;

      const lineNetExclVat = qty * price;
      const discountAmount = lineNetExclVat * (discountRate / 100);
      const lineAfterDiscount = lineNetExclVat - discountAmount;
      const lineVat = lineAfterDiscount * (vatRate / 100);
      const lineInclVat = lineAfterDiscount + lineVat;

      amountVatExcluded += lineAfterDiscount;
      totalVatAmount += lineVat;

      return {
        index,
        item,
        lineNetExclVat,
        discountAmount,
        lineAfterDiscount,
        lineVat,
        lineInclVat,
        vatRate,
      };
    });

    const amountVatIncluded = amountVatExcluded + totalVatAmount;

    const order = await this.ordersRepository.create({
      vendorId: dto.vendorId,
      orderNumber: dto.orderNumber ?? this.generateOrderNumber(),
      customerId: dto.customerId,
      customerEmail: dto.customerEmail,
      customerPhone: dto.customerPhone,
      erpCustomerCode: dto.erpCustomerCode,
      billingAddress: dto.billingAddress ?? null,
      shippingAddress: dto.shippingAddress ?? null,
      warehouseId: dto.warehouseId,
      customerNotes: dto.customerNotes,
      internalNotes: dto.internalNotes,
      // Financial totals
      amountVatExcluded: amountVatExcluded.toFixed(2),
      amountVatExcludedWithDiscount: amountVatExcluded.toFixed(2),
      amountVatExcludedWithDiscountAndShipping: amountVatExcluded.toFixed(2),
      vatAmount: totalVatAmount.toFixed(2),
      amountVatIncluded: amountVatIncluded.toFixed(2),
      // ERP status
      erpStatus: 'PENDING',
    });

    if (!order) {
      this.logger.error('Failed to create order', { vendorId: dto.vendorId });
      return null;
    }

    // Create order items with full field population
    const itemRecords: NewOrderItem[] = lineItems.map(
      ({
        index,
        item,
        lineNetExclVat,
        discountAmount,
        lineAfterDiscount,
        lineVat,
        lineInclVat,
        vatRate,
      }) => ({
        orderId: order.id,
        lineOrder: index,
        sku: item.sku,
        itemId: item.itemId,
        description: item.description ?? item.sku,
        quantity: String(item.quantity),
        orderedQuantity: String(item.quantity),
        remainingQuantityToDeliver: String(item.quantity),
        remainingQuantityToInvoice: String(item.quantity),
        unitCode: item.unitCode,
        warehouseId: item.warehouseId,
        manageStock: item.manageStock ?? true,
        // Pricing
        unitPrice: String(item.unitPrice),
        netPriceVatExcluded: String(item.unitPrice),
        netPriceVatIncluded:
          vatRate > 0
            ? String(+(item.unitPrice * (1 + vatRate / 100)).toFixed(2))
            : String(item.unitPrice),
        // Line amounts
        netAmountVatExcluded: lineNetExclVat.toFixed(2),
        netAmountVatExcludedWithDiscount: lineAfterDiscount.toFixed(2),
        netAmountVatIncluded: lineInclVat.toFixed(2),
        // Discounts & VAT
        discountRate: String(item.discountRate ?? 0),
        discountAmount: discountAmount.toFixed(2),
        vatRate: String(vatRate),
        vatAmount: lineVat.toFixed(2),
      }),
    );

    await this.orderItemsRepository.createBatch(itemRecords);

    // Enqueue ERP sync job for this order
    const orderData: Record<string, unknown> = {
      orderNumber: order.orderNumber,
      customerId: order.customerId,
      vendorId: order.vendorId,
      amountVatIncluded: order.amountVatIncluded,
    };

    await this.syncJobService.createOrderJob(order.vendorId, order.id, orderData);
    this.logger.info('Order created and sync job enqueued', {
      orderId: order.id,
      vendorId: order.vendorId,
      orderNumber: order.orderNumber,
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
