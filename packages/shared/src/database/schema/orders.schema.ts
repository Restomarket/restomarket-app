import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  numeric,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { warehouses } from './warehouses.schema.js';

/**
 * Orders Schema
 *
 * Represents customer orders with full ERP integration fields.
 * Emits 'order.created' event on creation to trigger the order→ERP sync flow.
 *
 * Lifecycle: created → validated → synced_to_erp → delivered
 */

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    // Document identity
    orderNumber: varchar('order_number', { length: 100 }),
    documentDate: timestamp('document_date', { withTimezone: true, mode: 'date' }),
    documentType: varchar('document_type', { length: 50 }).default('order'),
    validationState: varchar('validation_state', { length: 50 }).default('pending'),

    // Customer info
    vendorId: varchar('vendor_id', { length: 100 }).notNull(),
    customerId: varchar('customer_id', { length: 100 }),
    customerEmail: varchar('customer_email', { length: 255 }),
    customerPhone: varchar('customer_phone', { length: 50 }),
    erpCustomerCode: varchar('erp_customer_code', { length: 100 }),

    // Addresses (JSONB for flexibility)
    billingAddress: jsonb('billing_address'),
    shippingAddress: jsonb('shipping_address'),

    // Logistics
    warehouseId: uuid('warehouse_id').references(() => warehouses.id),
    deliveryDate: timestamp('delivery_date', { withTimezone: true, mode: 'date' }),
    deliveryState: varchar('delivery_state', { length: 50 }).default('pending'),

    // Financial totals
    amountVatExcluded: numeric('amount_vat_excluded', { precision: 12, scale: 2 }),
    discountRate: numeric('discount_rate', { precision: 5, scale: 2 }).default('0'),
    discountAmount: numeric('discount_amount', { precision: 12, scale: 2 }).default('0'),
    vatAmount: numeric('vat_amount', { precision: 12, scale: 2 }),
    amountVatIncluded: numeric('amount_vat_included', { precision: 12, scale: 2 }),
    costPrice: numeric('cost_price', { precision: 12, scale: 2 }),
    shippingAmountVatExcluded: numeric('shipping_amount_vat_excluded', {
      precision: 10,
      scale: 2,
    }).default('0'),
    shippingAmountVatIncluded: numeric('shipping_amount_vat_included', {
      precision: 10,
      scale: 2,
    }).default('0'),

    // Payment
    paymentMethod: varchar('payment_method', { length: 50 }),
    paymentStatus: varchar('payment_status', { length: 50 }).default('pending'),
    paymentProvider: varchar('payment_provider', { length: 50 }),
    paymentTransactionId: varchar('payment_transaction_id', { length: 255 }),
    paymentAmount: numeric('payment_amount', { precision: 12, scale: 2 }),

    // ERP sync fields
    erpReference: varchar('erp_reference', { length: 100 }),
    erpStatus: varchar('erp_status', { length: 50 }),
    erpDocumentId: varchar('erp_document_id', { length: 100 }),
    erpSerialId: varchar('erp_serial_id', { length: 100 }),
    erpVatId: varchar('erp_vat_id', { length: 100 }),
    erpTerritorialityId: varchar('erp_territoriality_id', { length: 100 }),
    erpSettlementModeId: varchar('erp_settlement_mode_id', { length: 100 }),
    erpSyncedAt: timestamp('erp_synced_at', { withTimezone: true, mode: 'date' }),
    erpSyncError: text('erp_sync_error'),
    contentHash: varchar('content_hash', { length: 64 }),

    // Job tracking
    reservationJobId: varchar('reservation_job_id', { length: 100 }),

    // Notes
    customerNotes: text('customer_notes'),
    internalNotes: text('internal_notes'),

    // Audit
    createdBy: varchar('created_by', { length: 100 }),
    updatedBy: varchar('updated_by', { length: 100 }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  table => [
    index('orders_vendor_id_idx').on(table.vendorId),
    index('orders_customer_id_idx').on(table.customerId),
    index('orders_validation_state_idx').on(table.validationState),
    index('orders_delivery_state_idx').on(table.deliveryState),
    index('orders_erp_document_id_idx').on(table.erpDocumentId),
    index('orders_document_date_idx').on(table.documentDate),
    index('orders_payment_status_idx').on(table.paymentStatus),
    index('orders_order_number_idx').on(table.orderNumber),
  ],
);

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
