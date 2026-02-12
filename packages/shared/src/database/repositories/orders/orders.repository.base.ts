import { and, desc, eq, sql } from 'drizzle-orm';
import { BaseRepository } from '../base/base.repository.js';
import { orders } from '../../schema/index.js';
import type { Order, NewOrder } from '../../schema/index.js';

/**
 * Orders Repository Base
 *
 * Framework-agnostic repository for order management.
 */
export class OrdersRepositoryBase extends BaseRepository<typeof orders> {
  async create(data: NewOrder): Promise<Order | null> {
    try {
      const [order] = await this.db.insert(orders).values(data).returning();
      if (!order) {
        this.logger.error('Failed to create order - no row returned', { vendorId: data.vendorId });
        return null;
      }
      this.logger.info('Order created', { orderId: order.id, vendorId: order.vendorId });
      return order;
    } catch (error) {
      this.handleError('CREATE', error, { vendorId: data.vendorId });
      return null;
    }
  }

  async findById(id: string): Promise<Order | null> {
    try {
      const [order] = await this.db.select().from(orders).where(eq(orders.id, id)).limit(1);
      return order ?? null;
    } catch (error) {
      this.handleError('FIND_BY_ID', error, { id });
      return null;
    }
  }

  async updateErpReference(
    orderId: string,
    erpReference: string,
    erpDocumentId?: string,
  ): Promise<Order | null> {
    try {
      const updateData: Record<string, unknown> = {
        erpReference,
        erpSyncedAt: this.getUpdatedTimestamp(),
        updatedAt: this.getUpdatedTimestamp(),
      };
      if (erpDocumentId) {
        updateData.erpDocumentId = erpDocumentId;
      }
      const [order] = await this.db
        .update(orders)
        .set(updateData)
        .where(eq(orders.id, orderId))
        .returning();
      if (!order) {
        this.logger.warn('Order not found for ERP reference update', { orderId });
        return null;
      }
      this.logger.info('Order ERP reference updated', { orderId, erpReference });
      return order;
    } catch (error) {
      this.handleError('UPDATE_ERP_REFERENCE', error, { orderId, erpReference });
      return null;
    }
  }

  async findByVendor(
    vendorId: string,
    page = 1,
    limit = 50,
  ): Promise<{ data: Order[]; total: number }> {
    try {
      const [data, countResult] = await Promise.all([
        this.db
          .select()
          .from(orders)
          .where(eq(orders.vendorId, vendorId))
          .orderBy(desc(orders.createdAt))
          .limit(limit)
          .offset((page - 1) * limit),
        this.db
          .select({ value: sql<number>`count(*)` })
          .from(orders)
          .where(eq(orders.vendorId, vendorId)),
      ]);
      const total = Number(countResult[0]?.value ?? 0);
      return { data, total };
    } catch (error) {
      this.handleError('FIND_BY_VENDOR', error, { vendorId, page, limit });
      return { data: [], total: 0 };
    }
  }

  async updateValidationState(orderId: string, validationState: string): Promise<Order | null> {
    try {
      const [order] = await this.db
        .update(orders)
        .set({ validationState, updatedAt: this.getUpdatedTimestamp() })
        .where(and(eq(orders.id, orderId)))
        .returning();
      return order ?? null;
    } catch (error) {
      this.handleError('UPDATE_VALIDATION_STATE', error, { orderId, validationState });
      return null;
    }
  }
}
