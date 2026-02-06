# Roles Definition: Restomarket B2B Marketplace

## Executive Summary

This document provides a comprehensive definition of all roles within the Restomarket B2B food marketplace platform, organized by organization type. It details role responsibilities, permission scopes, approval authorities, and inheritance rules across three distinct organizational domains: **Marketplace Operators**, **CHR Buyers** (Cafés, Hotels, Restaurants), and **Food Suppliers**.

---

## 1. Role Hierarchy and Inheritance Principles

### 1.1 Inheritance Model

The RBAC system implements a **hierarchical inheritance model** where higher-level roles inherit permissions from lower-level roles:

```
Owner (Full Access)
  ├── Manager (Operational Control)
  │     ├── Supervisor (Team Management)
  │     │     └── Staff (Basic Operations)
  │     └── Specialist (Domain-Specific)
  └── Administrator (Technical/System)
```

### 1.2 Inheritance Rules

| Rule                         | Description                                              | Example                                                  |
| ---------------------------- | -------------------------------------------------------- | -------------------------------------------------------- |
| **Child Inherits Parent**    | Child roles automatically inherit all parent permissions | `CHR_MANAGER` inherits all `STAFF_OPERATOR` permissions  |
| **Additive Permissions**     | Additional permissions can be granted at any level       | `HEAD_CHEF` gets `STAFF` permissions + recipe management |
| **Conditional Restrictions** | Permissions can be restricted via ABAC conditions        | `HEAD_CHEF` can approve orders up to $5,000 only         |
| **No Permission Revocation** | Child roles cannot have fewer permissions than parent    | Cannot create a Manager with less access than Staff      |
| **Delegation Support**       | Temporary elevation with audit trails                    | Manager delegates approval authority during vacation     |

### 1.3 Three-Tier Tenant Isolation

| Tier              | Scope                   | Access Pattern                              | Examples                                   |
| ----------------- | ----------------------- | ------------------------------------------- | ------------------------------------------ |
| **Platform**      | Cross-tenant operations | Global admin operations, analytics, billing | Marketplace operator team                  |
| **Organization**  | Single CHR or Supplier  | Complete data isolation between entities    | Individual restaurant chain, food supplier |
| **Business Unit** | Sub-entities within org | Hierarchical access within organization     | Restaurant location, warehouse             |

---

## 2. Marketplace Operator Roles (Internal Platform Team)

### 2.1 Role Hierarchy

```
┌─────────────────────────────────────────┐
│         SUPER_ADMIN (Root)              │
│  Full platform control, emergency access │
└──────────────┬──────────────────────────┘
               │
       ┌───────┴───────┐
       │               │
┌──────▼──────┐  ┌─────▼─────┐
│   ADMIN     │  │  SYSTEM   │
│  Operations │  │  Service  │
└──────┬──────┘  └───────────┘
       │
   ┌───┴───┬────────┬────────┐
   │       │        │        │
┌──▼──┐ ┌─▼───┐ ┌──▼───┐ ┌──▼───┐
│FINANCE│ │COMPLIANCE│ │SUPPORT│ │PRODUCT │
└───────┘ └────────┘ └──────┘ └───────┘
```

### 2.2 Role Definitions

#### SUPER_ADMIN

**Primary Responsibilities:**

- Platform governance and strategic oversight
- Emergency access and break-glass protocols
- Audit oversight and compliance monitoring
- Critical system configuration

**Key Permissions:**

- `*:*` (all resources, all actions)
- Full cross-tenant visibility
- User impersonation
- Audit log purging (with justification)

**Constraints:**

- MFA required for all actions
- All activities logged to immutable storage
- Cannot delete own account
- Requires secondary approval for critical actions

**Approval Authority:** Unlimited

**Access Scope:** Platform-wide (cross-tenant)

---

#### ADMIN_OPERATIONS

**Primary Responsibilities:**

- Daily platform management
- Supplier and CHR onboarding and validation
- Dispute resolution and order intervention
- Support ticket escalation

**Key Permissions:**

- `user:create`, `user:read`, `user:update`, `user:ban`
- `organization:validate`, `organization:suspend`
- `order:intervene`, `order:view` (cross-tenant)
- `analytics:view`
- `support_ticket:escalate`

**Constraints:**

- Cannot modify billing settings
- Cannot access raw payment data
- Cannot delete users (requires Super Admin)
- Cannot approve refunds > $500

**Approval Authority:** Up to $500 for refunds

**Access Scope:** Platform-wide with financial restrictions

**Inherits From:** N/A (base platform role)

---

#### ADMIN_FINANCE

**Primary Responsibilities:**

- Commission management and configuration
- Invoicing and payout processing
- Financial reporting and analytics
- Refund approval and processing

**Key Permissions:**

- `billing:manage`, `commission:configure`
- `invoice:manage`, `payout:process`
- `refund:approve`
- `analytics:financial`

**Constraints:**

- Cannot modify product data
- Cannot access customer PII beyond billing context
- Read-only on commercial transactions
- Cannot suspend organizations (requires Ops Admin)

**Approval Authority:** Unlimited for financial operations

**Access Scope:** Financial data only (platform-wide)

**Inherits From:** N/A (base platform role)

---

#### ADMIN_COMPLIANCE

**Primary Responsibilities:**

- FSMA/HACCP oversight and auditing
- Certification verification
- Recall management and coordination
- Regulatory reporting

**Key Permissions:**

- `certification:audit`, `certification:verify`
- `recall:initiate`, `recall:manage`
- `audit_log:view`, `audit_log:export`
- `supplier:verify`, `violation:flag`

**Constraints:**

- Read-only on commercial transactions
- Cannot modify financial settings
- Cannot access payment data
- Requires QA concurrence for recalls

**Approval Authority:** Compliance-related actions only

**Access Scope:** Compliance data (platform-wide)

**Inherits From:** N/A (base platform role)

---

#### ADMIN_SUPPORT

**Primary Responsibilities:**

- Customer service and troubleshooting
- Technical support and training
- Support ticket management
- User impersonation for debugging

**Key Permissions:**

- `support_ticket:manage`, `support_ticket:escalate`
- `user:read`, `user:impersonate`
- `order:view`, `order:read`
- `message:send`, `chat:manage`

**Constraints:**

- Cannot approve refunds > $500
- Cannot modify supplier catalogs
- Cannot access financial data
- Cannot modify user roles

**Approval Authority:** Support actions only (no financial)

**Access Scope:** Support context (cross-tenant read-only)

**Inherits From:** N/A (base platform role)

---

#### ADMIN_PRODUCT

**Primary Responsibilities:**

- Feature releases and system configuration
- Integration management (APIs, webhooks)
- Feature flag management
- System monitoring

**Key Permissions:**

- `feature_flag:manage`, `feature_flag:configure`
- `integration:configure`, `integration:manage`
- `api_gateway:manage`, `api_gateway:configure`
- `system:monitor`, `system:configure`

**Constraints:**

- Cannot access customer data
- Cannot modify financial transactions
- Cannot access payment information
- Cannot manage users

**Approval Authority:** Technical configuration only

**Access Scope:** System configuration (platform-wide)

**Inherits From:** N/A (base platform role)

---

#### SYSTEM_SERVICE

**Primary Responsibilities:**

- Automated background services
- ETL processes and data synchronization
- Report generation and scheduling
- Webhook management

**Key Permissions:**

- `api:service`, `api:automated`
- `report:generate`, `report:schedule`
- `webhook:manage`, `webhook:trigger`
- `etl:execute`

**Constraints:**

- Service account only (no human user)
- Token-based authentication
- IP-restricted access
- No interactive operations

**Approval Authority:** N/A (automated only)

**Access Scope:** System operations (platform-wide)

**Inherits From:** N/A (service account)

---

## 3. CHR Organization Roles (Buyers)

### 3.1 Organizational Structure

```
┌─────────────────────────────────────────┐
│         CHR_ENTERPRISE                  │
│     (Holding/Parent Company)            │
└──────────────┬──────────────────────────┘
               │
    ┌──────────┼──────────┐
    │          │          │
┌───▼───┐  ┌──▼───┐  ┌───▼───┐
│RESTAURANT│ │RESTAURANT│ │CATERING │
│   A      │ │   B      │ │   DIV   │
│(Downtown)│ │(Airport) │ │         │
└───┬─────┘  └──┬─────┘  └───────┘
    │           │
┌───┴───┐   ┌───┴───┐
│Kitchen│   │Kitchen│
│Staff  │   │Staff  │
└───────┘   └───────┘
```

### 3.2 Role Definitions

#### CHR_OWNER

**Primary Responsibilities:**

- Strategic oversight and business direction
- Financial ultimate authority
- Contract negotiation with suppliers
- Organization-wide settings and configuration

**Key Permissions:**

- `organization:update`, `organization:delete`
- `member:invite`, `member:remove`, `member:assign_role`
- `business_unit:create`, `business_unit:manage`
- `order:approve` (unlimited)
- `payment_method:configure`, `payment:approve` (unlimited)
- `report:view_all`, `report:export`, `report:configure`
- `multiStore:consolidate-orders`, `multiStore:manage-managers`

**Constraints:**

- Cannot transfer ownership without platform approval
- All high-value actions logged
- MFA recommended for financial operations

**Approval Authority:** Unlimited

**Access Scope:** All business units (organization-wide)

**Inherits From:** All lower CHR roles (Manager, Chef, Procurement, Accountant, Staff)

---

#### CHR_MANAGER

**Primary Responsibilities:**

- Operational management of assigned locations
- Staff supervision and role assignment
- Budget allocation and threshold configuration
- Daily order approval and tracking

**Key Permissions:**

- `member:invite`, `member:remove`
- `member:assign_role` (except Owner role)
- `business_unit:create` (subject to subscription limits)
- `order:create`, `order:approve`, `order:validate`
- `order:configure_threshold`
- `authorization:manage`, `authorization:configure-thresholds`
- `payment_method:configure` (select existing only)
- `report:view`, `report:export`
- `multiStore:consolidate-orders`, `multiStore:switch-context`

**Constraints:**

- Cannot assign Owner role
- Order approval up to $10,000
- Cannot delete organization
- Cannot modify billing settings (Owner only)

**Approval Authority:** Up to $10,000 per order

**Access Scope:** Assigned business units

**Inherits From:** STAFF_OPERATOR

---

#### HEAD_CHEF

**Primary Responsibilities:**

- Menu planning and recipe development
- Quality control and ingredient standards
- Kitchen inventory management
- Ingredient order validation

**Key Permissions:**

- `order:create`, `order:validate` (ingredients only, up to $5,000)
- `product:read`, `catalog:explore`
- `inventory:view`, `inventory:update` (perishables)
- `recipe:create`, `recipe:read`, `recipe:update`, `recipe:delete`
- `allergen_alert:manage`
- `temperature_log:verify`
- `authorization:manage` (limited)

**Constraints:**

- Order approval up to $5,000 (ingredients only)
- Cannot approve equipment purchases
- Cannot manage users
- Cannot configure payment methods

**Approval Authority:** Up to $5,000 (ingredients only)

**Access Scope:** Assigned kitchen/location

**Inherits From:** STAFF_OPERATOR

---

#### PROCUREMENT_MANAGER

**Primary Responsibilities:**

- Vendor selection and relationship management
- Price negotiation and contract management
- Purchase order creation and approval
- Multi-category procurement oversight

**Key Permissions:**

- `order:create`, `order:approve`, `order:cancel`
- `purchase_order:generate`
- `catalog:explore`, `catalog:manage_restricted`
- `product:view`, `product:suggest`
- `report:view`, `report:export`
- `multiStore:consolidate-orders`, `multiStore:switch-context`
- `credit_limit:view`

**Constraints:**

- Order approval up to $25,000
- Cannot configure payment methods
- Cannot manage users
- Cannot approve payments (Accountant only)

**Approval Authority:** Up to $25,000 per order

**Access Scope:** Assigned procurement categories

**Inherits From:** STAFF_OPERATOR

---

#### ACCOUNTANT (CFO/Accountant)

**Primary Responsibilities:**

- Invoice processing and verification
- Payment authorization and reconciliation
- Financial reporting and analysis
- Budget tracking and compliance

**Key Permissions:**

- `invoice:view`, `invoice:approve_payment`
- `payment:approve` (up to $50,000)
- `payment_method:configure`
- `order:validate` (financial validation)
- `report:view_all`, `report:export`
- `credit_limit:view`
- `organization:manage_billing`

**Constraints:**

- Cannot create orders
- Cannot manage inventory
- Cannot manage users
- Payment approval up to $50,000

**Approval Authority:** Payment approval up to $50,000

**Access Scope:** Financial data only (organization-wide)

**Inherits From:** STAFF_OPERATOR (limited)

---

#### STAFF_OPERATOR

**Primary Responsibilities:**

- Daily operational tasks
- Order creation and submission
- Product receiving and verification
- Basic inventory updates

**Key Permissions:**

- `product:view`, `catalog:explore`
- `cart:create`, `order:submit`
- `order:track`, `order:view` (own orders)
- `inventory:view`, `inventory:update` (basic)
- `product_reception:verify`
- `account:settings` (own profile)
- `chat:access`, `faq:view`

**Constraints:**

- Cannot approve orders
- Cannot manage users
- Cannot access financial data
- Cannot configure settings

**Approval Authority:** Submit only (no approval)

**Access Scope:** Assigned location only

**Inherits From:** N/A (base CHR role)

---

### 3.3 CHR Approval Workflow Rules

| Order Value      | Product Category | Required Approvers               | Approval Type | Timeout |
| ---------------- | ---------------- | -------------------------------- | ------------- | ------- |
| < $500           | Any              | Manager (auto-approved, logged)  | Any of        | 24h     |
| $500 - $5,000    | Perishables      | Head Chef OR Manager             | Any of        | 12h     |
| $500 - $5,000    | Equipment        | Procurement Manager              | Any of        | 24h     |
| $5,000 - $25,000 | Equipment        | Procurement Manager → Accountant | Sequential    | 48h     |
| > $25,000        | Any              | CHR Owner                        | Single        | 72h     |

---

## 4. Supplier Organization Roles (Sellers)

### 4.1 Organizational Structure

```
┌─────────────────────────────────────────┐
│      SUPPLIER_ORGANIZATION              │
│    (Food Producer/Distributor)          │
└──────────────┬──────────────────────────┘
               │
       ┌───────┴───────┐
       │               │
┌──────▼──────┐  ┌─────▼──────┐
│  HEADQUARTERS│  │  REGIONAL  │
│  (Admin)     │  │  WAREHOUSES│
└──────┬───────┘  └─────┬──────┘
       │                │
┌──────▼──────┐  ┌──────▼──────┐
│PRODUCTION   │  │LOCAL STORES │
│FACILITIES   │  │(Pick-up Points)
└─────────────┘  └─────────────┘
```

### 4.2 Role Definitions

#### SUPPLIER_OWNER

**Primary Responsibilities:**

- Business strategy and major account management
- Platform relationship and compliance
- Organization-wide configuration
- Ultimate certification responsibility

**Key Permissions:**

- `organization:update`, `organization:delete`, `organization:transfer-ownership`
- `member:create`, `member:read`, `member:update`, `member:delete`, `member:update-role`, `member:invite`
- `store:create`, `store:read`, `store:update`, `store:delete`, `store:manage-inventory`
- `product:create`, `product:read`, `product:update`, `product:delete`, `product:import`, `product:export`
- `inventory:view`, `inventory:update`, `inventory:manage-alerts`
- `order:read`, `order:update`, `order:process-refund`
- `promotion:create`, `promotion:read`, `promotion:update`, `promotion:delete`, `promotion:activate`
- `customer:create`, `customer:read`, `customer:update`, `customer:delete`, `customer:set-credit-limit`
- `report:view`, `report:export`, `report:configure`

**Constraints:**

- Cannot create orders (customers do)
- All certification changes audited
- MFA required for critical operations

**Approval Authority:** Unlimited (organization-wide)

**Access Scope:** All locations, all functions

**Inherits From:** All lower supplier roles

---

#### SALES_MANAGER

**Primary Responsibilities:**

- Customer acquisition and relationship management
- Pricing strategy and contract negotiation
- Promotion management and campaigns
- Customer allergen communication

**Key Permissions:**

- `customer:create`, `customer:read`, `customer:update`, `customer:onboard`
- `customer:update_credit` (up to approved limit)
- `product:create`, `product:update`, `product:delete` (soft delete only)
- `catalog:publish`, `catalog:manage_pricing`
- `promotion:create`, `promotion:read`, `promotion:update`, `promotion:delete`, `promotion:activate`
- `order:view_all`, `order:cancel` (if not yet shipped)
- `report:sales`

**Constraints:**

- Cannot modify inventory
- Cannot configure delivery
- Cannot manage certifications
- Order cancellation only if not shipped

**Approval Authority:** Customer credit up to approved limit

**Access Scope:** Customer-facing operations

**Inherits From:** CUSTOMER_REP

---

#### INVENTORY_MANAGER

**Primary Responsibilities:**

- Stock control across all warehouses
- Lot tracking and traceability
- Recall execution and coordination
- Low-stock alert management

**Key Permissions:**

- `inventory:view_all`, `inventory:update`, `inventory:manage-alerts`
- `lot:create`, `lot:trace`, `lot:update`
- `recall:initiate` (with QA concurrence)
- `product:update` (stock quantity only)
- `order:view_all`, `order:process`
- `report:inventory`

**Constraints:**

- Cannot modify product catalog
- Cannot set pricing
- Cannot manage customers
- Recall requires QA approval

**Approval Authority:** Inventory operations (all warehouses)

**Access Scope:** All warehouses

**Inherits From:** WAREHOUSE_MANAGER

---

#### WAREHOUSE_MANAGER

**Primary Responsibilities:**

- Specific facility operations
- Picking, packing, and shipping
- Temperature logs and sanitation records
- Receiving and put-away operations

**Key Permissions:**

- `inventory:view` (assigned warehouse), `inventory:update`
- `lot:create` (receive/put-away), `lot:trace`
- `order:view_all`, `order:process` (assigned warehouse)
- `deliverySlot:read`, `deliverySlot:update`
- `customer:read`
- `report:inventory` (assigned warehouse)

**Constraints:**

- Access limited to assigned warehouse only
- Cannot create products
- Cannot manage pricing
- Cannot configure delivery slots (read/update only)

**Approval Authority:** Warehouse operations (assigned facility)

**Access Scope:** Assigned warehouse only

**Inherits From:** N/A (base operational role)

---

#### PRODUCTION_MANAGER

**Primary Responsibilities:**

- Manufacturing and batch control
- Quality testing and HACCP implementation
- Production scheduling
- Raw material consumption reporting

**Key Permissions:**

- `product:create` (ingredient/specification updates)
- `product:update` (ingredient/specification updates)
- `inventory:view`, `inventory:update` (raw materials)
- `lot:create`, `lot:trace`
- `order:process` (production scheduling only)
- `recall:initiate` (with QA concurrence)
- `report:inventory` (production facilities)

**Constraints:**

- Cannot manage finished goods inventory
- Cannot set pricing
- Cannot manage customers
- Recall requires QA approval

**Approval Authority:** Production operations

**Access Scope:** Production facilities

**Inherits From:** WAREHOUSE_MANAGER (limited)

---

#### LOGISTICS_COORDINATOR

**Primary Responsibilities:**

- Route planning and optimization
- Delivery scheduling and carrier management
- Sanitary transport compliance
- Delivery consolidation

**Key Permissions:**

- `deliverySlot:create`, `deliverySlot:read`, `deliverySlot:update`, `deliverySlot:delete`
- `order:view_all`, `order:update` (delivery status)
- `inventory:view` (assigned warehouses)
- `lot:trace`
- `organization:configure_delivery`
- `report:inventory` (logistics view)

**Constraints:**

- Cannot modify product catalog
- Cannot manage customers
- Cannot process payments
- Cannot create/delete inventory

**Approval Authority:** Delivery operations

**Access Scope:** Transportation network

**Inherits From:** N/A (specialized role)

---

#### FINANCE_MANAGER

**Primary Responsibilities:**

- Invoicing and payment processing
- Credit management and reconciliation
- Tax documentation and audit trails
- Financial reporting

**Key Permissions:**

- `invoice:generate`, `invoice:send`
- `payment:reconcile`, `payment:process`
- `customer:view`, `customer:update_credit`
- `catalog:manage_pricing` (view pricing, suggest changes)
- `order:view_all`
- `report:sales`, `report:financial`

**Constraints:**

- Cannot modify product catalog
- Cannot manage inventory
- Cannot configure delivery
- Cannot manage certifications

**Approval Authority:** Financial operations

**Access Scope:** Financial operations (organization-wide)

**Inherits From:** N/A (specialized role)

---

#### QUALITY_ASSURANCE

**Primary Responsibilities:**

- Certification management and verification
- FSMA preventive controls and compliance
- Third-party audits and documentation
- Recall management and coordination

**Key Permissions:**

- `organization:manage_certifications`
- `certification:upload`, `certification:audit`, `certification:verify`
- `product:create` (labeling/allergen updates)
- `product:update` (labeling/allergen updates)
- `catalog:publish` (compliance approval)
- `lot:create`, `lot:trace`
- `recall:initiate`, `recall:manage`
- `inventory:view_all`
- `report:compliance`

**Constraints:**

- Cannot modify pricing
- Cannot manage customers
- Cannot process orders
- Cannot modify inventory quantities

**Approval Authority:** Compliance and quality operations

**Access Scope:** Quality systems (organization-wide)

**Inherits From:** N/A (specialized role)

---

#### CUSTOMER_REP

**Primary Responsibilities:**

- Order support and issue resolution
- Account relationship management
- Customer complaint handling
- Documentation collection for onboarding

**Key Permissions:**

- `customer:view` (assigned accounts), `customer:update`
- `customer:onboard` (collect docs, forward to Sales)
- `order:view_all` (assigned accounts), `order:update` (status updates only)
- `product:read`
- `report:sales` (own accounts only)

**Constraints:**

- Access limited to assigned accounts
- Cannot modify pricing
- Cannot process payments
- Cannot manage inventory
- Cannot approve credit limits

**Approval Authority:** Customer service actions only

**Access Scope:** Assigned accounts only

**Inherits From:** N/A (base customer-facing role)

---

## 5. Role Inheritance Summary

### 5.1 Marketplace Operator Inheritance

| Role             | Inherits From | Additional Permissions                     |
| ---------------- | ------------- | ------------------------------------------ |
| SUPER_ADMIN      | N/A           | All platform permissions                   |
| ADMIN_OPERATIONS | N/A           | User management, organization validation   |
| ADMIN_FINANCE    | N/A           | Billing, commission, refunds               |
| ADMIN_COMPLIANCE | N/A           | Certifications, recalls, audits            |
| ADMIN_SUPPORT    | N/A           | Support tickets, user impersonation        |
| ADMIN_PRODUCT    | N/A           | Feature flags, integrations, system config |
| SYSTEM_SERVICE   | N/A           | Automated operations only                  |

### 5.2 CHR Organization Inheritance

| Role                | Inherits From            | Additional Permissions                                                 |
| ------------------- | ------------------------ | ---------------------------------------------------------------------- |
| CHR_OWNER           | All CHR roles            | Organization management, unlimited approval                            |
| CHR_MANAGER         | STAFF_OPERATOR           | User management, order approval ($10K), threshold config               |
| HEAD_CHEF           | STAFF_OPERATOR           | Recipe management, inventory updates, order approval ($5K ingredients) |
| PROCUREMENT_MANAGER | STAFF_OPERATOR           | Order approval ($25K), purchase orders, vendor management              |
| ACCOUNTANT          | STAFF_OPERATOR (limited) | Invoice processing, payment approval ($50K), financial reports         |
| STAFF_OPERATOR      | N/A                      | Basic operations, order submission, product viewing                    |

### 5.3 Supplier Organization Inheritance

| Role                  | Inherits From               | Additional Permissions                                 |
| --------------------- | --------------------------- | ------------------------------------------------------ |
| SUPPLIER_OWNER        | All supplier roles          | Organization management, unlimited access              |
| SALES_MANAGER         | CUSTOMER_REP                | Pricing, promotions, customer credit management        |
| INVENTORY_MANAGER     | WAREHOUSE_MANAGER           | All warehouses access, lot tracking, recall initiation |
| WAREHOUSE_MANAGER     | N/A                         | Facility operations, picking, shipping                 |
| PRODUCTION_MANAGER    | WAREHOUSE_MANAGER (limited) | Manufacturing, batch control, HACCP                    |
| LOGISTICS_COORDINATOR | N/A                         | Delivery scheduling, route planning                    |
| FINANCE_MANAGER       | N/A                         | Invoicing, payment processing, reconciliation          |
| QUALITY_ASSURANCE     | N/A                         | Certifications, compliance, recalls                    |
| CUSTOMER_REP          | N/A                         | Customer support, order status updates                 |

---

## 6. Permission Scope Definitions

### 6.1 Scope Levels

| Scope             | Description                       | Example                                            |
| ----------------- | --------------------------------- | -------------------------------------------------- |
| **Platform**      | Cross-tenant, global access       | Marketplace operator viewing all organizations     |
| **Organization**  | Single tenant, all business units | CHR Owner viewing all restaurant locations         |
| **Business Unit** | Specific location/warehouse       | Warehouse Manager accessing assigned facility only |
| **Team**          | Department or functional group    | Sales team accessing assigned customer accounts    |
| **Own**           | User's own records only           | Staff viewing their own order submissions          |

### 6.2 Conditional Permissions (ABAC)

| Condition Type           | Description                  | Example Roles                                                              |
| ------------------------ | ---------------------------- | -------------------------------------------------------------------------- |
| **Monetary Threshold**   | Value-based approval limits  | CHR_MANAGER ($10K), HEAD_CHEF ($5K), PROCUREMENT_MANAGER ($25K)            |
| **Category Restriction** | Product type limitations     | HEAD_CHEF (ingredients only), PRODUCTION_MANAGER (raw materials)           |
| **Location-Based**       | Geographic or facility scope | WAREHOUSE_MANAGER (assigned warehouse), STAFF_OPERATOR (assigned location) |
| **Temporal**             | Time-based restrictions      | Order approval during business hours only                                  |
| **Relational**           | Relationship-based access    | CUSTOMER_REP (assigned accounts only)                                      |

---

## 7. Role Assignment Guidelines

### 7.1 Assignment Rules

| Rule                           | Description                                                  | Enforcement                     |
| ------------------------------ | ------------------------------------------------------------ | ------------------------------- |
| **One Owner Per Organization** | Each organization must have exactly one owner                | System-enforced                 |
| **Role Compatibility**         | CHR roles cannot be assigned to Supplier orgs and vice versa | System-enforced                 |
| **Minimum Permissions**        | All users must have at least one role                        | System-enforced                 |
| **Maximum Roles**              | Users can have multiple roles within same organization       | Configurable limit (default: 3) |
| **Delegation Tracking**        | Temporary role assignments must have expiration and reason   | Audit-logged                    |

### 7.2 Role Transition Workflows

| Transition             | Approval Required          | Audit Level |
| ---------------------- | -------------------------- | ----------- |
| Staff → Manager        | Owner or Manager           | Standard    |
| Manager → Owner        | Platform Admin             | Critical    |
| Any → Owner            | Platform Admin             | Critical    |
| Owner → Any            | Platform Admin + New Owner | Critical    |
| Add Compliance Role    | Compliance Admin           | High        |
| Remove Compliance Role | Compliance Admin           | High        |

---

## Glossary

| Term                   | Definition                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------- |
| **RBAC**               | Role-Based Access Control - Access control paradigm where permissions are assigned to roles |
| **ABAC**               | Attribute-Based Access Control - Access control based on attributes (value, category, time) |
| **Inheritance**        | Automatic permission transfer from parent role to child role                                |
| **Delegation**         | Temporary transfer of role permissions with audit trail                                     |
| **Scope**              | The boundary of data visibility and access for a role                                       |
| **Business Unit**      | Sub-entity within organization (location, warehouse, department)                            |
| **Approval Authority** | Maximum value or scope for which a role can approve actions                                 |
| **Multi-Tenant**       | Architecture where single instance serves multiple isolated customers                       |

---

**Document Version**: 1.0  
**Last Updated**: 2026-02-06  
**Author**: Restomarket Platform Team  
**Classification**: Internal - Implementation Reference
