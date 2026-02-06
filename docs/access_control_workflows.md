# Access Control Rules & Approval Workflows: Restomarket B2B Marketplace

## Executive Summary

This document provides comprehensive **Access Control Rules** and **Approval Workflows** for the Restomarket B2B food marketplace platform. It specifies RBAC mappings (role-to-permission), scopes (own/team/business_unit/organization/platform), attribute-based conditions (thresholds, categories, locations), and multi-tier approval processes for least-privilege access control. This document synthesizes information from the complete RBAC architecture to provide actionable implementation guidance for access control enforcement.

---

## 1. Access Control Principles

### 1.1 Least-Privilege Framework

**Core Principle**: Grant the minimum permissions necessary for users to perform their job functions, nothing more.

| Principle                 | Description                                            | Implementation                                             |
| ------------------------- | ------------------------------------------------------ | ---------------------------------------------------------- |
| **Default Deny**          | All actions are denied unless explicitly permitted     | Permission checks return `false` by default                |
| **Explicit Grant**        | Permissions must be explicitly assigned to roles       | No implicit permissions                                    |
| **Scope Restriction**     | Limit data visibility to necessary boundaries          | `own`, `team`, `business_unit`, `organization`, `platform` |
| **Condition Enforcement** | Apply attribute-based restrictions                     | Monetary thresholds, category filters, location bounds     |
| **Separation of Duties**  | Prevent single-user fraud through multi-step processes | Order creation → Approval → Payment → Reconciliation       |
| **Audit Everything**      | Log all permission checks and decisions                | Immutable audit logs with user attribution                 |

### 1.2 Three-Dimensional Access Control Model

```
┌─────────────────────────────────────────────────────────────┐
│                  RESOURCE (Horizontal)                       │
│  What: Users, Products, Orders, Invoices, Reports, etc.     │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                  ACTION (Vertical)                           │
│  How: Create, Read, Update, Delete, Approve, Export, etc.   │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                  SCOPE (Depth)                               │
│  Where: Own, Team, Business Unit, Organization, Platform    │
└─────────────────────────────────────────────────────────────┘
```

**Example**: A **Head Chef** can **UPDATE** (vertical) **ORDERS** (horizontal) but only for **OWN RECORDS** (depth) up to **$5,000** (conditional attribute) and **INGREDIENTS ONLY** (categorical condition).

---

## 2. RBAC Mapping: Role-to-Permission Matrix

### 2.1 Marketplace Operator Permissions

#### SUPER_ADMIN

**Access Scope**: Platform-wide (cross-tenant)

| Resource            | Granted Permissions | Conditions                                            |
| ------------------- | ------------------- | ----------------------------------------------------- |
| `*` (All Resources) | `*` (All Actions)   | MFA required; All actions logged to immutable storage |

**Special Constraints**:

- Cannot delete own account
- Requires secondary approval for critical actions (e.g., organization deletion, platform-wide recalls)
- Break-glass protocol for emergency access

---

#### ADMIN_OPERATIONS

**Access Scope**: Platform-wide with financial restrictions

| Resource         | Granted Permissions                               | Scope    | Conditions                                     |
| ---------------- | ------------------------------------------------- | -------- | ---------------------------------------------- |
| `user`           | `create`, `read`, `update`, `ban`                 | Platform | Cannot delete users                            |
| `organization`   | `create`, `read`, `update`, `validate`, `suspend` | Platform | Cannot delete organizations                    |
| `supplier`       | `read`, `update`, `validate`, `suspend`           | Platform | Cannot create/delete suppliers                 |
| `category`       | `create`, `read`, `update`, `delete`              | Platform | -                                              |
| `configuration`  | `manage`                                          | Platform | -                                              |
| `analytics`      | `view`, `export`                                  | Platform | -                                              |
| `support_ticket` | `manage`, `escalate`                              | Platform | -                                              |
| `order`          | `view`, `intervene`                               | Platform | Read-only, intervention requires justification |
| `refund`         | `approve`                                         | Platform | Up to $500 only                                |

**Constraints**:

- Cannot modify billing settings
- Cannot access raw payment data
- Cannot approve refunds > $500

---

#### ADMIN_FINANCE

**Access Scope**: Financial data only (platform-wide)

| Resource       | Granted Permissions                | Scope    | Conditions                   |
| -------------- | ---------------------------------- | -------- | ---------------------------- |
| `billing`      | `manage`                           | Platform | -                            |
| `commission`   | `configure`, `calculate`, `manage` | Platform | -                            |
| `invoice`      | `view`, `manage`, `generate`       | Platform | -                            |
| `refund`       | `approve`, `process`               | Platform | Unlimited                    |
| `payout`       | `process`                          | Platform | -                            |
| `analytics`    | `view:financial`                   | Platform | Financial data only          |
| `user`         | `read`                             | Platform | View only                    |
| `organization` | `read`, `suspend:financial`        | Platform | Suspend for non-payment only |

**Constraints**:

- Cannot modify product data
- Cannot access customer PII beyond billing context
- Read-only on commercial transactions

---

#### ADMIN_COMPLIANCE

**Access Scope**: Compliance data (platform-wide)

| Resource                 | Granted Permissions              | Scope    | Conditions                  |
| ------------------------ | -------------------------------- | -------- | --------------------------- |
| `supplier_certification` | `audit`, `verify`, `view`        | Platform | -                           |
| `recall_notice`          | `initiate`, `track-response`     | Platform | -                           |
| `audit_log`              | `view`, `export`                 | Platform | Cannot modify or delete     |
| `supplier`               | `verify`, `audit`                | Platform | -                           |
| `lot`                    | `trace`, `view`                  | Platform | -                           |
| `haccp_plan`             | `view`, `audit`                  | Platform | -                           |
| `monitoring_record`      | `view`                           | Platform | -                           |
| `organization`           | `validate`, `suspend:compliance` | Platform | Suspend for violations only |
| `user`                   | `read`                           | Platform | View only                   |

**Constraints**:

- Read-only on commercial transactions
- Cannot modify financial settings
- Recall initiation requires QA concurrence

---

#### ADMIN_SUPPORT

**Access Scope**: Support context (cross-tenant read-only)

| Resource         | Granted Permissions           | Scope    | Conditions           |
| ---------------- | ----------------------------- | -------- | -------------------- |
| `support_ticket` | `manage`, `escalate`, `close` | Platform | -                    |
| `user`           | `read`, `impersonate`         | Platform | Impersonation logged |
| `order`          | `view`, `track`               | Platform | Read-only            |
| `message`        | `send`, `read`                | Platform | -                    |
| `refund`         | `approve`                     | Platform | Up to $500 only      |
| `organization`   | `read`                        | Platform | View only            |
| `product`        | `read`                        | Platform | View only            |

**Constraints**:

- Cannot approve refunds > $500
- Cannot modify supplier catalogs
- Cannot access financial data
- Cannot modify user roles

---

#### ADMIN_PRODUCT

**Access Scope**: System configuration (platform-wide)

| Resource        | Granted Permissions                  | Scope    | Conditions |
| --------------- | ------------------------------------ | -------- | ---------- |
| `feature_flag`  | `manage`, `configure`                | Platform | -          |
| `integration`   | `configure`, `manage`                | Platform | -          |
| `api_gateway`   | `manage`, `configure`                | Platform | -          |
| `system`        | `monitor`, `configure`               | Platform | -          |
| `category`      | `create`, `read`, `update`, `delete` | Platform | -          |
| `configuration` | `manage`                             | Platform | -          |

**Constraints**:

- Cannot access customer data
- Cannot modify financial transactions
- Cannot access payment information
- Cannot manage users

---

### 2.2 CHR Organization Permissions

#### CHR_OWNER

**Access Scope**: All business units (organization-wide)

**Approval Authority**: Unlimited

| Resource          | Granted Permissions                                                  | Scope        | Conditions                          |
| ----------------- | -------------------------------------------------------------------- | ------------ | ----------------------------------- |
| `organization`    | `update`, `delete`, `transfer-ownership`, `manage-billing`           | Organization | Transfer requires platform approval |
| `business_unit`   | `create`, `read`, `update`, `delete`                                 | Organization | -                                   |
| `member`          | `create`, `read`, `update`, `delete`, `update-role`, `invite`        | Organization | -                                   |
| `invitation`      | `create`, `cancel`, `read`                                           | Organization | -                                   |
| `product`         | `read`                                                               | Platform     | View all supplier catalogs          |
| `catalog`         | `view`, `save-favorites`, `manage-restricted`                        | Platform     | -                                   |
| `cart`            | `create`, `read`, `update`, `delete`                                 | Organization | -                                   |
| `order`           | `create`, `read`, `update`, `cancel`, `validate`, `approve`, `track` | Organization | **Unlimited approval**              |
| `purchase_order`  | `generate`, `send`                                                   | Organization | -                                   |
| `inventory`       | `view`, `update`, `configure-alerts`                                 | Organization | -                                   |
| `invoice`         | `view`, `approve-payment`                                            | Organization | **Unlimited payment approval**      |
| `payment_method`  | `configure`, `manage`                                                | Organization | -                                   |
| `credit_limit`    | `view`                                                               | Organization | -                                   |
| `wallet`          | `manage`, `topup`, `withdraw`                                        | Organization | -                                   |
| `report`          | `view`, `export`, `configure`                                        | Organization | -                                   |
| `recipe`          | `create`, `read`, `update`, `delete`, `share`                        | Organization | -                                   |
| `wishlist`        | `manage`                                                             | Organization | -                                   |
| `authorization`   | `manage`, `configure-thresholds`                                     | Organization | -                                   |
| `multi_store`     | `consolidate-orders`, `switch-context`, `manage-managers`            | Organization | -                                   |
| `food_safety_doc` | `view`                                                               | Organization | -                                   |
| `allergen_alert`  | `manage`                                                             | Organization | -                                   |
| `temperature_log` | `verify`                                                             | Organization | -                                   |

**Constraints**:

- Cannot transfer ownership without platform approval
- All high-value actions logged
- MFA recommended for financial operations

---

#### CHR_MANAGER

**Access Scope**: Assigned business units

**Approval Authority**: Up to $10,000 per order

| Resource          | Granted Permissions                                                  | Scope         | Conditions                           |
| ----------------- | -------------------------------------------------------------------- | ------------- | ------------------------------------ |
| `member`          | `create`, `read`, `update`, `delete`, `invite`                       | Business Unit | Cannot assign Owner role             |
| `invitation`      | `create`, `cancel`, `read`                                           | Business Unit | -                                    |
| `business_unit`   | `create`, `read`, `update`                                           | Business Unit | Subject to subscription limits       |
| `product`         | `read`                                                               | Platform      | View all supplier catalogs           |
| `catalog`         | `view`, `save-favorites`, `manage-restricted`                        | Platform      | -                                    |
| `cart`            | `create`, `read`, `update`, `delete`                                 | Business Unit | -                                    |
| `order`           | `create`, `read`, `update`, `cancel`, `validate`, `approve`, `track` | Business Unit | **Approve up to $10,000**            |
| `purchase_order`  | `generate`                                                           | Business Unit | -                                    |
| `inventory`       | `view`, `update`, `configure-alerts`                                 | Business Unit | -                                    |
| `invoice`         | `view`, `approve-payment`                                            | Business Unit | **Payment approval up to $10,000**   |
| `payment_method`  | `configure`                                                          | Business Unit | Select existing only, cannot add new |
| `credit_limit`    | `view`                                                               | Business Unit | -                                    |
| `report`          | `view`, `export`, `configure:own`                                    | Business Unit | -                                    |
| `recipe`          | `create`, `read`, `update`, `delete`, `share`                        | Business Unit | -                                    |
| `wishlist`        | `manage`                                                             | Business Unit | -                                    |
| `authorization`   | `manage`, `configure-thresholds`                                     | Business Unit | -                                    |
| `multi_store`     | `consolidate-orders`, `switch-context`                               | Organization  | -                                    |
| `food_safety_doc` | `view`                                                               | Business Unit | -                                    |
| `allergen_alert`  | `manage`                                                             | Business Unit | -                                    |
| `temperature_log` | `verify`                                                             | Business Unit | -                                    |

**Constraints**:

- Cannot assign Owner role
- Order approval up to $10,000
- Cannot delete organization
- Cannot modify billing settings (Owner only)

---

#### HEAD_CHEF

**Access Scope**: Assigned kitchen/location

**Approval Authority**: Up to $5,000 (ingredients only)

| Resource          | Granted Permissions                              | Scope         | Conditions                                  |
| ----------------- | ------------------------------------------------ | ------------- | ------------------------------------------- |
| `member`          | `read`                                           | Business Unit | View only                                   |
| `product`         | `read`                                           | Platform      | View all supplier catalogs                  |
| `catalog`         | `view`, `save-favorites`, `manage-restricted`    | Platform      | -                                           |
| `cart`            | `create`, `read`, `update`, `delete`             | Business Unit | -                                           |
| `order`           | `create`, `read`, `update`, `validate`, `cancel` | Business Unit | **Approve up to $5,000 (ingredients only)** |
| `purchase_order`  | `generate`                                       | Business Unit | -                                           |
| `inventory`       | `view`, `update:consumables`, `configure-alerts` | Business Unit | Consumables only, not equipment             |
| `report`          | `view:limited`                                   | Business Unit | Purchase history, order status              |
| `recipe`          | `create`, `read`, `update`, `delete`, `share`    | Business Unit | -                                           |
| `wishlist`        | `manage`                                         | Business Unit | -                                           |
| `food_safety_doc` | `view`                                           | Business Unit | -                                           |
| `allergen_alert`  | `manage`                                         | Business Unit | -                                           |
| `temperature_log` | `verify`                                         | Business Unit | -                                           |

**Constraints**:

- Can only cancel orders not yet processed
- Inventory updates limited to consumables, not equipment
- Order approval limited to $5,000 and ingredients only
- Cannot approve equipment purchases
- Cannot manage users
- Cannot configure payment methods

---

#### PROCUREMENT_MANAGER

**Access Scope**: Assigned procurement categories

**Approval Authority**: Up to $25,000 per order

| Resource          | Granted Permissions                                      | Scope        | Conditions                     |
| ----------------- | -------------------------------------------------------- | ------------ | ------------------------------ |
| `member`          | `read`                                                   | Organization | View only                      |
| `product`         | `read`                                                   | Platform     | View all supplier catalogs     |
| `catalog`         | `view`, `save-favorites`, `manage-restricted`            | Platform     | -                              |
| `cart`            | `create`, `read`, `update`, `delete`                     | Organization | -                              |
| `order`           | `create`, `read`, `update`, `cancel`, `approve`, `track` | Organization | **Approve up to $25,000**      |
| `purchase_order`  | `generate`, `send`                                       | Organization | -                              |
| `inventory`       | `view`, `update:limited`, `configure-alerts`             | Organization | Limited to assigned categories |
| `invoice`         | `view`                                                   | Organization | View only                      |
| `credit_limit`    | `view`                                                   | Organization | -                              |
| `report`          | `view`, `export`, `configure:own`                        | Organization | -                              |
| `recipe`          | `read`, `share`                                          | Organization | -                              |
| `wishlist`        | `manage`                                                 | Organization | -                              |
| `multi_store`     | `consolidate-orders`, `switch-context`                   | Organization | -                              |
| `food_safety_doc` | `view`                                                   | Organization | -                              |

**Constraints**:

- Can only cancel orders not yet processed
- Inventory updates limited to assigned categories
- Cannot configure payment methods
- Cannot manage users
- Cannot approve payments (Accountant only)

---

#### ACCOUNTANT (CFO/Accountant)

**Access Scope**: Financial data only (organization-wide)

**Approval Authority**: Payment approval up to $50,000

| Resource         | Granted Permissions                   | Scope        | Conditions                         |
| ---------------- | ------------------------------------- | ------------ | ---------------------------------- |
| `member`         | `read`                                | Organization | View only                          |
| `product`        | `read`                                | Platform     | View all supplier catalogs         |
| `catalog`        | `view`, `save-favorites`              | Platform     | -                                  |
| `order`          | `read`, `validate:financial`, `track` | Organization | Financial validation only          |
| `purchase_order` | `generate`                            | Organization | -                                  |
| `inventory`      | `view`                                | Organization | View only                          |
| `invoice`        | `view`, `approve-payment`             | Organization | **Payment approval up to $50,000** |
| `payment_method` | `configure`, `manage`                 | Organization | -                                  |
| `credit_limit`   | `view`                                | Organization | -                                  |
| `wallet`         | `view`, `manage`                      | Organization | -                                  |
| `report`         | `view`, `export`, `configure:own`     | Organization | Full reporting access              |
| `integration`    | `view:erp`                            | Organization | ERP integration only               |

**Constraints**:

- Cannot create orders
- Cannot manage inventory
- Cannot manage users
- Payment approval up to $50,000

---

#### STAFF_OPERATOR

**Access Scope**: Assigned location only

**Approval Authority**: Submit only (no approval)

| Resource          | Granted Permissions                  | Scope         | Conditions                   |
| ----------------- | ------------------------------------ | ------------- | ---------------------------- |
| `member`          | `read`                               | Business Unit | View only                    |
| `product`         | `read`                               | Platform      | View all supplier catalogs   |
| `catalog`         | `view`, `save-favorites`             | Platform      | -                            |
| `cart`            | `create`, `read`, `update`, `delete` | Business Unit | -                            |
| `order`           | `submit`, `read`, `track`            | Business Unit | **Cannot approve or cancel** |
| `inventory`       | `view`, `update:basic`               | Business Unit | Basic updates only           |
| `report`          | `view:limited`                       | Business Unit | Limited reporting access     |
| `recipe`          | `read`                               | Business Unit | View only                    |
| `wishlist`        | `manage`                             | Business Unit | -                            |
| `food_safety_doc` | `view`                               | Business Unit | -                            |
| `temperature_log` | `verify`                             | Business Unit | -                            |

**Constraints**:

- Cannot approve or cancel orders
- Limited reporting access
- Cannot manage users
- Cannot access financial data
- Cannot configure settings

---

### 2.3 Supplier Organization Permissions

#### SUPPLIER_OWNER

**Access Scope**: All locations, all functions

**Approval Authority**: Unlimited (organization-wide)

| Resource                 | Granted Permissions                                                                     | Scope        | Conditions                          |
| ------------------------ | --------------------------------------------------------------------------------------- | ------------ | ----------------------------------- |
| `organization`           | `update`, `delete`, `transfer-ownership`, `configure-delivery`, `manage-certifications` | Organization | Transfer requires platform approval |
| `member`                 | `create`, `read`, `update`, `delete`, `update-role`, `invite`                           | Organization | -                                   |
| `invitation`             | `create`, `cancel`, `read`                                                              | Organization | -                                   |
| `store`                  | `create`, `read`, `update`, `delete`, `manage-inventory`                                | Organization | -                                   |
| `product`                | `create`, `read`, `update`, `delete`, `import`, `export`, `publish`                     | Organization | -                                   |
| `catalog`                | `publish`, `manage-pricing`                                                             | Organization | -                                   |
| `inventory`              | `view`, `update`, `manage-alerts`                                                       | Organization | -                                   |
| `lot`                    | `create`, `read`, `trace`, `link-shipment`                                              | Organization | -                                   |
| `recall_notice`          | `initiate`, `notify`, `track-response`                                                  | Organization | -                                   |
| `order`                  | `view`, `read`, `update`, `process`, `cancel:limited`, `process-refund`                 | Organization | Cannot create (customers do)        |
| `promotion`              | `create`, `read`, `update`, `delete`, `activate`                                        | Organization | -                                   |
| `delivery_slot`          | `create`, `read`, `update`, `delete`                                                    | Organization | -                                   |
| `customer`               | `create`, `read`, `update`, `delete`, `set-credit-limit`, `onboard`                     | Organization | -                                   |
| `payment_method`         | `configure`, `manage`                                                                   | Organization | -                                   |
| `invoice`                | `generate`, `send`                                                                      | Organization | -                                   |
| `payment`                | `reconcile`                                                                             | Organization | -                                   |
| `report`                 | `view`, `export`, `configure`                                                           | Organization | -                                   |
| `recipe`                 | `create`, `read`, `update`, `delete`, `publish`                                         | Organization | -                                   |
| `supplier_certification` | `create`, `read`, `update`, `upload`                                                    | Organization | -                                   |
| `haccp_plan`             | `create`, `read`, `update`, `implement`                                                 | Organization | -                                   |

**Constraints**:

- Cannot create orders (customers do)
- All certification changes audited
- MFA required for critical operations

---

#### SALES_MANAGER

**Access Scope**: Customer-facing operations

**Approval Authority**: Customer credit up to approved limit

| Resource    | Granted Permissions                                            | Scope        | Conditions                            |
| ----------- | -------------------------------------------------------------- | ------------ | ------------------------------------- |
| `member`    | `read`                                                         | Organization | View only                             |
| `product`   | `create`, `read`, `update`                                     | Organization | Soft delete only                      |
| `catalog`   | `publish`, `manage-pricing`                                    | Organization | -                                     |
| `inventory` | `view`                                                         | Organization | View only                             |
| `order`     | `view`, `read`, `update`, `cancel:limited`                     | Organization | Cancel if not yet shipped             |
| `promotion` | `create`, `read`, `update`, `delete`, `activate`               | Organization | -                                     |
| `customer`  | `create`, `read`, `update`, `onboard`, `update-credit:limited` | Organization | Credit limit updates require approval |
| `report`    | `view:sales`, `export`                                         | Organization | Sales reports only                    |
| `recipe`    | `create`, `read`, `update`, `delete`, `publish`                | Organization | -                                     |

**Constraints**:

- Product deletion requires soft delete only
- Can only cancel orders not yet shipped
- Credit limit updates require approval
- Cannot modify inventory
- Cannot configure delivery
- Cannot manage certifications

---

#### INVENTORY_MANAGER

**Access Scope**: All warehouses

**Approval Authority**: Inventory operations (all warehouses)

| Resource        | Granted Permissions                        | Scope        | Conditions              |
| --------------- | ------------------------------------------ | ------------ | ----------------------- |
| `member`        | `read`                                     | Organization | View only               |
| `product`       | `read`, `update:stock`                     | Organization | Stock quantity only     |
| `inventory`     | `view`, `update`, `manage-alerts`          | Organization | -                       |
| `lot`           | `create`, `read`, `trace`, `link-shipment` | Organization | -                       |
| `recall_notice` | `initiate:with-qa`, `track-response`       | Organization | Requires QA concurrence |
| `order`         | `view`, `read`, `update:status`            | Organization | Status updates only     |
| `warehouse`     | `read`, `manage-inventory`                 | Organization | -                       |
| `report`        | `view:inventory`, `export`                 | Organization | Inventory reports only  |
| `integration`   | `configure:erp`                            | Organization | ERP integration only    |

**Constraints**:

- Recall initiation requires QA concurrence
- Product updates limited to stock quantities
- Cannot modify product catalog
- Cannot set pricing
- Cannot manage customers

---

#### WAREHOUSE_MANAGER

**Access Scope**: Assigned warehouse only

**Approval Authority**: Warehouse operations (assigned facility)

| Resource          | Granted Permissions                          | Scope         | Conditions                  |
| ----------------- | -------------------------------------------- | ------------- | --------------------------- |
| `member`          | `read`                                       | Organization  | View only                   |
| `product`         | `read`                                       | Organization  | View only                   |
| `inventory`       | `view:assigned`, `update:assigned`           | Business Unit | Assigned warehouse only     |
| `lot`             | `create:receive`, `read`, `trace`            | Business Unit | Receive/put-away operations |
| `order`           | `view`, `read`, `update:picking`             | Business Unit | Picking operations only     |
| `shipment`        | `create`, `read`, `update`, `track`          | Business Unit | -                           |
| `warehouse`       | `read:assigned`, `manage-inventory:assigned` | Business Unit | Assigned warehouse only     |
| `report`          | `view:warehouse`                             | Business Unit | Warehouse reports only      |
| `temperature_log` | `create`, `verify`                           | Business Unit | -                           |

**Constraints**:

- View and update only assigned warehouses
- Lot creation limited to receive/put-away operations
- Cannot create products
- Cannot manage pricing
- Cannot configure delivery slots (read/update only)

---

#### PRODUCTION_MANAGER

**Access Scope**: Production facilities

**Approval Authority**: Production operations

| Resource            | Granted Permissions                                   | Scope         | Conditions                       |
| ------------------- | ----------------------------------------------------- | ------------- | -------------------------------- |
| `member`            | `read`                                                | Organization  | View only                        |
| `product`           | `create:ingredients`, `read`, `update:specifications` | Business Unit | Ingredient/specification updates |
| `inventory`         | `view`, `update:production`                           | Business Unit | Raw materials only               |
| `lot`               | `create`, `read`, `trace`                             | Business Unit | -                                |
| `recall_notice`     | `initiate:with-qa`                                    | Business Unit | Requires QA concurrence          |
| `order`             | `view:production`, `update:scheduling`                | Business Unit | Production scheduling only       |
| `haccp_plan`        | `read`, `implement`                                   | Business Unit | -                                |
| `monitoring_record` | `create`, `read`                                      | Business Unit | -                                |
| `report`            | `view:production`                                     | Business Unit | Production reports only          |

**Constraints**:

- Product creation limited to ingredient/specification updates
- Inventory updates for raw material consumption only
- Recall requires QA concurrence
- Cannot manage finished goods inventory
- Cannot set pricing
- Cannot manage customers

---

#### LOGISTICS_COORDINATOR

**Access Scope**: Transportation network

**Approval Authority**: Delivery operations

| Resource        | Granted Permissions                                     | Scope        | Conditions                 |
| --------------- | ------------------------------------------------------- | ------------ | -------------------------- |
| `member`        | `read`                                                  | Organization | View only                  |
| `inventory`     | `view:logistics`                                        | Organization | Logistics planning only    |
| `lot`           | `read`, `trace`                                         | Organization | -                          |
| `order`         | `view`, `read`, `update:delivery`                       | Organization | Delivery status only       |
| `shipment`      | `create`, `read`, `update`, `track`, `confirm-delivery` | Organization | -                          |
| `delivery_slot` | `create`, `read`, `update`, `delete`                    | Organization | -                          |
| `warehouse`     | `read`                                                  | Organization | View only                  |
| `report`        | `view:logistics`, `export`                              | Organization | Logistics reports only     |
| `integration`   | `configure:logistics`                                   | Organization | Logistics integration only |

**Constraints**:

- Order updates limited to delivery status
- View inventory for logistics planning only
- Cannot modify product catalog
- Cannot manage customers
- Cannot process payments

---

#### FINANCE_MANAGER

**Access Scope**: Financial operations (organization-wide)

**Approval Authority**: Financial operations

| Resource                 | Granted Permissions        | Scope        | Conditions                    |
| ------------------------ | -------------------------- | ------------ | ----------------------------- |
| `member`                 | `read`                     | Organization | View only                     |
| `catalog`                | `view:pricing`             | Organization | View pricing, suggest changes |
| `order`                  | `view`, `read`             | Organization | View only                     |
| `customer`               | `view`, `update-credit`    | Organization | -                             |
| `invoice`                | `generate`, `send`, `view` | Organization | -                             |
| `payment`                | `reconcile`, `process`     | Organization | -                             |
| `report`                 | `view:financial`, `export` | Organization | Financial reports only        |
| `integration`            | `configure:accounting`     | Organization | Accounting integration only   |
| `supplier_certification` | `upload:tax`               | Organization | Tax documentation only        |

**Constraints**:

- Cannot modify product data
- View pricing, suggest changes only
- Cannot modify product catalog
- Cannot manage inventory
- Cannot configure delivery
- Cannot manage certifications

---

#### QUALITY_ASSURANCE

**Access Scope**: Quality systems (organization-wide)

**Approval Authority**: Compliance and quality operations

| Resource                 | Granted Permissions                            | Scope        | Conditions                       |
| ------------------------ | ---------------------------------------------- | ------------ | -------------------------------- |
| `member`                 | `read`                                         | Organization | View only                        |
| `product`                | `update:labeling`, `update:allergen`           | Organization | Labeling/allergen only           |
| `catalog`                | `publish:compliance`                           | Organization | Compliance verification required |
| `inventory`              | `view`                                         | Organization | View only                        |
| `lot`                    | `create`, `read`, `trace`                      | Organization | -                                |
| `recall_notice`          | `initiate`, `notify`, `track-response`         | Organization | -                                |
| `order`                  | `view`                                         | Organization | View only                        |
| `supplier_certification` | `create`, `read`, `update`, `upload`, `verify` | Organization | -                                |
| `haccp_plan`             | `create`, `read`, `update`, `audit`            | Organization | -                                |
| `monitoring_record`      | `create`, `read`                               | Organization | -                                |
| `food_safety_doc`        | `create`, `read`, `upload`                     | Organization | -                                |
| `report`                 | `view:compliance`, `export`                    | Organization | Compliance reports only          |

**Constraints**:

- Product updates limited to labeling/allergen information
- Catalog publishing requires compliance verification
- Cannot modify pricing
- Cannot manage customers
- Cannot process orders
- Cannot modify inventory quantities

---

#### CUSTOMER_REP

**Access Scope**: Assigned accounts only

**Approval Authority**: Customer service actions only

| Resource         | Granted Permissions                                     | Scope        | Conditions             |
| ---------------- | ------------------------------------------------------- | ------------ | ---------------------- |
| `member`         | `read`                                                  | Organization | View only              |
| `product`        | `read`                                                  | Organization | View only              |
| `inventory`      | `view:assigned-accounts`                                | Team         | Assigned accounts only |
| `order`          | `view:assigned`, `read`, `update:status`                | Team         | Status updates only    |
| `customer`       | `view:assigned`, `update:basic`, `onboard:collect-docs` | Team         | Assigned accounts only |
| `support_ticket` | `create`, `read`, `update`                              | Team         | -                      |
| `report`         | `view:assigned-accounts`                                | Team         | Assigned accounts only |

**Constraints**:

- View and update only assigned customer accounts
- Order updates limited to status, not processing
- Customer onboarding limited to collecting documents
- Cannot modify pricing
- Cannot process payments
- Cannot manage inventory
- Cannot approve credit limits

---

## 3. Scope Definitions and Enforcement

### 3.1 Scope Hierarchy

```
Platform (Cross-Tenant)
    │
    ├── Organization (Tenant-Scoped)
    │       │
    │       ├── Business Unit (Location/Warehouse)
    │       │       │
    │       │       └── Team (Department/Group)
    │       │               │
    │       │               └── Own (User's Records)
    │       │
    │       └── Business Unit (Another Location)
    │
    └── Organization (Another Tenant)
```

### 3.2 Scope Level Definitions

| Scope             | Description                       | Access Pattern                                     | Example                                                           |
| ----------------- | --------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------- |
| **Platform**      | Cross-tenant, global access       | Marketplace operator viewing all organizations     | `SUPER_ADMIN` viewing all orders across all CHR and Supplier orgs |
| **Organization**  | Single tenant, all business units | CHR Owner viewing all restaurant locations         | `CHR_OWNER` viewing orders from all restaurant locations          |
| **Business Unit** | Specific location/warehouse       | Warehouse Manager accessing assigned facility only | `WAREHOUSE_MANAGER` managing inventory for assigned warehouse     |
| **Team**          | Department or functional group    | Sales team accessing assigned customer accounts    | `CUSTOMER_REP` viewing orders for assigned customer accounts      |
| **Own**           | User's own records only           | Staff viewing their own order submissions          | `STAFF_OPERATOR` viewing orders they created                      |

### 3.3 Scope Enforcement Rules

| Rule                      | Description                                           | Implementation                                         |
| ------------------------- | ----------------------------------------------------- | ------------------------------------------------------ |
| **Automatic Scoping**     | All queries automatically filtered by user's scope    | Database queries include `WHERE organization_id = ?`   |
| **Scope Inheritance**     | Higher scopes include lower scopes                    | `Organization` scope includes all `Business Unit` data |
| **Explicit Scope Checks** | Permission checks verify scope boundaries             | `hasPermission('order:view:business_unit')`            |
| **Scope Escalation**      | Temporary scope elevation requires approval           | Manager delegates approval authority with audit trail  |
| **Cross-Scope Access**    | Controlled cross-tenant access for specific workflows | Supplier viewing CHR orders placed with them           |

---

## 4. Attribute-Based Conditions (ABAC)

### 4.1 Monetary Thresholds

**Purpose**: Enforce approval limits based on order value

| Role                  | Threshold | Applies To       | Escalation                                       |
| --------------------- | --------- | ---------------- | ------------------------------------------------ |
| `HEAD_CHEF`           | $5,000    | Ingredients only | Escalate to `CHR_MANAGER`                        |
| `CHR_MANAGER`         | $10,000   | All products     | Escalate to `PROCUREMENT_MANAGER` or `CHR_OWNER` |
| `PROCUREMENT_MANAGER` | $25,000   | All products     | Escalate to `CHR_OWNER`                          |
| `CHR_OWNER`           | Unlimited | All products     | No escalation                                    |
| `ACCOUNTANT`          | $50,000   | Payment approval | Escalate to `CHR_OWNER`                          |

**Implementation Example**:

```typescript
if (order.total > user.role.approvalThreshold) {
  return {
    allowed: false,
    reason: `Order total $${order.total} exceeds approval threshold $${user.role.approvalThreshold}`,
    escalateTo: getNextApprover(user.role),
  };
}
```

---

### 4.2 Category Restrictions

**Purpose**: Limit permissions to specific product categories

| Role                 | Allowed Categories         | Restriction Reason       |
| -------------------- | -------------------------- | ------------------------ |
| `HEAD_CHEF`          | Ingredients, Perishables   | Kitchen operations focus |
| `PRODUCTION_MANAGER` | Raw Materials, Ingredients | Manufacturing focus      |
| `WAREHOUSE_MANAGER`  | All (assigned warehouse)   | Facility-specific        |

**Implementation Example**:

```typescript
if (user.role === 'HEAD_CHEF' && !['ingredients', 'perishables'].includes(order.category)) {
  return {
    allowed: false,
    reason: `Head Chef can only approve orders for ingredients and perishables`,
    escalateTo: 'CHR_MANAGER',
  };
}
```

---

### 4.3 Location-Based Restrictions

**Purpose**: Enforce geographic or facility-based access

| Role                | Location Scope             | Enforcement                    |
| ------------------- | -------------------------- | ------------------------------ |
| `STAFF_OPERATOR`    | Assigned location only     | Cannot view other locations    |
| `WAREHOUSE_MANAGER` | Assigned warehouse only    | Cannot access other warehouses |
| `CUSTOMER_REP`      | Assigned customer accounts | Cannot view other accounts     |

**Implementation Example**:

```typescript
if (user.role === 'WAREHOUSE_MANAGER' && !user.assignedWarehouses.includes(warehouse.id)) {
  return {
    allowed: false,
    reason: `Access restricted to assigned warehouses only`,
  };
}
```

---

### 4.4 Temporal Restrictions

**Purpose**: Time-based access control

| Restriction Type   | Description                                           | Example Roles                       |
| ------------------ | ----------------------------------------------------- | ----------------------------------- |
| **Business Hours** | Actions allowed only during business hours (6AM-10PM) | `order:approve` for `CHR_MANAGER`   |
| **Expiration**     | Temporary role assignments with expiration            | Delegated approval authority        |
| **Cooldown**       | Minimum time between actions                          | Prevent rapid-fire refund approvals |

**Implementation Example**:

```typescript
const businessHours = { start: 6, end: 22 }; // 6AM - 10PM
const currentHour = new Date().getHours();

if (
  action === 'order:approve' &&
  (currentHour < businessHours.start || currentHour >= businessHours.end)
) {
  return {
    allowed: false,
    reason: `Order approval only allowed during business hours (${businessHours.start}AM - ${businessHours.end}PM)`,
  };
}
```

---

### 4.5 Relational Conditions

**Purpose**: Relationship-based access control

| Condition Type        | Description                                  | Example                                   |
| --------------------- | -------------------------------------------- | ----------------------------------------- |
| **Assigned Accounts** | Access limited to assigned customer accounts | `CUSTOMER_REP` viewing assigned customers |
| **Ownership**         | Access to own records only                   | `STAFF_OPERATOR` viewing own orders       |
| **Team Membership**   | Access to team members' records              | Sales team viewing team orders            |

**Implementation Example**:

```typescript
if (user.role === 'CUSTOMER_REP' && !user.assignedCustomers.includes(customer.id)) {
  return {
    allowed: false,
    reason: `Access restricted to assigned customer accounts only`,
  };
}
```

---

### 4.6 Status-Based Conditions

**Purpose**: Resource state-based restrictions

| Condition                | Description                         | Example                                        |
| ------------------------ | ----------------------------------- | ---------------------------------------------- |
| **Order Status**         | Can only cancel pending orders      | `order:cancel?status=pending`                  |
| **Verification Status**  | Limited access until admin approval | Unverified users have read-only access         |
| **Certification Status** | Compliance-based restrictions       | Cannot publish products without certifications |

**Implementation Example**:

```typescript
if (action === 'order:cancel' && order.status !== 'pending') {
  return {
    allowed: false,
    reason: `Can only cancel orders with status 'pending'. Current status: ${order.status}`,
  };
}
```

---

## 5. Multi-Tier Approval Workflows

### 5.1 CHR Order Approval Workflow

**Purpose**: Enforce multi-tier approval based on order value and product category

#### Approval Tiers

| Order Value      | Product Category | Required Approvers               | Approval Type  | Timeout |
| ---------------- | ---------------- | -------------------------------- | -------------- | ------- |
| < $500           | Any              | Manager (auto-approved, logged)  | **Any of**     | 24h     |
| $500 - $5,000    | Perishables      | Head Chef **OR** Manager         | **Any of**     | 12h     |
| $500 - $5,000    | Equipment        | Procurement Manager              | **Any of**     | 24h     |
| $5,000 - $25,000 | Equipment        | Procurement Manager → Accountant | **Sequential** | 48h     |
| > $25,000        | Any              | CHR Owner                        | **Single**     | 72h     |

#### Approval Types

| Type           | Description                                 | Implementation                                      |
| -------------- | ------------------------------------------- | --------------------------------------------------- |
| **Any of**     | Any one of the listed approvers can approve | First approval completes the workflow               |
| **Sequential** | Approvers must approve in order             | Next approver notified only after previous approval |
| **Single**     | Only one specific approver can approve      | No delegation allowed                               |
| **All of**     | All listed approvers must approve           | Workflow completes when all approve                 |

---

#### Workflow Example: $15,000 Equipment Order

```
┌─────────────────────────────────────────────────────────────┐
│ Step 1: Order Creation                                      │
│ Actor: STAFF_OPERATOR or PROCUREMENT_MANAGER                │
│ Action: Create order for $15,000 equipment                  │
│ Status: PENDING_APPROVAL                                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 2: Procurement Manager Approval                        │
│ Actor: PROCUREMENT_MANAGER                                  │
│ Condition: order.total <= $25,000                           │
│ Action: Approve order                                       │
│ Status: APPROVED_PROCUREMENT → PENDING_FINANCIAL_APPROVAL   │
│ Timeout: 48h (escalate to CHR_OWNER if not approved)        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 3: Accountant Approval (Sequential)                    │
│ Actor: ACCOUNTANT                                           │
│ Condition: Previous approval completed                      │
│ Action: Approve payment                                     │
│ Status: APPROVED_FINANCIAL → APPROVED                       │
│ Timeout: 48h (escalate to CHR_OWNER if not approved)        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 4: Order Processing                                    │
│ Actor: SUPPLIER                                             │
│ Action: Process order, prepare shipment                     │
│ Status: PROCESSING → SHIPPED → DELIVERED                    │
└─────────────────────────────────────────────────────────────┘
```

---

### 5.2 Supplier Product Approval Workflow

**Purpose**: Ensure compliance before product publication

```
┌─────────────────────────────────────────────────────────────┐
│ Step 1: Product Creation                                    │
│ Actor: SALES_MANAGER or PRODUCT_MANAGER                     │
│ Action: Create product with details, pricing, images        │
│ Status: DRAFT                                               │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 2: Quality Assurance Review                            │
│ Actor: QUALITY_ASSURANCE                                    │
│ Checks:                                                     │
│   - Allergen labeling complete                              │
│   - HACCP compliance verified                               │
│   - Certifications uploaded                                 │
│ Action: Approve for publication                             │
│ Status: DRAFT → QA_APPROVED                                 │
│ Timeout: 72h                                                │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 3: Publication                                         │
│ Actor: SUPPLIER_OWNER or SALES_MANAGER                      │
│ Condition: QA_APPROVED status                               │
│ Action: Publish to marketplace                              │
│ Status: QA_APPROVED → PUBLISHED                             │
└─────────────────────────────────────────────────────────────┘
```

---

### 5.3 Refund Approval Workflow

**Purpose**: Multi-tier refund approval based on amount

| Refund Amount | Required Approvers                    | Approval Type | Timeout |
| ------------- | ------------------------------------- | ------------- | ------- |
| < $500        | ADMIN_SUPPORT                         | Single        | 24h     |
| $500 - $5,000 | ADMIN_OPERATIONS **OR** ADMIN_FINANCE | Any of        | 48h     |
| > $5,000      | ADMIN_FINANCE → SUPER_ADMIN           | Sequential    | 72h     |

---

### 5.4 Recall Initiation Workflow

**Purpose**: Ensure proper authorization for product recalls

```
┌─────────────────────────────────────────────────────────────┐
│ Step 1: Recall Identification                               │
│ Actor: INVENTORY_MANAGER or PRODUCTION_MANAGER              │
│ Action: Identify product requiring recall                   │
│ Status: RECALL_IDENTIFIED                                   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 2: Quality Assurance Concurrence                       │
│ Actor: QUALITY_ASSURANCE                                    │
│ Checks:                                                     │
│   - Verify recall justification                             │
│   - Assess scope and severity                               │
│   - Identify affected lots                                  │
│ Action: Concur with recall                                  │
│ Status: RECALL_IDENTIFIED → QA_CONCURRED                    │
│ Timeout: 4h (critical)                                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 3: Supplier Owner Authorization                        │
│ Actor: SUPPLIER_OWNER                                       │
│ Condition: QA concurrence completed                         │
│ Action: Authorize recall initiation                         │
│ Status: QA_CONCURRED → RECALL_AUTHORIZED                    │
│ Timeout: 8h                                                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 4: Platform Compliance Notification                    │
│ Actor: ADMIN_COMPLIANCE (automatic notification)            │
│ Action: Review and track recall execution                   │
│ Status: RECALL_AUTHORIZED → RECALL_IN_PROGRESS              │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 5: Customer Notification                               │
│ Actor: QUALITY_ASSURANCE                                    │
│ Action: Notify all affected customers                       │
│ Status: RECALL_IN_PROGRESS → RECALL_COMPLETED               │
└─────────────────────────────────────────────────────────────┘
```

---

### 5.5 Role Delegation Workflow

**Purpose**: Temporary elevation of permissions with audit trail

```
┌─────────────────────────────────────────────────────────────┐
│ Step 1: Delegation Request                                  │
│ Actor: CHR_MANAGER (delegator)                              │
│ Action: Request delegation of approval authority            │
│ Details:                                                    │
│   - Delegatee: PROCUREMENT_MANAGER                          │
│   - Permission: order:approve up to $10,000                 │
│   - Duration: 7 days (vacation period)                      │
│   - Reason: "On vacation, delegate to procurement team"     │
│ Status: DELEGATION_REQUESTED                                │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 2: Owner Approval                                      │
│ Actor: CHR_OWNER                                            │
│ Checks:                                                     │
│   - Verify delegatee is trusted                             │
│   - Confirm duration is reasonable                          │
│   - Review permission scope                                 │
│ Action: Approve delegation                                  │
│ Status: DELEGATION_REQUESTED → DELEGATION_ACTIVE            │
│ Timeout: 24h                                                │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 3: Delegated Authority Active                          │
│ Actor: PROCUREMENT_MANAGER (delegatee)                      │
│ Permissions: Temporary order:approve up to $10,000          │
│ Audit: All actions logged with delegation context           │
│ Duration: 7 days                                            │
│ Status: DELEGATION_ACTIVE                                   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 4: Delegation Expiration                               │
│ Trigger: 7 days elapsed OR manual revocation                │
│ Action: Remove delegated permissions                        │
│ Audit: Log delegation completion                            │
│ Status: DELEGATION_ACTIVE → DELEGATION_EXPIRED              │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Workflow Escalation Processes

### 6.1 Escalation Triggers

| Trigger                  | Description                                  | Escalation Path                        |
| ------------------------ | -------------------------------------------- | -------------------------------------- |
| **Timeout**              | Approval not completed within timeout period | Escalate to next higher role           |
| **Threshold Exceeded**   | Action exceeds role's authority              | Escalate to role with higher threshold |
| **Category Restriction** | Product category not allowed for role        | Escalate to unrestricted role          |
| **Compliance Violation** | Action violates compliance rules             | Escalate to Compliance Admin           |
| **Manual Escalation**    | User manually escalates for review           | Escalate to designated approver        |

### 6.2 Escalation Paths by Organization Type

#### CHR Organization Escalation

```
STAFF_OPERATOR
    ↓ (order approval, user management)
CHR_MANAGER
    ↓ (order > $10K, payment approval)
PROCUREMENT_MANAGER or ACCOUNTANT
    ↓ (order > $25K, payment > $50K)
CHR_OWNER
    ↓ (organization deletion, ownership transfer)
ADMIN_OPERATIONS (Platform)
```

#### Supplier Organization Escalation

```
CUSTOMER_REP
    ↓ (customer credit, order processing)
SALES_MANAGER
    ↓ (pricing, promotions)
SUPPLIER_OWNER
    ↓ (compliance violations, recalls)
ADMIN_COMPLIANCE (Platform)
```

### 6.3 Escalation Notification Rules

| Escalation Type          | Notification Method         | Urgency  | SLA          |
| ------------------------ | --------------------------- | -------- | ------------ |
| **Timeout**              | Email + In-app notification | Medium   | 24h response |
| **Threshold Exceeded**   | In-app notification         | Low      | 48h response |
| **Compliance Violation** | Email + SMS + In-app        | Critical | 4h response  |
| **Manual Escalation**    | Email + In-app notification | Medium   | 24h response |

---

## 7. Implementation Guidelines

### 7.1 Permission Evaluation Logic

```typescript
function hasPermission(
  user: User,
  resource: string,
  action: string,
  scope?: string,
  conditions?: Record<string, any>,
): PermissionResult {
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

  if (!matchingPermission) {
    return {
      allowed: false,
      reason: `No permission found for ${resource}:${action}`,
      escalateTo: getEscalationPath(user.role, resource, action),
    };
  }

  // 5. Evaluate ABAC conditions if present
  if (conditions && matchingPermission.conditions) {
    const conditionResult = evaluateConditions(matchingPermission.conditions, conditions);
    if (!conditionResult.allowed) {
      return {
        allowed: false,
        reason: conditionResult.reason,
        escalateTo: conditionResult.escalateTo,
      };
    }
  }

  return {
    allowed: true,
    reason: 'Permission granted',
    auditLog: {
      userId: user.id,
      organizationId: currentOrganization.id,
      resource,
      action,
      scope,
      conditions,
      timestamp: new Date(),
      ipAddress: request.ip,
    },
  };
}
```

### 7.2 Condition Evaluation Logic

```typescript
function evaluateConditions(
  permissionConditions: Condition[],
  requestContext: Record<string, any>,
): ConditionResult {
  for (const condition of permissionConditions) {
    switch (condition.type) {
      case 'monetary_threshold':
        if (requestContext.amount > condition.threshold) {
          return {
            allowed: false,
            reason: `Amount $${requestContext.amount} exceeds threshold $${condition.threshold}`,
            escalateTo: condition.escalateTo,
          };
        }
        break;

      case 'category_restriction':
        if (!condition.allowedCategories.includes(requestContext.category)) {
          return {
            allowed: false,
            reason: `Category '${requestContext.category}' not allowed. Allowed: ${condition.allowedCategories.join(', ')}`,
            escalateTo: condition.escalateTo,
          };
        }
        break;

      case 'location_restriction':
        if (!condition.allowedLocations.includes(requestContext.locationId)) {
          return {
            allowed: false,
            reason: `Access restricted to assigned locations only`,
            escalateTo: condition.escalateTo,
          };
        }
        break;

      case 'temporal_restriction':
        const currentHour = new Date().getHours();
        if (currentHour < condition.startHour || currentHour >= condition.endHour) {
          return {
            allowed: false,
            reason: `Action only allowed during business hours (${condition.startHour}:00 - ${condition.endHour}:00)`,
            escalateTo: condition.escalateTo,
          };
        }
        break;

      case 'status_restriction':
        if (!condition.allowedStatuses.includes(requestContext.status)) {
          return {
            allowed: false,
            reason: `Action not allowed for status '${requestContext.status}'. Allowed: ${condition.allowedStatuses.join(', ')}`,
            escalateTo: null,
          };
        }
        break;
    }
  }

  return { allowed: true };
}
```

### 7.3 Audit Logging Requirements

**All permission checks must be logged with**:

```typescript
interface AuditLogEntry {
  timestamp: Date;
  userId: string;
  organizationId: string;
  resource: string;
  action: string;
  scope?: string;
  decision: 'allowed' | 'denied';
  reason?: string;
  context: {
    orderId?: string;
    amount?: number;
    category?: string;
    role: string;
    delegatedFrom?: string;
  };
  ipAddress: string;
  userAgent: string;
}
```

**Example Audit Log Entry**:

```json
{
  "timestamp": "2026-02-06T10:15:30Z",
  "userId": "user-123",
  "organizationId": "chr-456",
  "resource": "order",
  "action": "approve",
  "scope": "business_unit",
  "decision": "allowed",
  "context": {
    "orderId": "order-789",
    "amount": 8500,
    "category": "ingredients",
    "role": "chr_manager"
  },
  "ipAddress": "192.168.1.100",
  "userAgent": "Mozilla/5.0..."
}
```

---

## 8. Compliance-Driven Access Control

### 8.1 FSMA 204 Food Traceability

| Requirement                        | Permission                                                                       | Responsible Roles                                        | Enforcement                                        |
| ---------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------- |
| **Critical Tracking Events (CTE)** | `lot:create`, `lot:trace`, `lot:update`                                          | Inventory Manager, QA, Supplier Owner, Warehouse Manager | All lot actions automatically logged               |
| **Supplier Verification**          | `supplier_certification:audit`, `supplier_certification:verify`                  | Compliance Admin, QA                                     | Certifications required before product publication |
| **Preventive Controls**            | `haccp_plan:view`, `haccp_plan:implement`, `monitoring_record:create`            | Production Manager, QA                                   | HACCP plans required for production                |
| **Recall Management**              | `recall_notice:initiate`, `recall_notice:notify`, `recall_notice:track-response` | QA, Supplier Owner, Compliance Admin                     | Multi-tier approval required                       |
| **Audit Trail**                    | All `lot` and `shipment` actions                                                 | System-enforced for all roles                            | Immutable logs with tamper-proof storage           |

### 8.2 Financial Compliance (SOX, PCI-DSS)

| Control                          | Permission Separation                                                      | Roles                                  | Enforcement                  |
| -------------------------------- | -------------------------------------------------------------------------- | -------------------------------------- | ---------------------------- |
| **Separation of Duties**         | `order:create` → `order:approve` → `payment:process` → `payment:reconcile` | Staff → Manager → Accountant → Finance | Sequential workflow required |
| **Privileged Access Monitoring** | `refund:approve`, `commission:configure`                                   | Finance Admin + Ops Admin              | Secondary approval required  |
| **Immutable Audit Logs**         | All permission changes                                                     | System-enforced                        | Tamper-proof storage         |
| **Access Recertification**       | Quarterly review of admin roles; annual for operational                    | Platform Admin                         | Automated reminders          |

---

## 9. Quick Reference Matrices

### 9.1 Marketplace Operator Quick Reference

| Permission Category     | Super Admin | Ops Admin  | Finance | Compliance |  Support   | Product |
| ----------------------- | :---------: | :--------: | :-----: | :--------: | :--------: | :-----: |
| User Management         |   ✅ Full   | ✅ Limited |   ❌    |     ❌     |  ✅ Read   |   ❌    |
| Organization Management |   ✅ Full   | ✅ Limited |   ❌    |  ✅ Audit  |     ❌     |   ❌    |
| Financial Operations    |   ✅ Full   |     ❌     | ✅ Full |  ✅ View   | ⚠️ Limited |   ❌    |
| Compliance & Safety     |   ✅ Full   |     ❌     |   ❌    |  ✅ Full   |     ❌     |   ❌    |
| System Configuration    |   ✅ Full   |     ❌     |   ❌    |     ❌     |     ❌     | ✅ Full |

### 9.2 CHR Organizations Quick Reference

| Permission Category    | Owner | Manager | Head Chef | Procurement | Accountant | Staff |
| ---------------------- | :---: | :-----: | :-------: | :---------: | :--------: | :---: |
| Organization Settings  |  ✅   |   ⚠️    |    ❌     |     ❌      |     ⚠️     |  ❌   |
| User Management        |  ✅   |   ✅    |    ❌     |     ❌      |     ❌     |  ❌   |
| Ordering & Procurement |  ✅   |   ✅    |    ⚠️     |     ✅      |     ❌     |  ⚠️   |
| Inventory Management   |  ✅   |   ✅    |    ✅     |     ⚠️      |     ❌     |  ⚠️   |
| Financial Operations   |  ✅   |   ⚠️    |    ❌     |     ⚠️      |     ✅     |  ❌   |
| Reporting & Analytics  |  ✅   |   ✅    |    ⚠️     |     ✅      |     ✅     |  ⚠️   |

### 9.3 Supplier Organizations Quick Reference

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

| Term                     | Definition                                                                                            |
| ------------------------ | ----------------------------------------------------------------------------------------------------- |
| **RBAC**                 | Role-Based Access Control - Access control paradigm where permissions are assigned to roles           |
| **ABAC**                 | Attribute-Based Access Control - Access control based on attributes (value, category, time, location) |
| **Scope**                | The visibility boundary for a permission (own, team, business_unit, organization, platform)           |
| **Condition**            | Attribute-based restriction on a permission (e.g., amount < $10,000, category == 'ingredients')       |
| **Approval Tier**        | Level in multi-step approval workflow                                                                 |
| **Escalation**           | Process of forwarding request to higher authority when threshold exceeded or timeout occurs           |
| **Delegation**           | Temporary transfer of role permissions with audit trail                                               |
| **Least Privilege**      | Security principle of granting minimum permissions necessary for job function                         |
| **Separation of Duties** | Security control requiring multiple people to complete critical tasks                                 |
| **Immutable Audit Log**  | Tamper-proof log of system events that cannot be modified or deleted                                  |

---

**Document Version**: 1.0  
**Last Updated**: 2026-02-06  
**Author**: Restomarket Platform Team  
**Classification**: Internal - Implementation Reference
