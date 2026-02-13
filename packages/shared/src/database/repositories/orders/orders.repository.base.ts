import { desc, eq, sql } from 'drizzle-orm';
import { BaseRepository } from '../base/base.repository.js';
import { orders } from '../../schema/index.js';
import type { Order, NewOrder } from '../../schema/index.js';

/**
 * Orders Repository Base
 *
 * Framework-agnostic repository for order management.
 * Auto-populates legacy fields (`status`, `totalAmount`) for backward compatibility.
 */
export class OrdersRepositoryBase extends BaseRepository<typeof orders> {
  /**
   * Derive legacy status from validationState + deliveryState
   *
   * Mapping:
   * - Draft (0) + any delivery → PENDING_RESERVATION
   * - Validated (1) + Not delivered (0) → RESERVED
   * - Processing (2) + any → PROCESSING
   * - Completed (3) + Fully delivered (2) → COMPLETED
   * - Otherwise → PENDING
   */
  private deriveLegacyStatus(validationState: number, deliveryState: number): string {
    if (validationState === 0) return 'PENDING_RESERVATION';
    if (validationState === 1 && deliveryState === 0) return 'RESERVED';
    if (validationState === 2) return 'PROCESSING';
    if (validationState === 3 && deliveryState === 2) return 'COMPLETED';
    if (validationState === 1 && deliveryState === 1) return 'PARTIALLY_DELIVERED';
    if (validationState === 1 && deliveryState === 2) return 'DELIVERED';
    return 'PENDING';
  }

  async create(data: NewOrder): Promise<Order | null> {
    try {
      // Auto-populate legacy fields
      const enrichedData = {
        ...data,
        status: this.deriveLegacyStatus(data.validationState ?? 0, data.deliveryState ?? 0),
        totalAmount: data.amountVatIncluded ?? '0',
      };

      const [order] = await this.db.insert(orders).values(enrichedData).returning();
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
        erpStatus: 'CONFIRMED',
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

  async updateValidationState(orderId: string, validationState: number): Promise<Order | null> {
    try {
      // Fetch current order to get deliveryState for legacy status derivation
      const current = await this.findById(orderId);
      const deliveryState = current?.deliveryState ?? 0;

      const [order] = await this.db
        .update(orders)
        .set({
          validationState,
          status: this.deriveLegacyStatus(validationState, deliveryState),
          updatedAt: this.getUpdatedTimestamp(),
        })
        .where(eq(orders.id, orderId))
        .returning();
      return order ?? null;
    } catch (error) {
      this.handleError('UPDATE_VALIDATION_STATE', error, { orderId, validationState });
      return null;
    }
  }

  async updateDeliveryState(orderId: string, deliveryState: number): Promise<Order | null> {
    try {
      // Fetch current order to get validationState for legacy status derivation
      const current = await this.findById(orderId);
      const validationState = current?.validationState ?? 0;

      const [order] = await this.db
        .update(orders)
        .set({
          deliveryState,
          status: this.deriveLegacyStatus(validationState, deliveryState),
          updatedAt: this.getUpdatedTimestamp(),
        })
        .where(eq(orders.id, orderId))
        .returning();
      return order ?? null;
    } catch (error) {
      this.handleError('UPDATE_DELIVERY_STATE', error, { orderId, deliveryState });
      return null;
    }
  }

  async markErpSyncFailed(orderId: string, errorMessage: string): Promise<Order | null> {
    try {
      const [order] = await this.db
        .update(orders)
        .set({
          erpStatus: 'SYNC_FAILED',
          erpSyncError: errorMessage,
          updatedAt: this.getUpdatedTimestamp(),
        })
        .where(eq(orders.id, orderId))
        .returning();
      return order ?? null;
    } catch (error) {
      this.handleError('MARK_ERP_SYNC_FAILED', error, { orderId });
      return null;
    }
  }
}
