import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  numeric,
  integer,
  index,
} from 'drizzle-orm/pg-core';
import { items } from './items.schema.js';
import { warehouses } from './warehouses.schema.js';

/**
 * Stock Movements Schema
 *
 * Immutable audit trail of all inventory movements.
 * Reversals are recorded as new entries (no updates).
 *
 * movementType values: receipt | delivery | adjustment | transfer | return | inventory_count
 * referenceType values: order | purchase_order | manual | erp_sync
 */
export const stockMovements = pgTable(
  'stock_movements',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    vendorId: varchar('vendor_id', { length: 100 }).notNull(),
    itemId: uuid('item_id')
      .notNull()
      .references(() => items.id),
    warehouseId: uuid('warehouse_id')
      .notNull()
      .references(() => warehouses.id),

    // Movement classification
    movementType: varchar('movement_type', { length: 50 }).notNull(), // receipt|delivery|adjustment|transfer|return|inventory_count

    // Quantity (positive = stock in, negative = stock out)
    quantity: numeric('quantity', { precision: 10, scale: 3 }).notNull(),

    // Valuation
    unitCost: numeric('unit_cost', { precision: 10, scale: 4 }),
    totalCost: numeric('total_cost', { precision: 12, scale: 2 }),

    // Reference linking
    referenceType: varchar('reference_type', { length: 50 }), // order|purchase_order|manual|erp_sync
    referenceId: varchar('reference_id', { length: 100 }),

    // ERP integration
    erpMovementId: varchar('erp_movement_id', { length: 100 }), // EBP StockMovement.Id
    stockMovementLineId: integer('stock_movement_line_id'), // EBP StockMovement line Id (Int32)

    // Lot / Serial tracking (EBP trackingMode=1 or 2)
    batchNumber: varchar('batch_number', { length: 100 }),
    serialNumber: varchar('serial_number', { length: 100 }),

    notes: text('notes'),

    syncedAt: timestamp('synced_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    // No updatedAt — movements are immutable; reversals create new records
  },
  table => [
    index('stock_movements_vendor_id_idx').on(table.vendorId),
    index('stock_movements_item_id_idx').on(table.itemId),
    index('stock_movements_warehouse_id_idx').on(table.warehouseId),
    index('stock_movements_movement_type_idx').on(table.movementType),
    index('stock_movements_erp_movement_id_idx').on(table.erpMovementId),
    index('stock_movements_reference_id_idx').on(table.referenceId),
    index('stock_movements_created_at_idx').on(table.createdAt),
  ],
);

export type StockMovement = typeof stockMovements.$inferSelect;
export type NewStockMovement = typeof stockMovements.$inferInsert;
