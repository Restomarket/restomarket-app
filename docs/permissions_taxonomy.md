# Permissions Taxonomy & Granular Assignment: Restomarket B2B Marketplace

## Executive Summary

This document provides a comprehensive **Permissions Taxonomy** for the Restomarket B2B food marketplace platform, categorizing permissions by resources and actions with granular detail. It defines the complete permission structure and maps granular permissions to roles across three organizational domains: **Marketplace Operators**, **CHR Buyers** (Cafés, Hotels, Restaurants), and **Food Suppliers**.

---

## 1. Permission Structure & Naming Convention

### 1.1 Permission Pattern

All permissions follow the **`resource:action`** pattern with optional scope and conditions:

```
{resource}:{action}[:{scope}][?{condition}]
```

**Components**:

- **Resource**: The entity being accessed (e.g., `order`, `product`, `invoice`)
- **Action**: The operation being performed (e.g., `create`, `read`, `update`, `delete`, `approve`)
- **Scope** (optional): Visibility boundary (e.g., `own`, `team`, `business_unit`, `organization`, `platform`)
- **Condition** (optional): Attribute-based restrictions (e.g., `amount < $10,000`, `category == 'perishables'`)

**Examples**:

- `order:create` - Create new orders
- `order:approve:own` - Approve own orders only
- `order:approve?amount<5000` - Approve orders under $5,000
- `inventory:view:business_unit` - View inventory for assigned warehouse only
- `user:impersonate` - Impersonate users for support troubleshooting

---

## 2. Resource Taxonomy

### 2.1 Identity & Access Management Resources

| Resource        | Description                         | Sensitivity | Key Actions                                                                       |
| --------------- | ----------------------------------- | ----------- | --------------------------------------------------------------------------------- |
| `user`          | Platform user accounts              | Critical    | `create`, `read`, `update`, `delete`, `ban`, `impersonate`                        |
| `organization`  | Tenant organizations                | Critical    | `create`, `read`, `update`, `delete`, `validate`, `suspend`, `transfer-ownership` |
| `business_unit` | Sub-entities (locations, divisions) | High        | `create`, `read`, `update`, `delete`                                              |
| `member`        | Organization members                | High        | `create`, `read`, `update`, `delete`, `update-role`, `invite`                     |
| `role`          | Role definitions per tenant         | High        | `create`, `read`, `update`, `delete`, `assign`                                    |
| `permission`    | Granular permission grants          | High        | `view`, `manage`                                                                  |
| `invitation`    | Pending membership invitations      | Medium      | `create`, `cancel`, `read`, `resend`                                              |
| `api_key`       | Service account credentials         | Critical    | `create`, `read`, `revoke`, `rotate`                                              |

### 2.2 Commercial Resources

| Resource     | Description                 | Compliance Relevance      | Key Actions                                                          |
| ------------ | --------------------------- | ------------------------- | -------------------------------------------------------------------- |
| `product`    | Product catalog entries     | FDA labeling requirements | `create`, `read`, `update`, `delete`, `import`, `export`, `publish`  |
| `catalog`    | Curated product collections | Allergen declarations     | `create`, `read`, `update`, `delete`, `publish`, `manage-restricted` |
| `price_list` | Customer-specific pricing   | Contract compliance       | `create`, `read`, `update`, `delete`, `configure`                    |
| `contract`   | Procurement agreements      | Legal audit trails        | `create`, `read`, `update`, `delete`, `sign`, `renew`                |
| `promotion`  | Discount campaigns          | Financial reporting       | `create`, `read`, `update`, `delete`, `activate`, `schedule`         |
| `quote`      | Custom pricing requests     | Sales workflow            | `create`, `read`, `update`, `delete`, `approve`, `convert`           |

### 2.3 Transaction Resources

| Resource         | Description            | Workflow Integration     | Key Actions                                                                            |
| ---------------- | ---------------------- | ------------------------ | -------------------------------------------------------------------------------------- |
| `cart`           | Shopping carts         | Real-time inventory      | `create`, `read`, `update`, `delete`, `checkout`                                       |
| `order`          | Purchase orders        | Approval workflows       | `create`, `read`, `update`, `cancel`, `validate`, `approve`, `track`, `process-refund` |
| `purchase_order` | Formal PO documents    | Three-way matching       | `create`, `read`, `update`, `delete`, `generate`, `send`                               |
| `invoice`        | Billing documents      | Accounts payable         | `create`, `read`, `update`, `delete`, `generate`, `send`, `approve-payment`            |
| `payment`        | Payment transactions   | PCI-DSS compliance       | `create`, `read`, `process`, `reconcile`, `refund`                                     |
| `credit_note`    | Refund/adjustment docs | Financial reconciliation | `create`, `read`, `update`, `approve`, `process`                                       |

### 2.4 Supply Chain Resources

| Resource                 | Description        | FSMA 204 Requirements          | Key Actions                                                       |
| ------------------------ | ------------------ | ------------------------------ | ----------------------------------------------------------------- |
| `inventory`              | Stock levels       | Real-time traceability         | `view`, `update`, `manage-alerts`, `configure-alerts`, `adjust`   |
| `lot`                    | Batch/lot tracking | Critical tracking events (CTE) | `create`, `read`, `update`, `trace`, `link-shipment`              |
| `shipment`               | Delivery logistics | Temperature monitoring         | `create`, `read`, `update`, `track`, `confirm-delivery`           |
| `warehouse`              | Storage locations  | Sanitation controls            | `create`, `read`, `update`, `delete`, `manage-inventory`          |
| `supplier_certification` | Compliance docs    | Supplier verification          | `create`, `read`, `update`, `delete`, `upload`, `audit`, `verify` |
| `recall_notice`          | Product recalls    | Rapid response capability      | `create`, `read`, `initiate`, `notify`, `track-response`          |

### 2.5 Delivery & Logistics Resources

| Resource        | Description                | Key Actions                                       |
| --------------- | -------------------------- | ------------------------------------------------- |
| `delivery_slot` | Scheduled delivery windows | `create`, `read`, `update`, `delete`, `configure` |
| `delivery_cost` | Shipping rates by region   | `create`, `read`, `update`, `delete`, `manage`    |
| `delivery`      | Active deliveries          | `create`, `read`, `update`, `track`, `manage`     |

### 2.6 Financial Resources

| Resource         | Description            | Key Actions                                       |
| ---------------- | ---------------------- | ------------------------------------------------- |
| `payment_method` | Payment configurations | `create`, `read`, `configure`, `manage`, `delete` |
| `wallet`         | Digital wallet system  | `view`, `manage`, `topup`, `withdraw`             |
| `commission`     | Platform commissions   | `view`, `configure`, `calculate`, `manage`        |
| `billing`        | Platform billing       | `view`, `manage`, `configure`                     |
| `refund`         | Refund processing      | `create`, `approve`, `process`, `track`           |
| `credit_limit`   | Customer credit limits | `view`, `set`, `update`, `manage`                 |

### 2.7 Operational Resources

| Resource           | Description                 | Key Actions                                               |
| ------------------ | --------------------------- | --------------------------------------------------------- |
| `analytics_report` | Business intelligence       | `view`, `export`, `configure`, `schedule`                 |
| `audit_log`        | Compliance logging          | `view`, `export`, `purge` (admin only)                    |
| `message`          | Platform communications     | `create`, `read`, `send`, `delete`                        |
| `support_ticket`   | Customer service            | `create`, `read`, `update`, `manage`, `escalate`, `close` |
| `integration`      | External system connections | `create`, `read`, `configure`, `manage`, `delete`         |
| `recipe`           | Culinary recipes and tips   | `create`, `read`, `update`, `delete`, `publish`, `share`  |
| `wishlist`         | Saved product lists         | `create`, `read`, `update`, `delete`, `manage`            |

### 2.8 Compliance & Configuration Resources

| Resource            | Description            | Key Actions                                     |
| ------------------- | ---------------------- | ----------------------------------------------- |
| `haccp_plan`        | Food safety plans      | `create`, `read`, `update`, `view`, `implement` |
| `monitoring_record` | Safety monitoring logs | `create`, `read`, `view`                        |
| `allergen_alert`    | Allergen notifications | `create`, `read`, `manage`, `notify`            |
| `temperature_log`   | Temperature monitoring | `create`, `read`, `verify`, `alert`             |
| `food_safety_doc`   | Safety documentation   | `create`, `read`, `view`, `upload`              |
| `feature_flag`      | System feature toggles | `view`, `manage`, `configure`                   |
| `api_gateway`       | API management         | `view`, `manage`, `configure`, `monitor`        |
| `system`            | System configuration   | `view`, `configure`, `monitor`, `manage`        |

---

## 3. Action Taxonomy

### 3.1 Standard CRUD Actions

| Action   | Description                     | Typical Use   |
| -------- | ------------------------------- | ------------- |
| `create` | Create new resource instances   | All resources |
| `read`   | View resource details           | All resources |
| `update` | Modify existing resources       | All resources |
| `delete` | Remove resources (soft or hard) | All resources |

### 3.2 Workflow Actions

| Action     | Description                  | Typical Resources                     |
| ---------- | ---------------------------- | ------------------------------------- |
| `approve`  | Approve pending items        | `order`, `payment`, `refund`, `quote` |
| `validate` | Validate data/submissions    | `order`, `organization`, `user`       |
| `submit`   | Submit for review/processing | `order`, `cart`, `quote`              |
| `cancel`   | Cancel pending operations    | `order`, `invitation`, `shipment`     |
| `process`  | Execute business logic       | `payment`, `refund`, `order`          |
| `track`    | Monitor status/location      | `order`, `shipment`, `delivery`       |

### 3.3 Administrative Actions

| Action        | Description                 | Typical Resources                                 |
| ------------- | --------------------------- | ------------------------------------------------- |
| `manage`      | Full administrative control | `user`, `organization`, `billing`, `commission`   |
| `configure`   | Set up configurations       | `payment_method`, `delivery_cost`, `feature_flag` |
| `assign`      | Assign to users/roles       | `role`, `member`, `business_unit`                 |
| `invite`      | Send invitations            | `member`, `customer`                              |
| `ban`         | Suspend access              | `user`                                            |
| `suspend`     | Temporarily disable         | `organization`, `supplier`                        |
| `impersonate` | Act as another user         | `user` (support only)                             |

### 3.4 Data Operations

| Action    | Description             | Typical Resources                     |
| --------- | ----------------------- | ------------------------------------- |
| `import`  | Bulk data import        | `product`, `inventory`                |
| `export`  | Data extraction         | `product`, `report`, `audit_log`      |
| `publish` | Make publicly available | `product`, `catalog`, `recipe`        |
| `trace`   | Follow supply chain     | `lot`, `shipment`                     |
| `audit`   | Compliance review       | `supplier_certification`, `audit_log` |

### 3.5 Communication Actions

| Action     | Description                  | Typical Resources                          |
| ---------- | ---------------------------- | ------------------------------------------ |
| `send`     | Send communications          | `message`, `invoice`, `purchase_order`     |
| `notify`   | Trigger notifications        | `recall_notice`, `allergen_alert`, `order` |
| `escalate` | Escalate to higher authority | `support_ticket`, `approval`               |
| `share`    | Share with others            | `recipe`, `wishlist`                       |

---

## 4. Granular Permission Assignment by Organization Type

### 4.1 Marketplace Operator Permissions

#### 4.1.1 SUPER_ADMIN Role

**Description**: Full platform control, emergency access, audit oversight

**Permissions**: `*:*` (all resources, all actions)

**Constraints**:

- MFA required
- All actions logged to immutable storage
- Cannot delete own account

#### 4.1.2 ADMIN_OPERATIONS Role

**Description**: Daily platform management, supplier/CHR onboarding, dispute resolution

| Resource         | Granted Actions                                   |
| ---------------- | ------------------------------------------------- |
| `user`           | `create`, `read`, `update`, `ban`                 |
| `organization`   | `create`, `read`, `update`, `validate`, `suspend` |
| `supplier`       | `read`, `update`, `validate`, `suspend`           |
| `category`       | `create`, `read`, `update`, `delete`              |
| `configuration`  | `manage`                                          |
| `analytics`      | `view`, `export`                                  |
| `support_ticket` | `manage`, `escalate`                              |
| `order`          | `view`, `intervene`                               |

**Constraints**:

- Cannot modify billing settings
- Cannot access raw payment data

#### 4.1.3 ADMIN_FINANCE Role

**Description**: Commission management, invoicing, payout processing

| Resource       | Granted Actions                    |
| -------------- | ---------------------------------- |
| `billing`      | `manage`                           |
| `commission`   | `configure`, `calculate`, `manage` |
| `invoice`      | `view`, `manage`, `generate`       |
| `refund`       | `approve`, `process`               |
| `payout`       | `process`                          |
| `analytics`    | `view:financial`                   |
| `user`         | `read`                             |
| `organization` | `read`, `suspend:financial`        |

**Constraints**:

- Cannot modify product data
- Cannot access customer PII beyond billing context

#### 4.1.4 ADMIN_COMPLIANCE Role

**Description**: FSMA/HACCP oversight, certification verification, recall management

| Resource                 | Granted Actions                  |
| ------------------------ | -------------------------------- |
| `supplier_certification` | `audit`, `verify`, `view`        |
| `recall_notice`          | `initiate`, `track-response`     |
| `audit_log`              | `view`, `export`                 |
| `supplier`               | `verify`, `audit`                |
| `lot`                    | `trace`, `view`                  |
| `haccp_plan`             | `view`, `audit`                  |
| `monitoring_record`      | `view`                           |
| `organization`           | `validate`, `suspend:compliance` |
| `user`                   | `read`                           |

**Constraints**:

- Read-only on commercial transactions
- Cannot modify financial settings

#### 4.1.5 ADMIN_SUPPORT Role

**Description**: Customer service, technical troubleshooting, training

| Resource         | Granted Actions                |
| ---------------- | ------------------------------ |
| `support_ticket` | `manage`, `escalate`, `close`  |
| `user`           | `read`, `impersonate`          |
| `order`          | `view`, `track`                |
| `message`        | `send`, `read`                 |
| `refund`         | `approve:limited` (up to $500) |
| `organization`   | `read`                         |
| `product`        | `read`                         |

**Constraints**:

- Cannot approve refunds > $500
- Cannot modify supplier catalogs

#### 4.1.6 ADMIN_PRODUCT Role

**Description**: Feature releases, system configuration, integration management

| Resource        | Granted Actions                      |
| --------------- | ------------------------------------ |
| `feature_flag`  | `manage`, `configure`                |
| `integration`   | `configure`, `manage`                |
| `api_gateway`   | `manage`, `configure`                |
| `system`        | `monitor`, `configure`               |
| `category`      | `create`, `read`, `update`, `delete` |
| `configuration` | `manage`                             |

**Constraints**:

- Cannot access customer data
- Cannot modify financial transactions

---

### 4.2 CHR Organization Permissions

#### 4.2.1 CHR_OWNER Role

**Description**: Strategic oversight, financial ultimate authority, contract negotiation

**Approval Authority**: Unlimited

**Scope**: All business units

| Resource          | Granted Actions                                                      |
| ----------------- | -------------------------------------------------------------------- |
| `organization`    | `update`, `delete`, `transfer-ownership`, `manage-billing`           |
| `business_unit`   | `create`, `read`, `update`, `delete`                                 |
| `member`          | `create`, `read`, `update`, `delete`, `update-role`, `invite`        |
| `invitation`      | `create`, `cancel`, `read`                                           |
| `product`         | `read`                                                               |
| `catalog`         | `view`, `save-favorites`, `manage-restricted`                        |
| `cart`            | `create`, `read`, `update`, `delete`                                 |
| `order`           | `create`, `read`, `update`, `cancel`, `validate`, `approve`, `track` |
| `purchase_order`  | `generate`, `send`                                                   |
| `inventory`       | `view`, `update`, `configure-alerts`                                 |
| `invoice`         | `view`, `approve-payment`                                            |
| `payment_method`  | `configure`, `manage`                                                |
| `credit_limit`    | `view`                                                               |
| `wallet`          | `manage`, `topup`, `withdraw`                                        |
| `report`          | `view`, `export`, `configure`                                        |
| `recipe`          | `create`, `read`, `update`, `delete`, `share`                        |
| `wishlist`        | `manage`                                                             |
| `authorization`   | `manage`, `configure-thresholds`                                     |
| `multi_store`     | `consolidate-orders`, `switch-context`, `manage-managers`            |
| `food_safety_doc` | `view`                                                               |
| `allergen_alert`  | `manage`                                                             |
| `temperature_log` | `verify`                                                             |

#### 4.2.2 CHR_MANAGER Role

**Description**: Operational management, staff supervision, budget allocation

**Approval Authority**: Up to $10,000/order

**Scope**: Assigned business units

| Resource          | Granted Actions                                                              |
| ----------------- | ---------------------------------------------------------------------------- |
| `member`          | `create`, `read`, `update`, `delete`, `invite`                               |
| `invitation`      | `create`, `cancel`, `read`                                                   |
| `business_unit`   | `create:limited`, `read`, `update`                                           |
| `product`         | `read`                                                                       |
| `catalog`         | `view`, `save-favorites`, `manage-restricted`                                |
| `cart`            | `create`, `read`, `update`, `delete`                                         |
| `order`           | `create`, `read`, `update`, `cancel`, `validate`, `approve:limited`, `track` |
| `purchase_order`  | `generate`                                                                   |
| `inventory`       | `view`, `update`, `configure-alerts`                                         |
| `invoice`         | `view`, `approve-payment:limited`                                            |
| `payment_method`  | `configure:limited`                                                          |
| `credit_limit`    | `view`                                                                       |
| `report`          | `view`, `export`, `configure:own`                                            |
| `recipe`          | `create`, `read`, `update`, `delete`, `share`                                |
| `wishlist`        | `manage`                                                                     |
| `authorization`   | `manage`, `configure-thresholds`                                             |
| `multi_store`     | `consolidate-orders`, `switch-context`                                       |
| `food_safety_doc` | `view`                                                                       |
| `allergen_alert`  | `manage`                                                                     |
| `temperature_log` | `verify`                                                                     |

**Constraints**:

- Cannot assign Owner role
- Payment approval up to $10,000
- Cannot add new payment methods, only select existing

#### 4.2.3 HEAD_CHEF Role

**Description**: Menu planning, quality control, inventory management

**Approval Authority**: Up to $5,000/order (ingredients only)

**Scope**: Assigned kitchen

| Resource          | Granted Actions                                          |
| ----------------- | -------------------------------------------------------- |
| `member`          | `read`                                                   |
| `product`         | `read`                                                   |
| `catalog`         | `view`, `save-favorites`, `manage-restricted`            |
| `cart`            | `create`, `read`, `update`, `delete`                     |
| `order`           | `create`, `read`, `update`, `validate`, `cancel:limited` |
| `purchase_order`  | `generate`                                               |
| `inventory`       | `view`, `update:consumables`, `configure-alerts`         |
| `report`          | `view:limited`                                           |
| `recipe`          | `create`, `read`, `update`, `delete`, `share`            |
| `wishlist`        | `manage`                                                 |
| `food_safety_doc` | `view`                                                   |
| `allergen_alert`  | `manage`                                                 |
| `temperature_log` | `verify`                                                 |

**Constraints**:

- Can only cancel orders not yet processed
- Inventory updates limited to consumables, not equipment
- Order approval limited to $5,000 and ingredients only

#### 4.2.4 PROCUREMENT_MANAGER Role

**Description**: Vendor selection, price negotiation, purchase orders

**Approval Authority**: Up to $25,000/order

**Scope**: Assigned categories

| Resource          | Granted Actions                                                  |
| ----------------- | ---------------------------------------------------------------- |
| `member`          | `read`                                                           |
| `product`         | `read`                                                           |
| `catalog`         | `view`, `save-favorites`, `manage-restricted`                    |
| `cart`            | `create`, `read`, `update`, `delete`                             |
| `order`           | `create`, `read`, `update`, `cancel:limited`, `approve`, `track` |
| `purchase_order`  | `generate`, `send`                                               |
| `inventory`       | `view`, `update:limited`, `configure-alerts`                     |
| `invoice`         | `view`                                                           |
| `credit_limit`    | `view`                                                           |
| `report`          | `view`, `export`, `configure:own`                                |
| `recipe`          | `read`, `share`                                                  |
| `wishlist`        | `manage`                                                         |
| `multi_store`     | `consolidate-orders`, `switch-context`                           |
| `food_safety_doc` | `view`                                                           |

**Constraints**:

- Can only cancel orders not yet processed
- Inventory updates limited to assigned categories

#### 4.2.5 ACCOUNTANT Role

**Description**: Invoice processing, payment authorization, financial reporting

**Approval Authority**: Payment approval up to $50,000

**Scope**: Financial data only

| Resource         | Granted Actions                       |
| ---------------- | ------------------------------------- |
| `member`         | `read`                                |
| `product`        | `read`                                |
| `catalog`        | `view`, `save-favorites`              |
| `order`          | `read`, `validate:financial`, `track` |
| `purchase_order` | `generate`                            |
| `inventory`      | `view`                                |
| `invoice`        | `view`, `approve-payment`             |
| `payment_method` | `configure`, `manage`                 |
| `credit_limit`   | `view`                                |
| `wallet`         | `view`, `manage`                      |
| `report`         | `view`, `export`, `configure:own`     |
| `integration`    | `view:erp`                            |

**Constraints**:

- Cannot create or cancel orders
- Cannot update inventory

#### 4.2.6 STAFF_OPERATOR Role

**Description**: Daily ordering, receiving, inventory updates

**Approval Authority**: Submit only (no approval)

**Scope**: Assigned location

| Resource          | Granted Actions                      |
| ----------------- | ------------------------------------ |
| `member`          | `read`                               |
| `product`         | `read`                               |
| `catalog`         | `view`, `save-favorites`             |
| `cart`            | `create`, `read`, `update`, `delete` |
| `order`           | `submit`, `read`, `track`            |
| `inventory`       | `view`, `update:basic`               |
| `report`          | `view:limited`                       |
| `recipe`          | `read`                               |
| `wishlist`        | `manage`                             |
| `food_safety_doc` | `view`                               |
| `temperature_log` | `verify`                             |

**Constraints**:

- Cannot approve or cancel orders
- Limited reporting access

---

### 4.3 Supplier Organization Permissions

#### 4.3.1 SUPPLIER_OWNER Role

**Description**: Business strategy, major account management, platform relationship

**Scope**: All locations, all functions

| Resource                 | Granted Actions                                                                         |
| ------------------------ | --------------------------------------------------------------------------------------- |
| `organization`           | `update`, `delete`, `transfer-ownership`, `configure-delivery`, `manage-certifications` |
| `member`                 | `create`, `read`, `update`, `delete`, `update-role`, `invite`                           |
| `invitation`             | `create`, `cancel`, `read`                                                              |
| `store`                  | `create`, `read`, `update`, `delete`, `manage-inventory`                                |
| `product`                | `create`, `read`, `update`, `delete`, `import`, `export`, `publish`                     |
| `catalog`                | `publish`, `manage-pricing`                                                             |
| `inventory`              | `view`, `update`, `manage-alerts`                                                       |
| `lot`                    | `create`, `read`, `trace`, `link-shipment`                                              |
| `recall_notice`          | `initiate`, `notify`, `track-response`                                                  |
| `order`                  | `view`, `read`, `update`, `process`, `cancel:limited`, `process-refund`                 |
| `promotion`              | `create`, `read`, `update`, `delete`, `activate`                                        |
| `delivery_slot`          | `create`, `read`, `update`, `delete`                                                    |
| `customer`               | `create`, `read`, `update`, `delete`, `set-credit-limit`, `onboard`                     |
| `payment_method`         | `configure`, `manage`                                                                   |
| `invoice`                | `generate`, `send`                                                                      |
| `payment`                | `reconcile`                                                                             |
| `report`                 | `view`, `export`, `configure`                                                           |
| `recipe`                 | `create`, `read`, `update`, `delete`, `publish`                                         |
| `supplier_certification` | `create`, `read`, `update`, `upload`                                                    |
| `haccp_plan`             | `create`, `read`, `update`, `implement`                                                 |

#### 4.3.2 SALES_MANAGER Role

**Description**: Customer acquisition, pricing strategy, contract negotiation

**Scope**: Customer-facing operations

| Resource    | Granted Actions                                                |
| ----------- | -------------------------------------------------------------- |
| `member`    | `read`                                                         |
| `product`   | `create`, `read`, `update`                                     |
| `catalog`   | `publish`, `manage-pricing`                                    |
| `inventory` | `view`                                                         |
| `order`     | `view`, `read`, `update`, `cancel:limited`                     |
| `promotion` | `create`, `read`, `update`, `delete`, `activate`               |
| `customer`  | `create`, `read`, `update`, `onboard`, `update-credit:limited` |
| `report`    | `view:sales`, `export`                                         |
| `recipe`    | `create`, `read`, `update`, `delete`, `publish`                |

**Constraints**:

- Product deletion requires soft delete only
- Can only cancel orders not yet shipped
- Credit limit updates require approval

#### 4.3.3 INVENTORY_MANAGER Role

**Description**: Stock control, lot tracking, warehouse operations

**Scope**: All warehouses

| Resource        | Granted Actions                            |
| --------------- | ------------------------------------------ |
| `member`        | `read`                                     |
| `product`       | `read`, `update:stock`                     |
| `inventory`     | `view`, `update`, `manage-alerts`          |
| `lot`           | `create`, `read`, `trace`, `link-shipment` |
| `recall_notice` | `initiate:with-qa`, `track-response`       |
| `order`         | `view`, `read`, `update:status`            |
| `warehouse`     | `read`, `manage-inventory`                 |
| `report`        | `view:inventory`, `export`                 |
| `integration`   | `configure:erp`                            |

**Constraints**:

- Recall initiation requires QA concurrence
- Product updates limited to stock quantities

#### 4.3.4 WAREHOUSE_MANAGER Role

**Description**: Specific facility operations, picking, shipping

**Scope**: Assigned warehouse

| Resource          | Granted Actions                              |
| ----------------- | -------------------------------------------- |
| `member`          | `read`                                       |
| `product`         | `read`                                       |
| `inventory`       | `view:assigned`, `update:assigned`           |
| `lot`             | `create:receive`, `read`, `trace`            |
| `order`           | `view`, `read`, `update:picking`             |
| `shipment`        | `create`, `read`, `update`, `track`          |
| `warehouse`       | `read:assigned`, `manage-inventory:assigned` |
| `report`          | `view:warehouse`                             |
| `temperature_log` | `create`, `verify`                           |

**Constraints**:

- View and update only assigned warehouses
- Lot creation limited to receive/put-away operations

#### 4.3.5 PRODUCTION_MANAGER Role

**Description**: Manufacturing, batch control, quality testing

**Scope**: Production facilities

| Resource            | Granted Actions                                       |
| ------------------- | ----------------------------------------------------- |
| `member`            | `read`                                                |
| `product`           | `create:ingredients`, `read`, `update:specifications` |
| `inventory`         | `view`, `update:production`                           |
| `lot`               | `create`, `read`, `trace`                             |
| `recall_notice`     | `initiate:with-qa`                                    |
| `order`             | `view:production`, `update:scheduling`                |
| `haccp_plan`        | `read`, `implement`                                   |
| `monitoring_record` | `create`, `read`                                      |
| `report`            | `view:production`                                     |

**Constraints**:

- Product creation limited to ingredient/specification updates
- Inventory updates for raw material consumption only
- Recall requires QA concurrence

#### 4.3.6 LOGISTICS_COORDINATOR Role

**Description**: Route planning, delivery scheduling, carrier management

**Scope**: Transportation network

| Resource        | Granted Actions                                         |
| --------------- | ------------------------------------------------------- |
| `member`        | `read`                                                  |
| `inventory`     | `view:logistics`                                        |
| `lot`           | `read`, `trace`                                         |
| `order`         | `view`, `read`, `update:delivery`                       |
| `shipment`      | `create`, `read`, `update`, `track`, `confirm-delivery` |
| `delivery_slot` | `create`, `read`, `update`, `delete`                    |
| `warehouse`     | `read`                                                  |
| `report`        | `view:logistics`, `export`                              |
| `integration`   | `configure:logistics`                                   |

**Constraints**:

- Order updates limited to delivery status
- View inventory for logistics planning only

#### 4.3.7 FINANCE_MANAGER Role

**Description**: Invoicing, payment processing, credit management

**Scope**: Financial operations

| Resource                 | Granted Actions            |
| ------------------------ | -------------------------- |
| `member`                 | `read`                     |
| `catalog`                | `view:pricing`             |
| `order`                  | `view`, `read`             |
| `customer`               | `view`, `update-credit`    |
| `invoice`                | `generate`, `send`, `view` |
| `payment`                | `reconcile`, `process`     |
| `report`                 | `view:financial`, `export` |
| `integration`            | `configure:accounting`     |
| `supplier_certification` | `upload:tax`               |

**Constraints**:

- Cannot modify product data
- View pricing, suggest changes only

#### 4.3.8 QUALITY_ASSURANCE Role

**Description**: Certification management, supplier audits, compliance documentation

**Scope**: Quality systems

| Resource                 | Granted Actions                                |
| ------------------------ | ---------------------------------------------- |
| `member`                 | `read`                                         |
| `product`                | `update:labeling`, `update:allergen`           |
| `catalog`                | `publish:compliance`                           |
| `inventory`              | `view`                                         |
| `lot`                    | `create`, `read`, `trace`                      |
| `recall_notice`          | `initiate`, `notify`, `track-response`         |
| `order`                  | `view`                                         |
| `supplier_certification` | `create`, `read`, `update`, `upload`, `verify` |
| `haccp_plan`             | `create`, `read`, `update`, `audit`            |
| `monitoring_record`      | `create`, `read`                               |
| `food_safety_doc`        | `create`, `read`, `upload`                     |
| `report`                 | `view:compliance`, `export`                    |

**Constraints**:

- Product updates limited to labeling/allergen information
- Catalog publishing requires compliance verification

#### 4.3.9 CUSTOMER_REP Role

**Description**: Order support, issue resolution, relationship management

**Scope**: Assigned accounts

| Resource         | Granted Actions                                         |
| ---------------- | ------------------------------------------------------- |
| `member`         | `read`                                                  |
| `product`        | `read`                                                  |
| `inventory`      | `view:assigned-accounts`                                |
| `order`          | `view:assigned`, `read`, `update:status`                |
| `customer`       | `view:assigned`, `update:basic`, `onboard:collect-docs` |
| `support_ticket` | `create`, `read`, `update`                              |
| `report`         | `view:assigned-accounts`                                |

**Constraints**:

- View and update only assigned customer accounts
- Order updates limited to status, not processing
- Customer onboarding limited to collecting documents

---

## 5. Permission Scope Definitions

### 5.1 Scope Levels

| Scope           | Description                 | Example                                                                |
| --------------- | --------------------------- | ---------------------------------------------------------------------- |
| `own`           | User's own records only     | `order:view:own` - View only orders created by the user                |
| `team`          | User's team/department      | `report:view:team` - View team performance reports                     |
| `business_unit` | Assigned location/warehouse | `inventory:view:business_unit` - View inventory for assigned warehouse |
| `organization`  | Entire organization/tenant  | `order:view:organization` - View all organization orders               |
| `platform`      | Cross-tenant (admin only)   | `analytics:view:platform` - View platform-wide analytics               |

### 5.2 Conditional Attributes

| Attribute Type  | Description             | Example                                                                  |
| --------------- | ----------------------- | ------------------------------------------------------------------------ |
| **Monetary**    | Value-based thresholds  | `order:approve?amount<10000` - Approve orders under $10,000              |
| **Temporal**    | Time-based restrictions | `order:approve?time=business_hours` - Approve only during business hours |
| **Categorical** | Product/resource type   | `order:approve?category=perishables` - Approve only perishable orders    |
| **Geographic**  | Location-based          | `inventory:view?region=assigned` - View inventory in assigned region     |
| **Relational**  | Relationship-based      | `customer:view?assigned_rep=user_id` - View assigned customers only      |
| **Status**      | Resource state          | `order:cancel?status=pending` - Cancel only pending orders               |

---

## 6. Permission Inheritance & Hierarchy

### 6.1 Role Inheritance Rules

**Principle**: Higher-level roles inherit all permissions from lower-level roles, plus additional permissions.

#### CHR Organization Hierarchy

```
CHR_OWNER (Full Access)
  ├── CHR_MANAGER (Operational Control)
  │     ├── PROCUREMENT_MANAGER (Procurement Focus)
  │     └── HEAD_CHEF (Kitchen Operations)
  └── ACCOUNTANT (Financial Operations)
        └── STAFF_OPERATOR (Basic Operations)
```

**Inheritance Example**:

- `CHR_MANAGER` inherits all permissions from `STAFF_OPERATOR`
- `CHR_OWNER` inherits all permissions from `CHR_MANAGER` + additional owner-specific permissions

#### Supplier Organization Hierarchy

```
SUPPLIER_OWNER (Full Access)
  ├── SALES_MANAGER (Customer-Facing)
  │     └── CUSTOMER_REP (Account Management)
  ├── INVENTORY_MANAGER (Stock Control)
  │     └── WAREHOUSE_MANAGER (Facility Operations)
  ├── PRODUCTION_MANAGER (Manufacturing)
  ├── LOGISTICS_COORDINATOR (Delivery)
  ├── FINANCE_MANAGER (Financial)
  └── QUALITY_ASSURANCE (Compliance)
```

### 6.2 Permission Overrides

**Principle**: Specific permissions can be restricted even if inherited, using conditions or explicit denials.

**Example**:

- `CHR_MANAGER` inherits `order:approve` from `CHR_OWNER`
- But `CHR_MANAGER` has condition `order:approve?amount<10000`
- While `CHR_OWNER` has unlimited approval authority

---

## 7. Compliance-Driven Permissions

### 7.1 FSMA 204 Food Traceability

| Requirement                        | Permission                                                                       | Responsible Roles                                        |
| ---------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------- |
| **Critical Tracking Events (CTE)** | `lot:create`, `lot:trace`, `lot:update`                                          | Inventory Manager, QA, Supplier Owner, Warehouse Manager |
| **Supplier Verification**          | `supplier_certification:audit`, `supplier_certification:verify`                  | Compliance Admin, QA                                     |
| **Preventive Controls**            | `haccp_plan:view`, `haccp_plan:implement`, `monitoring_record:create`            | Production Manager, QA                                   |
| **Recall Management**              | `recall_notice:initiate`, `recall_notice:notify`, `recall_notice:track-response` | QA, Supplier Owner, Compliance Admin                     |
| **Audit Trail**                    | All `lot` and `shipment` actions automatically logged                            | System-enforced for all roles                            |

### 7.2 Financial Compliance (SOX, PCI-DSS)

| Control                          | Permission Separation                                                      | Roles                                  |
| -------------------------------- | -------------------------------------------------------------------------- | -------------------------------------- |
| **Separation of Duties**         | `order:create` → `order:approve` → `payment:process` → `payment:reconcile` | Staff → Manager → Accountant → Finance |
| **Privileged Access Monitoring** | `refund:approve`, `commission:configure` require secondary approval        | Finance Admin + Ops Admin              |
| **Immutable Audit Logs**         | All permission changes logged to tamper-proof storage                      | System-enforced                        |
| **Access Recertification**       | Quarterly review of admin roles; annual for operational                    | Platform Admin                         |

---

## 8. Implementation Guidelines

### 8.1 Permission Naming Best Practices

1. **Use lowercase with underscores**: `order:approve`, `inventory:view`
2. **Resource first, action second**: `{resource}:{action}`
3. **Be specific**: `order:approve` not `order:manage`
4. **Use standard actions**: Prefer `create`, `read`, `update`, `delete` over custom verbs
5. **Add scope when needed**: `order:view:own` vs `order:view:organization`
6. **Document conditions**: `order:approve?amount<10000` with clear threshold

### 8.2 Permission Evaluation Logic

```typescript
function hasPermission(
  user: User,
  resource: string,
  action: string,
  scope?: string,
  conditions?: Record<string, any>,
): boolean {
  // 1. Get user's roles in current organization
  const roles = getUserRoles(user, currentOrganization);

  // 2. Resolve role hierarchy (include inherited roles)
  const allRoles = resolveRoleHierarchy(roles);

  // 3. Get all permissions for these roles
  const permissions = getRolePermissions(allRoles);

  // 4. Check if any permission matches
  const matchingPermission = permissions.find(
    p =>
      p.resource === resource &&
      p.action === action &&
      (!scope || p.scope === scope || p.scope === 'organization'),
  );

  if (!matchingPermission) return false;

  // 5. Evaluate ABAC conditions if present
  if (conditions && matchingPermission.conditions) {
    return evaluateConditions(matchingPermission.conditions, conditions);
  }

  return true;
}
```

### 8.3 Audit Logging Requirements

**All permission checks must be logged with**:

- User ID and organization ID
- Requested resource and action
- Decision (allowed/denied)
- Timestamp and IP address
- Context (e.g., order amount, product category)

**Example Audit Log Entry**:

```json
{
  "timestamp": "2026-02-06T10:15:30Z",
  "user_id": "user-123",
  "organization_id": "chr-456",
  "resource": "order",
  "action": "approve",
  "decision": "allowed",
  "context": {
    "order_id": "order-789",
    "amount": 8500,
    "role": "chr_manager"
  },
  "ip_address": "192.168.1.100"
}
```

---

## 9. Permission Matrix Summary

### 9.1 Quick Reference: Marketplace Operator

| Permission Category     | Super Admin | Ops Admin  | Finance | Compliance |  Support   | Product |
| ----------------------- | :---------: | :--------: | :-----: | :--------: | :--------: | :-----: |
| User Management         |   ✅ Full   | ✅ Limited |   ❌    |     ❌     |  ✅ Read   |   ❌    |
| Organization Management |   ✅ Full   | ✅ Limited |   ❌    |  ✅ Audit  |     ❌     |   ❌    |
| Financial Operations    |   ✅ Full   |     ❌     | ✅ Full |  ✅ View   | ⚠️ Limited |   ❌    |
| Compliance & Safety     |   ✅ Full   |     ❌     |   ❌    |  ✅ Full   |     ❌     |   ❌    |
| System Configuration    |   ✅ Full   |     ❌     |   ❌    |     ❌     |     ❌     | ✅ Full |

### 9.2 Quick Reference: CHR Organizations

| Permission Category    | Owner | Manager | Head Chef | Procurement | Accountant | Staff |
| ---------------------- | :---: | :-----: | :-------: | :---------: | :--------: | :---: |
| Organization Settings  |  ✅   |   ⚠️    |    ❌     |     ❌      |     ⚠️     |  ❌   |
| User Management        |  ✅   |   ✅    |    ❌     |     ❌      |     ❌     |  ❌   |
| Ordering & Procurement |  ✅   |   ✅    |    ⚠️     |     ✅      |     ❌     |  ⚠️   |
| Inventory Management   |  ✅   |   ✅    |    ✅     |     ⚠️      |     ❌     |  ⚠️   |
| Financial Operations   |  ✅   |   ⚠️    |    ❌     |     ⚠️      |     ✅     |  ❌   |
| Reporting & Analytics  |  ✅   |   ✅    |    ⚠️     |     ✅      |     ✅     |  ⚠️   |

### 9.3 Quick Reference: Supplier Organizations

| Permission Category   | Owner | Sales Mgr | Inventory Mgr | WH Mgr | Production | Logistics | Finance | QA  | Cust Rep |
| --------------------- | :---: | :-------: | :-----------: | :----: | :--------: | :-------: | :-----: | :-: | :------: |
| Organization Settings |  ✅   |    ❌     |      ❌       |   ❌   |     ❌     |    ⚠️     |   ❌    | ⚠️  |    ❌    |
| Product Catalog       |  ✅   |    ✅     |      ⚠️       |   ❌   |     ⚠️     |    ❌     |   ❌    | ⚠️  |    ❌    |
| Inventory & Lots      |  ✅   |    ⚠️     |      ✅       |   ⚠️   |     ⚠️     |    ⚠️     |   ❌    | ✅  |    ⚠️    |
| Order Management      |  ✅   |    ⚠️     |      ✅       |   ✅   |     ⚠️     |    ✅     |   ⚠️    | ⚠️  |    ⚠️    |
| Customer Management   |  ✅   |    ✅     |      ❌       |   ❌   |     ❌     |    ❌     |   ✅    | ❌  |    ⚠️    |
| Financial Operations  |  ✅   |    ⚠️     |      ❌       |   ❌   |     ❌     |    ❌     |   ✅    | ❌  |    ❌    |
| Compliance & Safety   |  ✅   |    ❌     |      ⚠️       |   ⚠️   |     ⚠️     |    ❌     |   ❌    | ✅  |    ❌    |

**Legend**:

- ✅ Full Access
- ⚠️ Limited/Conditional Access
- ❌ No Access

---

## Glossary

| Term            | Definition                                                                                               |
| --------------- | -------------------------------------------------------------------------------------------------------- |
| **Permission**  | A granular authorization to perform a specific action on a specific resource                             |
| **Resource**    | An entity or object in the system (e.g., order, product, user)                                           |
| **Action**      | An operation that can be performed on a resource (e.g., create, read, update, delete)                    |
| **Scope**       | The visibility boundary for a permission (e.g., own, team, organization, platform)                       |
| **Condition**   | Attribute-based restriction on a permission (e.g., amount < $10,000)                                     |
| **Role**        | A collection of permissions assigned to users based on their job function                                |
| **Inheritance** | The principle where higher-level roles automatically include lower-level permissions                     |
| **ABAC**        | Attribute-Based Access Control - Access control based on attributes of users, resources, and environment |
| **RBAC**        | Role-Based Access Control - Access control paradigm where permissions are assigned to roles              |
| **Granularity** | The level of detail in permission definitions (fine-grained vs coarse-grained)                           |

---

**Document Version**: 1.0  
**Last Updated**: 2026-02-06  
**Author**: Restomarket Platform Team  
**Classification**: Internal - Implementation Reference
