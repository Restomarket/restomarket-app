import { relations } from 'drizzle-orm';
import { items } from './items.schema.js';
import { stock } from './stock.schema.js';

export const itemsRelations = relations(items, ({ many }) => ({
  stock: many(stock),
}));

export const stockRelations = relations(stock, ({ one }) => ({
  item: one(items, {
    fields: [stock.itemId],
    references: [items.id],
  }),
  warehouse: one(items, {
    fields: [stock.warehouseId],
    references: [items.id],
  }),
}));
