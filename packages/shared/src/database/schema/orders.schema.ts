import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  numeric,
  integer,
  jsonb,
  index,
  unique,
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

/**
 * EBP Document Types (SaleDocument.DocumentType)
 */
export enum DocumentType {
  Quote = 0,
  Order = 1,
  Delivery = 2,
  Invoice = 3,
}

/**
 * Validation States (EBP-aligned)
 */
export enum ValidationState {
  Draft = 0,
  Validated = 1,
  Processing = 2,
  Completed = 3,
}

/**
 * Delivery States (EBP-aligned)
 */
export enum DeliveryState {
  NotDelivered = 0,
  PartiallyDelivered = 1,
  FullyDelivered = 2,
}

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    // Document identity (P0: orderNumber must be unique and not null)
    orderNumber: varchar('order_number', { length: 100 }).notNull(),
    reference: varchar('reference', { length: 100 }), // P0: Customer PO/reference number
    documentDate: timestamp('document_date', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),

    // EBP Document Classification (P0: integers not varchar)
    documentType: integer('document_type').default(DocumentType.Order).notNull(), // 0=Quote, 1=Order, 2=Delivery, 3=Invoice
    validationState: integer('validation_state').default(ValidationState.Draft).notNull(), // 0=Draft, 1=Validated, 2=Processing, 3=Completed
    deliveryState: integer('delivery_state').default(DeliveryState.NotDelivered).notNull(), // 0=Not delivered, 1=Partial, 2=Full

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

    // Financial totals
    amountVatExcluded: numeric('amount_vat_excluded', { precision: 12, scale: 2 })
      .default('0')
      .notNull(),
    discountRate: numeric('discount_rate', { precision: 5, scale: 2 }).default('0'),
    discountAmount: numeric('discount_amount', { precision: 12, scale: 2 }).default('0'),

    // P1: Calculated amount fields (stored for performance)
    amountVatExcludedWithDiscount: numeric('amount_vat_excluded_with_discount', {
      precision: 12,
      scale: 2,
    })
      .default('0')
      .notNull(),
    amountVatExcludedWithDiscountAndShipping: numeric(
      'amount_vat_excluded_with_discount_and_shipping',
      { precision: 12, scale: 2 },
    )
      .default('0')
      .notNull(),

    vatAmount: numeric('vat_amount', { precision: 12, scale: 2 }).default('0').notNull(),
    amountVatIncluded: numeric('amount_vat_included', { precision: 12, scale: 2 })
      .default('0')
      .notNull(),
    costPrice: numeric('cost_price', { precision: 12, scale: 2 }).default('0'),

    // Shipping
    shippingAmountVatExcluded: numeric('shipping_amount_vat_excluded', {
      precision: 10,
      scale: 2,
    }).default('0'),
    shippingAmountVatIncluded: numeric('shipping_amount_vat_included', {
      precision: 10,
      scale: 2,
    }).default('0'),
    shippingVatRate: numeric('shipping_vat_rate', { precision: 5, scale: 2 }).default('0'), // P0: Shipping VAT rate
    shippingMethod: varchar('shipping_method', { length: 50 }),
    currencyCode: varchar('currency_code', { length: 3 }).default('EUR'),

    // Payment & Shipping Method
    paymentMethod: varchar('payment_method', { length: 50 }), // NAPS, CARD, BANK_TRANSFER, CASH
    paymentStatus: varchar('payment_status', { length: 50 }).default('pending'), // PENDING, PROCESSING, PAID, FAILED, REFUNDED, CANCELLED
    paymentProvider: varchar('payment_provider', { length: 50 }), // NAPS, STRIPE, PAYPAL
    paymentTransactionId: varchar('payment_transaction_id', { length: 255 }), // External payment ID
    paymentAuthNumber: varchar('payment_auth_number', { length: 50 }), // P0: Authorization number from gateway
    paymentProcessedAt: timestamp('payment_processed_at', { withTimezone: true, mode: 'date' }), // P0: Payment completion time
    paymentAmount: numeric('payment_amount', { precision: 12, scale: 2 }), // Amount actually paid

    // Legacy Status Fields (Backward Compatibility)
    /**
     * Legacy status field for API backward compatibility
     * Derived from validationState + deliveryState
     * Values: PENDING_RESERVATION, RESERVED, PROCESSING, COMPLETED, CANCELLED
     */
    status: varchar('status', { length: 50 }).notNull().default('pending'),

    /**
     * Legacy total amount field (duplicate of amountVatIncluded)
     * Kept for API backward compatibility
     */
    totalAmount: numeric('total_amount', { precision: 10, scale: 2 }).notNull().default('0'),

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

    // Cancellation
    cancelledAt: timestamp('cancelled_at', { withTimezone: true, mode: 'date' }),
    cancelledBy: varchar('cancelled_by', { length: 100 }),
    cancellationReason: text('cancellation_reason'),
    expectedShipDate: timestamp('expected_ship_date', { withTimezone: true, mode: 'date' }), // Separate from deliveryDate

    // Audit
    createdBy: varchar('created_by', { length: 100 }),
    updatedBy: varchar('updated_by', { length: 100 }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  table => [
    // P0: Unique constraint on order number
    unique('orders_order_number_unique').on(table.orderNumber),

    // Performance indexes
    index('orders_vendor_id_idx').on(table.vendorId),
    index('orders_customer_id_idx').on(table.customerId),
    index('orders_validation_state_idx').on(table.validationState),
    index('orders_delivery_state_idx').on(table.deliveryState),
    index('orders_erp_document_id_idx').on(table.erpDocumentId),
    index('orders_document_date_idx').on(table.documentDate),
    index('orders_payment_status_idx').on(table.paymentStatus),
    index('orders_document_type_idx').on(table.documentType),
    index('orders_status_idx').on(table.status),
  ],
);

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;

/**
 * Address Snapshot Interface (for JSONB fields)
 * Used for billingAddress and shippingAddress
 */
export interface AddressSnapshot {
  name?: string;
  company?: string;
  address1: string;
  address2?: string;
  address3?: string;
  city: string;
  zipCode: string;
  state?: string;
  country: string;
  countryIsoCode?: string;
  phone?: string;
  email?: string;
}
