import { desc, eq } from 'drizzle-orm';
import { BaseRepository } from '../base/base.repository.js';
import { orderItems, orders } from '../../schema/index.js';
import type { OrderItem, NewOrderItem } from '../../schema/index.js';

/**
 * Order Items Repository Base
 *
 * Framework-agnostic repository for order line items management.
 */
export class OrderItemsRepositoryBase extends BaseRepository<typeof orderItems> {
  async createBatch(records: NewOrderItem[]): Promise<OrderItem[]> {
    try {
      if (records.length === 0) return [];
      const result = await this.db.insert(orderItems).values(records).returning();
      this.logger.info('Order items created', { count: result.length });
      return result;
    } catch (error) {
      this.handleError('CREATE_BATCH', error, { count: records.length });
      return [];
    }
  }

  async findByOrderId(orderId: string): Promise<OrderItem[]> {
    try {
      const result = await this.db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, orderId))
        .orderBy(orderItems.lineOrder);
      return result;
    } catch (error) {
      this.handleError('FIND_BY_ORDER_ID', error, { orderId });
      return [];
    }
  }

  async updateDeliveryStatus(
    itemId: string,
    deliveryState: string,
    deliveredQuantity?: string,
  ): Promise<OrderItem | null> {
    try {
      const updateData: Record<string, unknown> = {
        deliveryState,
        updatedAt: this.getUpdatedTimestamp(),
      };
      if (deliveredQuantity !== undefined) {
        updateData.deliveredQuantity = deliveredQuantity;
      }
      const [item] = await this.db
        .update(orderItems)
        .set(updateData)
        .where(eq(orderItems.id, itemId))
        .returning();
      return item ?? null;
    } catch (error) {
      this.handleError('UPDATE_DELIVERY_STATUS', error, { itemId, deliveryState });
      return null;
    }
  }

  async findRecentByVendor(vendorId: string, limit = 100): Promise<OrderItem[]> {
    try {
      const result = await this.db
        .select({ orderItem: orderItems })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .where(eq(orders.vendorId, vendorId))
        .orderBy(desc(orderItems.createdAt))
        .limit(limit);
      return result.map(r => r.orderItem);
    } catch (error) {
      this.handleError('FIND_RECENT_BY_VENDOR', error, { vendorId });
      return [];
    }
  }
}
