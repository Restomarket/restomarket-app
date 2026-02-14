# Refined Implementation Plan — ERP Sync Architecture

> **Based on:** Gap Analysis 2026-02-12  
> **Status:** REFINED WITH CRITICAL GAPS ADDRESSED  
> **Total Tasks:** 30 (original 23 + 7 new)

---

## Critical Findings from Gap Analysis

### ❌ BLOCKING ISSUES IDENTIFIED

1. **Orders Schema Missing** — Task 11 marked as "passing" but has no database tables
2. **Business Entity Repositories Missing** — SyncIngestService uses raw Drizzle instead of repository pattern
3. **Critical Item Fields Missing** — `erpId`, `priceExclVat`, `priceInclVat`, `manageStock` needed for ERP parity
4. **Orders Module Missing** — No service/controller to emit order creation events

### ✅ WHAT ALREADY EXISTS (Contrary to Spec)

- `items`, `warehouses`, `stock` schemas ALREADY EXIST with `content_hash` + `last_synced_at`
- All 5 sync schemas exist (sync_jobs, agent_registry, erp_code_mappings, dead_letter_queue, reconciliation_events)
- All sync services implemented (Tasks 5-17)
- Spec REQ-2 NOTE is **WRONG** — says business tables don't exist, but they do

---

## Revised Task Breakdown

### Phase 1: Foundation & Schemas (Tasks 1-2)

#### Task 1: Install Dependencies + Redis + Config ✅ passing

**Status:** COMPLETE  
**No changes needed.**

---

#### Task 2: Database Schemas + Repositories

**MAJOR REVISION:** Split into 7 sub-tasks to address gaps.

---

##### Task 2.1: Create Orders & Order Items Schemas (NEW — BLOCKING)

- **Priority:** P0 (CRITICAL — blocks Task 11)
- **Status:** ❌ **not started**
- **Depends on:** Task 1
- **Complexity:** 7

**Description:**  
Create comprehensive `orders` and `order_items` schemas with full ERP integration fields.

**Implementation Details:**

1. **Create `packages/shared/src/database/schema/orders.schema.ts`:**

```typescript
export const orders = pgTable(
  'orders',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    // Document Identity
    orderNumber: varchar('order_number', { length: 50 }).unique().notNull(),
    documentDate: timestamp('document_date', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    reference: varchar('reference', { length: 100 }),
    documentType: integer('document_type').default(1).notNull(), // 0=Quote, 1=Order, 2=Delivery, 3=Invoice
    validationState: integer('validation_state').default(0).notNull(), // 0=Draft, 1=Validated, 2=Processing, 3=Completed

    // Customer Info
    vendorId: uuid('vendor_id').notNull(),
    customerId: uuid('customer_id').notNull(),
    customerEmail: varchar('customer_email', { length: 100 }),
    customerPhone: varchar('customer_phone', { length: 30 }),
    erpCustomerCode: varchar('erp_customer_code', { length: 20 }).notNull(),

    // Addresses (JSONB)
    billingAddress: jsonb('billing_address'),
    shippingAddress: jsonb('shipping_address'),

    // Logistics
    warehouseId: uuid('warehouse_id').references(() => warehouses.id),
    deliveryDate: timestamp('delivery_date', { withTimezone: true, mode: 'date' }),
    deliveryState: integer('delivery_state').default(0).notNull(),

    // Financial Totals (full breakdown)
    amountVatExcluded: numeric('amount_vat_excluded', { precision: 12, scale: 2 })
      .default('0')
      .notNull(),
    discountRate: numeric('discount_rate', { precision: 5, scale: 2 }).default('0').notNull(),
    discountAmount: numeric('discount_amount', { precision: 12, scale: 2 }).default('0').notNull(),
    amountVatExcludedWithDiscount: numeric('amount_vat_excluded_with_discount', {
      precision: 12,
      scale: 2,
    })
      .default('0')
      .notNull(),
    shippingAmountVatExcluded: numeric('shipping_amount_vat_excluded', { precision: 10, scale: 2 })
      .default('0')
      .notNull(),
    shippingVatRate: numeric('shipping_vat_rate', { precision: 5, scale: 2 })
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
    costPrice: numeric('cost_price', { precision: 12, scale: 2 }).default('0').notNull(),

    // Payment
    paymentMethod: varchar('payment_method', { length: 50 }),
    shippingMethod: varchar('shipping_method', { length: 50 }),
    currencyCode: varchar('currency_code', { length: 3 }).default('EUR').notNull(),
    paymentStatus: varchar('payment_status', { length: 20 }).default('PENDING').notNull(),
    paymentProvider: varchar('payment_provider', { length: 50 }),
    paymentTransactionId: varchar('payment_transaction_id', { length: 100 }),
    paymentAuthNumber: varchar('payment_auth_number', { length: 50 }),
    paymentProcessedAt: timestamp('payment_processed_at', { withTimezone: true, mode: 'date' }),
    paymentAmount: numeric('payment_amount', { precision: 12, scale: 2 }),

    // ERP Synchronization (CRITICAL FIELDS)
    erpReference: varchar('erp_reference', { length: 100 }),
    erpStatus: varchar('erp_status', { length: 50 }),
    erpDocumentId: varchar('erp_document_id', { length: 100 }),
    erpSerialId: varchar('erp_serial_id', { length: 2 }),
    erpVatId: varchar('erp_vat_id', { length: 100 }),
    erpTerritorialityId: varchar('erp_territoriality_id', { length: 100 }),
    erpSettlementModeId: varchar('erp_settlement_mode_id', { length: 6 }),
    erpSyncedAt: timestamp('erp_synced_at', { withTimezone: true, mode: 'date' }),
    erpSyncError: text('erp_sync_error'),
    contentHash: varchar('content_hash', { length: 64 }),

    // Job Tracking
    reservationJobId: varchar('reservation_job_id', { length: 100 }), // Sync job ID

    // Notes
    customerNotes: text('customer_notes'),
    internalNotes: text('internal_notes'),

    // Audit
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    createdBy: varchar('created_by', { length: 100 }),
    updatedBy: varchar('updated_by', { length: 100 }),
  },
  table => [
    index('orders_vendor_id_idx').on(table.vendorId),
    index('orders_customer_id_idx').on(table.customerId),
    index('orders_validation_state_idx').on(table.validationState),
    index('orders_delivery_state_idx').on(table.deliveryState),
    index('orders_erp_document_id_idx').on(table.erpDocumentId),
    index('orders_document_date_idx').on(table.documentDate),
    index('orders_payment_status_idx').on(table.paymentStatus),
  ],
);
```

2. **Create `packages/shared/src/database/schema/order-items.schema.ts`:**

```typescript
export const orderItems = pgTable(
  'order_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),

    lineOrder: integer('line_order').notNull(),

    sku: varchar('sku', { length: 100 }).notNull(),
    itemId: uuid('item_id').references(() => items.id),
    description: text('description').notNull(),

    // Quantity tracking (full breakdown)
    quantity: numeric('quantity', { precision: 10, scale: 3 }).notNull(),
    orderedQuantity: numeric('ordered_quantity', { precision: 10, scale: 3 }).notNull(),
    deliveredQuantity: numeric('delivered_quantity', { precision: 10, scale: 3 })
      .default('0')
      .notNull(),
    remainingQuantityToDeliver: numeric('remaining_quantity_to_deliver', {
      precision: 10,
      scale: 3,
    }).notNull(),
    returnedQuantity: numeric('returned_quantity', { precision: 10, scale: 3 })
      .default('0')
      .notNull(),
    invoicedQuantity: numeric('invoiced_quantity', { precision: 10, scale: 3 })
      .default('0')
      .notNull(),
    remainingQuantityToInvoice: numeric('remaining_quantity_to_invoice', {
      precision: 10,
      scale: 3,
    }).notNull(),

    // Unit & Warehouse
    unitCode: varchar('unit_code', { length: 50 }),
    warehouseId: uuid('warehouse_id').references(() => warehouses.id),
    manageStock: boolean('manage_stock').default(true).notNull(),

    // Pricing (full breakdown)
    purchasePrice: numeric('purchase_price', { precision: 10, scale: 4 }).default('0').notNull(),
    costPrice: numeric('cost_price', { precision: 10, scale: 4 }).default('0').notNull(),
    unitPrice: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
    netPriceVatExcluded: numeric('net_price_vat_excluded', { precision: 10, scale: 2 }).notNull(),
    netPriceVatIncluded: numeric('net_price_vat_included', { precision: 10, scale: 2 }),
    netAmountVatExcluded: numeric('net_amount_vat_excluded', { precision: 12, scale: 2 })
      .default('0')
      .notNull(),
    netAmountVatExcludedWithDiscount: numeric('net_amount_vat_excluded_with_discount', {
      precision: 12,
      scale: 2,
    })
      .default('0')
      .notNull(),
    netAmountVatIncluded: numeric('net_amount_vat_included', { precision: 12, scale: 2 })
      .default('0')
      .notNull(),

    // Discounts & VAT
    discountRate: numeric('discount_rate', { precision: 5, scale: 2 }).default('0').notNull(),
    discountAmount: numeric('discount_amount', { precision: 12, scale: 2 }).default('0').notNull(),
    vatRate: numeric('vat_rate', { precision: 5, scale: 2 }).default('0').notNull(),
    vatAmount: numeric('vat_amount', { precision: 12, scale: 2 }).default('0').notNull(),
    erpVatId: varchar('erp_vat_id', { length: 100 }),

    // Delivery
    deliveryDate: timestamp('delivery_date', { withTimezone: true, mode: 'date' }),
    deliveryState: integer('delivery_state').default(0).notNull(),

    // Reservation Tracking (inline)
    reservationStatus: varchar('reservation_status', { length: 20 }).default('pending').notNull(),
    reservedAt: timestamp('reserved_at', { withTimezone: true, mode: 'date' }),
    reservationExpiresAt: timestamp('reservation_expires_at', { withTimezone: true, mode: 'date' }),

    // Physical
    weight: numeric('weight', { precision: 10, scale: 3 }),
    volume: numeric('volume', { precision: 10, scale: 6 }),

    // ERP Sync
    erpLineId: varchar('erp_line_id', { length: 100 }),
    erpSyncedAt: timestamp('erp_synced_at', { withTimezone: true, mode: 'date' }),
    stockMovementId: integer('stock_movement_id'),

    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  table => [
    index('order_items_order_id_idx').on(table.orderId),
    index('order_items_item_id_idx').on(table.itemId),
    index('order_items_delivery_state_idx').on(table.deliveryState),
    index('order_items_reservation_status_idx').on(table.reservationStatus),
    index('order_items_reservation_expires_at_idx').on(table.reservationExpiresAt),
  ],
);
```

3. **Create relations in `packages/shared/src/database/schema/order-relations.ts`:**

```typescript
export const ordersRelations = relations(orders, ({ one, many }) => ({
  warehouse: one(warehouses, {
    fields: [orders.warehouseId],
    references: [warehouses.id],
  }),
  items: many(orderItems),
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
```

4. **Update `packages/shared/src/database/schema/sync-relations.ts`:**

```typescript
// Add FK from sync_jobs to orders
export const syncJobsRelations = relations(syncJobs, ({ one }) => ({
  order: one(orders, {
    fields: [syncJobs.postgresOrderId],
    references: [orders.id],
  }),
}));
```

5. **Export from `packages/shared/src/database/schema/index.ts`:**

```typescript
export * from './orders.schema';
export * from './order-items.schema';
export * from './order-relations';
```

6. **Register in `apps/api/src/database/database.module.ts`:**

```typescript
import {
  orders,
  orderItems,
  ordersRelations,
  orderItemsRelations,
} from '@repo/shared/database/schema';

const schema = {
  // ...existing
  orders,
  orderItems,
  ordersRelations,
  orderItemsRelations,
};
```

**Validation Commands:**

```bash
pnpm turbo lint --filter=@apps/api --fix
pnpm turbo build --filter=@repo/shared
pnpm turbo build --filter=@apps/api
pnpm turbo type-check
pnpm db:generate
pnpm db:migrate
```

**Acceptance Criteria:**

- [ ] orders.schema.ts created with 40+ fields
- [ ] order-items.schema.ts created with 30+ fields
- [ ] order-relations.ts created with proper relations
- [ ] sync-relations.ts updated with FK to orders
- [ ] Schemas exported from index.ts
- [ ] Schemas registered in database.module.ts
- [ ] Migration generated and applied
- [ ] Build passes without errors

---

##### Task 2.2: Add Missing Critical Fields to Items Schema (NEW — BLOCKING)

- **Priority:** P0 (CRITICAL)
- **Status:** ❌ **not started**
- **Depends on:** Task 1
- **Complexity:** 4

**Description:**  
Add ERP-specific and pricing fields required for full ERP parity.

**Implementation Details:**

1. **Modify `packages/shared/src/database/schema/items.schema.ts`:**

```typescript
export const items = pgTable(
  'items',
  {
    // ...existing fields...

    // ADD NEW FIELDS:

    // ERP Identity
    erpId: varchar('erp_id', { length: 100 }).notNull(), // EBP Item.Id (Guid)

    // Pricing (full breakdown)
    priceExclVat: numeric('price_excl_vat', { precision: 10, scale: 2 }).notNull(),
    priceInclVat: numeric('price_incl_vat', { precision: 10, scale: 2 }).notNull(),
    vatAmount: numeric('vat_amount', { precision: 10, scale: 2 }).notNull(),

    // Stock Management Flags
    manageStock: boolean('manage_stock').default(true).notNull(),
    allowNegativeStock: boolean('allow_negative_stock').default(false).notNull(),

    // Retail
    barcode: varchar('barcode', { length: 100 }),

    // ...existing fields (contentHash, lastSyncedAt, etc.)...
  },
  table => [
    // ...existing indexes...
    index('items_erp_id_idx').on(table.erpId),
    index('items_manage_stock_idx').on(table.manageStock),
  ],
);
```

2. **Create migration:**

```sql
ALTER TABLE items ADD COLUMN erp_id VARCHAR(100);
ALTER TABLE items ADD COLUMN price_excl_vat NUMERIC(10,2);
ALTER TABLE items ADD COLUMN price_incl_vat NUMERIC(10,2);
ALTER TABLE items ADD COLUMN vat_amount NUMERIC(10,2);
ALTER TABLE items ADD COLUMN manage_stock BOOLEAN DEFAULT TRUE NOT NULL;
ALTER TABLE items ADD COLUMN allow_negative_stock BOOLEAN DEFAULT FALSE NOT NULL;
ALTER TABLE items ADD COLUMN barcode VARCHAR(100);

-- Backfill erpId from sku (temporary)
UPDATE items SET erp_id = sku WHERE erp_id IS NULL;
ALTER TABLE items ALTER COLUMN erp_id SET NOT NULL;

-- Backfill pricing from unitPrice
UPDATE items SET
  price_excl_vat = unit_price / (1 + vat_rate / 100),
  price_incl_vat = unit_price,
  vat_amount = unit_price - (unit_price / (1 + vat_rate / 100))
WHERE price_excl_vat IS NULL;

ALTER TABLE items ALTER COLUMN price_excl_vat SET NOT NULL;
ALTER TABLE items ALTER COLUMN price_incl_vat SET NOT NULL;
ALTER TABLE items ALTER COLUMN vat_amount SET NOT NULL;

CREATE INDEX items_erp_id_idx ON items(erp_id);
CREATE INDEX items_manage_stock_idx ON items(manage_stock);
```

**Validation Commands:**

```bash
pnpm turbo lint --filter=@apps/api --fix
pnpm turbo build --filter=@repo/shared
pnpm turbo build --filter=@apps/api
pnpm turbo type-check
pnpm db:generate
pnpm db:migrate
```

**Acceptance Criteria:**

- [ ] 7 new fields added to items schema
- [ ] Migration generated with backfill logic
- [ ] All existing data migrated successfully
- [ ] Build passes

---

##### Task 2.3: Add Missing Fields to Warehouses Schema (NEW — P1)

- **Priority:** P1
- **Status:** ❌ **not started**
- **Depends on:** Task 1
- **Complexity:** 2

**Description:**  
Add warehouse type and default flags.

**Implementation Details:**

1. **Modify `packages/shared/src/database/schema/warehouses.schema.ts`:**

```typescript
export const warehouses = pgTable('warehouses', {
  // ...existing fields...

  // ADD NEW FIELDS:
  isDefault: boolean('is_default').default(false).notNull(),
  isMain: boolean('is_main').default(false).notNull(),
  type: integer('type').default(0).notNull(), // 0=Storage, 1=Transit

  // ...existing fields...
});
```

2. **Create migration:**

```sql
ALTER TABLE warehouses ADD COLUMN is_default BOOLEAN DEFAULT FALSE NOT NULL;
ALTER TABLE warehouses ADD COLUMN is_main BOOLEAN DEFAULT FALSE NOT NULL;
ALTER TABLE warehouses ADD COLUMN type INTEGER DEFAULT 0 NOT NULL;
```

**Validation Commands:** Same as Task 2.2

**Acceptance Criteria:**

- [ ] 3 new fields added
- [ ] Migration applied
- [ ] Build passes

---

##### Task 2.4: Add Missing Fields to Stock Schema (NEW — P1)

- **Priority:** P1
- **Status:** ❌ **not started**
- **Depends on:** Task 1
- **Complexity:** 3

**Description:**  
Add cost tracking and inventory planning fields.

**Implementation Details:**

1. **Modify `packages/shared/src/database/schema/stock.schema.ts`:**

```typescript
export const stock = pgTable('stock', {
  // ...existing fields...

  // ADD NEW FIELDS:
  orderedQuantity: numeric('ordered_quantity', { precision: 10, scale: 2 }).default('0').notNull(),
  pump: numeric('pump', { precision: 10, scale: 4 }).default('0').notNull(), // Weighted avg cost
  stockValue: numeric('stock_value', { precision: 12, scale: 2 }).default('0').notNull(), // quantity × pump
  minStock: numeric('min_stock', { precision: 10, scale: 2 }).default('0').notNull(),
  maxStock: numeric('max_stock', { precision: 10, scale: 2 }),

  // ...existing fields...
});
```

2. **Create migration:**

```sql
ALTER TABLE stock ADD COLUMN ordered_quantity NUMERIC(10,2) DEFAULT 0 NOT NULL;
ALTER TABLE stock ADD COLUMN pump NUMERIC(10,4) DEFAULT 0 NOT NULL;
ALTER TABLE stock ADD COLUMN stock_value NUMERIC(12,2) DEFAULT 0 NOT NULL;
ALTER TABLE stock ADD COLUMN min_stock NUMERIC(10,2) DEFAULT 0 NOT NULL;
ALTER TABLE stock ADD COLUMN max_stock NUMERIC(10,2);
```

**Validation Commands:** Same as Task 2.2

**Acceptance Criteria:**

- [ ] 5 new fields added
- [ ] Migration applied
- [ ] Build passes

---

##### Task 2.5: Create Business Entity Repositories (NEW — BLOCKING)

- **Priority:** P0 (CRITICAL for clean architecture)
- **Status:** ❌ **not started**
- **Depends on:** Task 2.1, Task 2.2
- **Complexity:** 8

**Description:**  
Create repository abstractions for all business entities following the two-layer pattern.

**Implementation Details:**

**1. ItemsRepositoryBase** (`packages/shared/src/database/repositories/items/items.repository.base.ts`):

```typescript
export class ItemsRepositoryBase extends BaseRepository<typeof items> {
  async findByVendorAndSku(vendorId: string, sku: string): Promise<Item | null> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.vendorId, vendorId), eq(this.table.sku, sku)))
      .limit(1);
    return results[0] ?? null;
  }

  async findByVendorAndErpId(vendorId: string, erpId: string): Promise<Item | null> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.vendorId, vendorId), eq(this.table.erpId, erpId)))
      .limit(1);
    return results[0] ?? null;
  }

  async upsertBatch(itemsData: Array<NewItem>): Promise<void> {
    await this.db
      .insert(this.table)
      .values(itemsData)
      .onConflictDoUpdate({
        target: [this.table.vendorId, this.table.sku],
        set: {
          name: sql`excluded.name`,
          erpId: sql`excluded.erp_id`,
          description: sql`excluded.description`,
          priceExclVat: sql`excluded.price_excl_vat`,
          priceInclVat: sql`excluded.price_incl_vat`,
          vatAmount: sql`excluded.vat_amount`,
          unitCode: sql`excluded.unit_code`,
          unitLabel: sql`excluded.unit_label`,
          vatCode: sql`excluded.vat_code`,
          vatRate: sql`excluded.vat_rate`,
          familyCode: sql`excluded.family_code`,
          familyLabel: sql`excluded.family_label`,
          subfamilyCode: sql`excluded.subfamily_code`,
          subfamilyLabel: sql`excluded.subfamily_label`,
          manageStock: sql`excluded.manage_stock`,
          allowNegativeStock: sql`excluded.allow_negative_stock`,
          barcode: sql`excluded.barcode`,
          isActive: sql`excluded.is_active`,
          contentHash: sql`excluded.content_hash`,
          lastSyncedAt: sql`excluded.last_synced_at`,
          updatedAt: sql`NOW()`,
        },
      });
  }

  async findByVendor(vendorId: string, page = 1, limit = 50): Promise<Item[]> {
    return this.db
      .select()
      .from(this.table)
      .where(eq(this.table.vendorId, vendorId))
      .limit(limit)
      .offset((page - 1) * limit);
  }
}
```

**2. WarehousesRepositoryBase** — similar pattern with `findByVendorAndErpId`, `upsertBatch`, `findByVendor`

**3. StockRepositoryBase** — `findByVendorWarehouseItem`, `upsertBatch`, `updateQuantity`

**4. OrdersRepositoryBase** — `create`, `findById`, `updateErpReference`, `findByVendor`

**5. OrderItemsRepositoryBase** — `createBatch`, `findByOrderId`, `updateDeliveryStatus`

**6. NestJS adapters** in `apps/api/src/database/adapters/`:

- `nestjs-items.repository.ts`
- `nestjs-warehouses.repository.ts`
- `nestjs-stock.repository.ts`
- `nestjs-orders.repository.ts`
- `nestjs-order-items.repository.ts`

Each adapter follows this pattern:

```typescript
@Injectable()
export class ItemsRepository extends ItemsRepositoryBase {
  constructor(@Inject(DATABASE_CONNECTION) db: DatabaseConnection, pinoLogger: PinoLogger) {
    const logger: ILogger = {
      info: (msg, ctx) => pinoLogger.info(ctx ?? {}, msg),
      error: (msg, ctx) => pinoLogger.error(ctx ?? {}, msg),
      warn: (msg, ctx) => pinoLogger.warn(ctx ?? {}, msg),
      debug: (msg, ctx) => pinoLogger.debug(ctx ?? {}, msg),
    };
    super(db, items, logger);
    pinoLogger.setContext(ItemsRepository.name);
  }
}
```

**7. Provide in DatabaseModule:**

```typescript
// apps/api/src/database/database.module.ts
@Module({
  providers: [
    // ...existing repos...
    ItemsRepository,
    WarehousesRepository,
    StockRepository,
    OrdersRepository,
    OrderItemsRepository,
  ],
  exports: [
    // ...existing repos...
    ItemsRepository,
    WarehousesRepository,
    StockRepository,
    OrdersRepository,
    OrderItemsRepository,
  ],
})
export class DatabaseModule {}
```

**Files to create:**

- 5 base repos in `packages/shared/src/database/repositories/`
- 5 adapters in `apps/api/src/database/adapters/`
- Update `packages/shared/src/database/repositories/index.ts`
- Update `apps/api/src/database/adapters/index.ts`

**Validation Commands:**

```bash
pnpm turbo lint --filter=@apps/api --fix
pnpm turbo build --filter=@repo/shared
pnpm turbo build --filter=@apps/api
pnpm turbo type-check
```

**Acceptance Criteria:**

- [ ] 5 base repositories created
- [ ] 5 NestJS adapters created
- [ ] All extend BaseRepository<TTable>
- [ ] Type-safe query methods
- [ ] Provided in DatabaseModule
- [ ] Build passes

---

##### Task 2.6: Create Orders Module (NEW — BLOCKING)

- **Priority:** P0 (BLOCKS Task 11)
- **Status:** ❌ **not started**
- **Depends on:** Task 2.1, Task 2.5
- **Complexity:** 7

**Description:**  
Create full orders module with service, controller, DTOs, and event emission.

**Implementation Details:**

**1. Create DTOs:**

```typescript
// apps/api/src/modules/orders/dto/create-order.dto.ts
export class CreateOrderDto {
  @IsString() @IsNotEmpty() orderNumber: string;
  @IsISO8601() documentDate: string;
  @IsUUID() vendorId: string;
  @IsUUID() customerId: string;
  @IsEmail() customerEmail: string;
  @IsString() erpCustomerCode: string;
  @Type(() => AddressDto) billingAddress: AddressDto;
  @Type(() => AddressDto) shippingAddress: AddressDto;
  @IsUUID() warehouseId: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => OrderItemDto) items: OrderItemDto[];
  @IsOptional() @IsString() customerNotes?: string;
  // ...all required fields with validation
}

// apps/api/src/modules/orders/dto/order-item.dto.ts
export class OrderItemDto {
  @IsString() sku: string;
  @IsUUID() @IsOptional() itemId?: string;
  @IsString() description: string;
  @IsNumber() quantity: number;
  @IsNumber() unitPrice: number;
  @IsString() unitCode: string;
  // ...
}
```

**2. Create Event:**

```typescript
// apps/api/src/modules/orders/events/order-created.event.ts
export class OrderCreatedEvent {
  constructor(
    public readonly orderId: string,
    public readonly vendorId: string,
    public readonly orderData: CreateOrderDto,
  ) {}
}
```

**3. Create OrdersService:**

```typescript
// apps/api/src/modules/orders/orders.service.ts
@Injectable()
export class OrdersService {
  constructor(
    private readonly ordersRepository: OrdersRepository,
    private readonly orderItemsRepository: OrderItemsRepository,
    private readonly eventEmitter: EventEmitter2,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(OrdersService.name);
  }

  async createOrder(dto: CreateOrderDto): Promise<Order> {
    // 1. Calculate totals
    const totals = this.calculateOrderTotals(dto);

    // 2. Create order
    const order = await this.ordersRepository.create({
      ...dto,
      ...totals,
      validationState: 0,
      deliveryState: 0,
      paymentStatus: 'PENDING',
    });

    // 3. Create order items
    await this.orderItemsRepository.createBatch(
      dto.items.map((item, idx) => ({
        orderId: order.id,
        lineOrder: idx + 1,
        ...item,
      })),
    );

    // 4. Emit event for sync job creation
    this.eventEmitter.emit('order.created', new OrderCreatedEvent(order.id, order.vendorId, dto));

    this.logger.info('Order created', { orderId: order.id, vendorId: order.vendorId });

    return order;
  }

  async findById(id: string): Promise<Order | null> {
    return this.ordersRepository.findById(id);
  }

  async findByVendor(vendorId: string, page: number, limit: number): Promise<Order[]> {
    return this.ordersRepository.findByVendor(vendorId, page, limit);
  }

  async updateErpReference(
    orderId: string,
    erpReference: string,
    erpDocumentId: string,
  ): Promise<void> {
    await this.ordersRepository.updateErpReference(orderId, erpReference, erpDocumentId);
  }

  private calculateOrderTotals(dto: CreateOrderDto): {
    amountVatExcluded: string;
    vatAmount: string;
    amountVatIncluded: string;
    // ...
  } {
    // Calculate from items
    // Apply discount
    // Add shipping
    return totals;
  }
}
```

**4. Create OrdersController:**

```typescript
// apps/api/src/modules/orders/orders.controller.ts
@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Create new order' })
  @ApiResponse({ status: 201, description: 'Order created successfully' })
  async createOrder(@Body() dto: CreateOrderDto): Promise<Order> {
    return this.ordersService.createOrder(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order by ID' })
  async getOrder(@Param('id', ParseUUIDPipe) id: string): Promise<Order> {
    const order = await this.ordersService.findById(id);
    if (!order) {
      throw new NotFoundException(`Order ${id} not found`);
    }
    return order;
  }

  @Get()
  @ApiOperation({ summary: 'List orders' })
  async listOrders(
    @Query('vendorId', ParseUUIDPipe) vendorId: string,
    @Query('page', ParseIntPipe) page = 1,
    @Query('limit', ParseIntPipe) limit = 50,
  ): Promise<Order[]> {
    return this.ordersService.findByVendor(vendorId, page, limit);
  }
}
```

**5. Create OrdersModule:**

```typescript
// apps/api/src/modules/orders/orders.module.ts
@Module({
  imports: [DatabaseModule, EventEmitterModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
```

**6. Register in AppModule:**

```typescript
// apps/api/src/app.module.ts
@Module({
  imports: [
    // ...existing
    OrdersModule,
  ],
})
export class AppModule {}
```

**Files to create:**

- `apps/api/src/modules/orders/orders.module.ts`
- `apps/api/src/modules/orders/orders.service.ts`
- `apps/api/src/modules/orders/orders.controller.ts`
- `apps/api/src/modules/orders/dto/create-order.dto.ts`
- `apps/api/src/modules/orders/dto/order-item.dto.ts`
- `apps/api/src/modules/orders/dto/address.dto.ts`
- `apps/api/src/modules/orders/events/order-created.event.ts`
- `apps/api/src/modules/orders/__tests__/orders.service.spec.ts`

**Validation Commands:**

```bash
pnpm turbo lint --filter=@apps/api --fix
pnpm turbo build --filter=@apps/api
pnpm turbo test --filter=@apps/api -- --testPathPattern=orders
pnpm turbo type-check
```

**Acceptance Criteria:**

- [ ] OrdersModule created and registered
- [ ] OrdersService with createOrder + event emission
- [ ] OrdersController with 3 endpoints
- [ ] DTOs with validation
- [ ] Event emitter configured
- [ ] Unit tests passing
- [ ] Build passes

---

##### Task 2.7: Refactor SyncIngestService to Use Repositories (NEW — P1)

- **Priority:** P1 (Tech debt, not blocking)
- **Status:** ❌ **not started**
- **Depends on:** Task 2.5, Task 9
- **Complexity:** 5

**Description:**  
Replace raw Drizzle queries with repository calls for cleaner architecture.

**Implementation Details:**

**Before (current):**

```typescript
// sync-ingest.service.ts
const existingItems = await this.db
  .select()
  .from(items)
  .where(and(eq(items.vendorId, vendorId), eq(items.sku, itemPayload.sku)))
  .limit(1);

const existingItem = existingItems[0];
```

**After:**

```typescript
// sync-ingest.service.ts
constructor(
  private readonly itemsRepository: ItemsRepository,
  private readonly warehousesRepository: WarehousesRepository,
  private readonly stockRepository: StockRepository,
  private readonly erpMappingService: ErpMappingService,
  private readonly logger: PinoLogger,
) {
  this.logger.setContext(SyncIngestService.name);
}

const existingItem = await this.itemsRepository.findByVendorAndSku(vendorId, itemPayload.sku);
```

**Also refactor:**

- `handleStockChanges()` → use `stockRepository.findByVendorWarehouseItem()`
- `handleWarehouseChanges()` → use `warehousesRepository.findByVendorAndErpId()`
- Batch upsert → use `itemsRepository.upsertBatch()`

**Validation Commands:**

```bash
pnpm turbo lint --filter=@apps/api --fix
pnpm turbo build --filter=@apps/api
pnpm turbo test --filter=@apps/api -- --testPathPattern=sync-ingest
pnpm turbo type-check
```

**Acceptance Criteria:**

- [ ] All raw Drizzle queries removed
- [ ] Repository methods used throughout
- [ ] Tests still pass
- [ ] Build passes

---

### Phase 2: Repositories (Task 3) — ✅ passing

**No changes needed.** Sync repositories already exist.

---

### Phase 3: Module Scaffold (Task 4) — ✅ passing

**No changes needed.**

---

### Phase 4: Core Services (Tasks 5-8) — ✅ passing

**No changes needed.** All sync services implemented.

---

### Phase 5: Direct Ingest (Task 9) — ✅ passing

**Dependency update:**

**Current:**

```yaml
Depends on: Task 6, Task 3
```

**Revised:**

```yaml
Depends on: Task 2.5, Task 6, Task 3
RECOMMENDED: Refactor to use repositories (Task 2.7) after this task
```

**No implementation changes needed.** Already passing.

---

### Phase 6: Outbound Sync (Tasks 10-12)

#### Task 10: Sync Job Service — ✅ passing

**No changes needed.**

---

#### Task 11: Order Sync Processor + Agent Callback Controller

**STATUS CHANGE:** ✅ passing → ❌ **BLOCKED**

**Dependencies:**

**Current:**

```yaml
Depends on: Task 8, Task 10
```

**Revised:**

```yaml
Depends on: Task 2.1, Task 2.6, Task 8, Task 10
Status: BLOCKED — cannot pass without orders schema and module
```

**Why blocked:**

1. No `orders` table exists — `sync_jobs.postgres_order_id` is orphaned FK
2. No `OrdersModule` exists to emit order creation events
3. `OrderSyncProcessor` cannot query/update orders
4. Agent callback cannot update `orders.erp_reference`

**Unblock requirements:**

1. Complete Task 2.1 (orders schema)
2. Complete Task 2.6 (orders module)
3. Re-validate Task 11

**Implementation changes needed:**

**In `order-erp-sync.listener.ts`:**

```typescript
// BEFORE: No event listener exists

// AFTER: Listen for order.created event
@Injectable()
export class OrderErpSyncListener {
  constructor(private readonly syncJobService: SyncJobService) {}

  @OnEvent('order.created')
  async handleOrderCreated(event: OrderCreatedEvent) {
    await this.syncJobService.createOrderJob(event.vendorId, event.orderId, event.orderData);
  }
}
```

**In `agent-callback.controller.ts`:**

```typescript
// ADD: Update order ERP reference on callback
@Post('callback')
async handleCallback(@Body() dto: AgentCallbackDto) {
  if (dto.status === 'completed') {
    // 1. Update sync job
    await this.syncJobService.markCompleted(dto.jobId, dto.erpReference);

    // 2. Update order ERP reference (NEW — needs OrdersService)
    const job = await this.syncJobService.getJob(dto.jobId);
    if (job.postgresOrderId) {
      await this.ordersService.updateErpReference(
        job.postgresOrderId,
        dto.erpReference,
        dto.metadata?.erpDocumentId,
      );
    }
  }
}
```

**Validation Commands:**

```bash
pnpm turbo lint --filter=@apps/api --fix
pnpm turbo build --filter=@apps/api
pnpm turbo test --filter=@apps/api -- --testPathPattern=order-sync|agent-callback
pnpm turbo type-check
```

**Acceptance Criteria:**

- [ ] OrderErpSyncListener listens to order.created event
- [ ] OrderSyncProcessor sends order to agent
- [ ] AgentCallbackController updates orders table
- [ ] Full flow: order created → job → agent → callback → order updated
- [ ] Tests pass
- [ ] Build passes

---

#### Task 11.5: Full Validation Gate — ✅ passing

**No changes needed.**

---

#### Task 12: Dead Letter Queue Service — ✅ passing

**No changes needed.**

---

### Phase 7: Background Services (Tasks 13-16) — ✅ passing

**No changes needed.** All background services implemented.

---

### Phase 8: DevOps & Hardening (Tasks 17-22)

#### Task 17: Secrets Management — ✅ passing

**No changes needed.**

---

#### Tasks 18-22: DevOps Tasks — ❌ not started

**No changes needed to plan.** Proceed as originally planned after gaps are closed.

---

## Revised Task Count & Dependencies

### Total Tasks: 30 (23 original + 7 new)

| Phase         | Tasks      | Status                                     |
| ------------- | ---------- | ------------------------------------------ |
| 1: Foundation | 1, 2.1-2.7 | Task 1 ✅, Tasks 2.1-2.7 ❌ not started    |
| 2: Repos      | 3          | ✅ passing                                 |
| 3: Scaffold   | 4          | ✅ passing                                 |
| 4: Core       | 5-8        | ✅ passing                                 |
| 5: Ingest     | 9          | ✅ passing (needs refactor via 2.7)        |
| 6: Outbound   | 10-12      | Task 10 ✅, Task 11 ❌ BLOCKED, Task 12 ✅ |
| 7: Background | 13-16      | ✅ passing                                 |
| 8: Hardening  | 17-22      | Task 17 ✅, Tasks 18-22 ❌ not started     |

---

## Critical Path to Unblock Task 11

```
Task 2.1 (Orders Schema)
  ↓
Task 2.2 (Items Schema Updates)
  ↓
Task 2.5 (Business Entity Repositories)
  ↓
Task 2.6 (Orders Module)
  ↓
Task 11 (Order Sync Processor) — UNBLOCKED
  ↓
Task 11.5 (Full Validation)
  ↓
Continue to Tasks 18-22
```

**Estimated time to unblock:** 2-3 days (full-time)

---

## Spec Corrections Required

### Update `specs/sync-architecture.md`

**Line 131-144 (REQ-2 NOTE):**

```diff
- **NOTE:** `items`, `stock`, `warehouses` tables do NOT exist yet. They must be created as part of the sync implementation (or as a prerequisite Task 2 sub-task). These tables need `content_hash` and `last_synced_at` columns for deduplication.

+ **NOTE:** `items`, `stock`, `warehouses` tables ALREADY EXIST with `content_hash` and `last_synced_at` columns. However, additional ERP-specific fields are needed (see Tasks 2.2-2.4). The `orders` and `order_items` tables do NOT exist yet and must be created as a prerequisite (see Task 2.1).
```

**Add new section after REQ-2:**

```markdown
### REQ-2.5: Business Entity Repositories

**Goal:** Create repository abstractions for items, warehouses, stock, orders, order_items following the two-layer pattern.

**Pattern:**

1. Base repository in `packages/shared/src/database/repositories/<entity>/<entity>.repository.base.ts`
2. NestJS adapter in `apps/api/src/database/adapters/nestjs-<entity>.repository.ts`

**Benefits:**

- Type-safe query methods
- Centralized query logic
- Transaction support via `BaseRepository.transaction()`
- Error handling via `handleError()`
- Testability via mocking

**Acceptance Criteria:**

- [ ] 5 base repositories in `packages/shared/` extending `BaseRepository<TTable>`
- [ ] 5 NestJS adapters in `apps/api/` wrapping base + PinoLogger
- [ ] All repositories provided in `DatabaseModule`
- [ ] All query methods type-safe
- [ ] Transaction support tested
```

---

## Summary

### What Was Wrong

1. **Task 11 status:** Marked as "passing" but has no orders table to operate on
2. **Spec REQ-2 NOTE:** Says business tables don't exist, but they do
3. **Repository pattern:** Not applied to business entities (tech debt)
4. **Critical fields missing:** Items missing `erpId`, `priceExclVat`, `manageStock`

### What's Fixed

1. **7 new tasks added:** 2.1-2.7 to address all gaps
2. **Task 11 blocked:** Status changed to "blocked" until dependencies met
3. **Clear critical path:** Task 2.1 → 2.2 → 2.5 → 2.6 → Task 11
4. **Spec correction:** REQ-2 NOTE updated to reflect reality

### Next Steps

**For Ralph:**

1. Update `IMPLEMENTATION_PLAN.md` with Tasks 2.1-2.7
2. Set Task 11 status to "blocked"
3. Start implementing Task 2.1 (Orders Schema)
4. Continue through Task 2.2 → 2.5 → 2.6
5. Re-validate Task 11 after dependencies complete
6. Continue to Tasks 18-22

**Do NOT start Tasks 18-22 until Task 11 is unblocked and passing.**

---

**End of Refined Implementation Plan**
