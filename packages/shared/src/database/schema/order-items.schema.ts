import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  numeric,
  boolean,
  integer,
  index,
} from 'drizzle-orm/pg-core';
import { orders } from './orders.schema.js';
import { items } from './items.schema.js';
import { warehouses } from './warehouses.schema.js';

/**
 * Order Items Schema
 *
 * Line items for orders with full ERP integration, reservation tracking,
 * and delivery state management.
 */

export const orderItems = pgTable(
  'order_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    // Line identity
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    lineOrder: integer('line_order').notNull().default(0),
    sku: varchar('sku', { length: 100 }).notNull(),
    itemId: uuid('item_id').references(() => items.id),
    description: varchar('description', { length: 500 }),

    // Quantity tracking
    quantity: numeric('quantity', { precision: 10, scale: 2 }).notNull(),
    orderedQuantity: numeric('ordered_quantity', { precision: 10, scale: 2 }),
    deliveredQuantity: numeric('delivered_quantity', { precision: 10, scale: 2 }).default('0'),
    remainingQuantityToDeliver: numeric('remaining_quantity_to_deliver', {
      precision: 10,
      scale: 2,
    }),
    returnedQuantity: numeric('returned_quantity', { precision: 10, scale: 2 }).default('0'),
    invoicedQuantity: numeric('invoiced_quantity', { precision: 10, scale: 2 }).default('0'),
    remainingQuantityToInvoice: numeric('remaining_quantity_to_invoice', {
      precision: 10,
      scale: 2,
    }),

    // Unit & warehouse
    unitCode: varchar('unit_code', { length: 50 }),
    warehouseId: uuid('warehouse_id').references(() => warehouses.id),
    manageStock: boolean('manage_stock').default(true),

    // Pricing
    purchasePrice: numeric('purchase_price', { precision: 10, scale: 2 }),
    costPrice: numeric('cost_price', { precision: 10, scale: 2 }),
    unitPrice: numeric('unit_price', { precision: 10, scale: 2 }),
    netPriceVatExcluded: numeric('net_price_vat_excluded', { precision: 10, scale: 2 }),
    netPriceVatIncluded: numeric('net_price_vat_included', { precision: 10, scale: 2 }),
    netAmountVatExcluded: numeric('net_amount_vat_excluded', { precision: 12, scale: 2 }),
    netAmountVatIncluded: numeric('net_amount_vat_included', { precision: 12, scale: 2 }),

    // Discounts & VAT
    discountRate: numeric('discount_rate', { precision: 5, scale: 2 }).default('0'),
    discountAmount: numeric('discount_amount', { precision: 10, scale: 2 }).default('0'),
    vatRate: numeric('vat_rate', { precision: 5, scale: 2 }),
    vatAmount: numeric('vat_amount', { precision: 10, scale: 2 }),
    erpVatId: varchar('erp_vat_id', { length: 100 }),

    // Delivery
    deliveryDate: timestamp('delivery_date', { withTimezone: true, mode: 'date' }),
    deliveryState: varchar('delivery_state', { length: 50 }).default('pending'),

    // Reservation (inline — no separate table)
    reservationStatus: varchar('reservation_status', { length: 50 }).default('none'),
    reservedAt: timestamp('reserved_at', { withTimezone: true, mode: 'date' }),
    reservationExpiresAt: timestamp('reservation_expires_at', { withTimezone: true, mode: 'date' }),

    // Physical
    weight: numeric('weight', { precision: 10, scale: 4 }),
    volume: numeric('volume', { precision: 10, scale: 4 }),

    // ERP sync
    erpLineId: varchar('erp_line_id', { length: 100 }),
    erpSyncedAt: timestamp('erp_synced_at', { withTimezone: true, mode: 'date' }),
    stockMovementId: varchar('stock_movement_id', { length: 100 }),

    // Notes
    notes: text('notes'),

    // Audit
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  table => [
    index('order_items_order_id_idx').on(table.orderId),
    index('order_items_item_id_idx').on(table.itemId),
    index('order_items_delivery_state_idx').on(table.deliveryState),
    index('order_items_reservation_status_idx').on(table.reservationStatus),
    index('order_items_reservation_expires_idx').on(table.reservationExpiresAt),
  ],
);

export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;
