import { relations } from 'drizzle-orm';
import { items } from './items.schema.js';
import { stock } from './stock.schema.js';
import { warehouses } from './warehouses.schema.js';
import { units } from './units.schema.js';
import { vatRates } from './vat-rates.schema.js';
import { families } from './families.schema.js';
import { subfamilies } from './subfamilies.schema.js';

export const itemsRelations = relations(items, ({ one, many }) => ({
  unit: one(units, {
    fields: [items.unitId],
    references: [units.id],
  }),
  vatRate: one(vatRates, {
    fields: [items.vatRateId],
    references: [vatRates.id],
  }),
  family: one(families, {
    fields: [items.familyId],
    references: [families.id],
  }),
  subfamily: one(subfamilies, {
    fields: [items.subfamilyId],
    references: [subfamilies.id],
  }),
  stock: many(stock),
}));

export const stockRelations = relations(stock, ({ one }) => ({
  item: one(items, {
    fields: [stock.itemId],
    references: [items.id],
  }),
  warehouse: one(warehouses, {
    fields: [stock.warehouseId],
    references: [warehouses.id],
  }),
}));
