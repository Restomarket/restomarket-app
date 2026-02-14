import { relations } from 'drizzle-orm';
import { orders } from './orders.schema.js';
import { orderItems } from './order-items.schema.js';
import { items } from './items.schema.js';
import { warehouses } from './warehouses.schema.js';

/**
 * Order Relations
 *
 * Defines Drizzle ORM relations between orders, order_items, items, and warehouses.
 */

export const ordersRelations = relations(orders, ({ one, many }) => ({
  warehouse: one(warehouses, {
    fields: [orders.warehouseId],
    references: [warehouses.id],
  }),
  orderItems: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  item: one(items, {
    fields: [orderItems.itemId],
    references: [items.id],
  }),
  warehouse: one(warehouses, {
    fields: [orderItems.warehouseId],
    references: [warehouses.id],
  }),
}));
