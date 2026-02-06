# RBAC Introduction: Restomarket B2B Marketplace

## Executive Summary

This document provides a comprehensive introduction to the Role-Based Access Control (RBAC) architecture for the **Restomarket** B2B food marketplace platform. It defines the project scope, core objectives, RBAC design principles, and the multi-tenant organizational structure that governs access control across three distinct actor domains: **Marketplace Operators**, **CHR Buyers** (Cafés, Hotels, Restaurants), and **Food Suppliers**.

---

## 1. Project Scope and Context

### 1.1 Platform Overview

**Restomarket** is a multi-tenant B2B digital marketplace designed to connect the hospitality and food service industry (CHR sector) with food suppliers, distributors, and producers. The platform facilitates:

- **Product Discovery**: Advanced search, categorization, and AI-driven product recommendations
- **Procurement Workflows**: Multi-tier approval processes, order consolidation, and threshold management
- **Supply Chain Operations**: Inventory management, lot tracking, delivery coordination, and logistics integration
- **Financial Transactions**: Secure payments, invoicing, credit management, and wallet systems
- **Compliance Management**: FSMA 204 traceability, HACCP documentation, allergen tracking, and regulatory reporting
- **Business Intelligence**: Analytics dashboards, KPI tracking, and export capabilities

### 1.2 Business Context

The platform operates in a **highly regulated food industry environment** where:

- **Food Safety Compliance** is mandatory (FDA FSMA, HACCP, sanitation controls)
- **Financial Integrity** requires separation of duties (SOX compliance, PCI-DSS for payments)
- **Multi-Tenant Isolation** is critical (competitive suppliers must not access each other's data)
- **Hierarchical Organizations** need granular permissions (enterprise chains with multiple locations)
- **Audit Trails** must be immutable and comprehensive for regulatory inspections

### 1.3 Technical Architecture

The RBAC system is built on **Better-Auth v1.4.18**, a TypeScript authentication framework that provides:

- **Organization Plugin**: Multi-tenant organization management with member roles and invitations
- **Admin Plugin**: Platform-level administration for marketplace operators
- **Access Control System**: Granular permission definitions with dynamic role assignment
- **Hooks and Extensions**: Custom business logic for validation, approval workflows, and compliance

---

## 2. Core Objectives

### 2.1 Security Objectives

| Objective                | Description                                                | Implementation                                                 |
| ------------------------ | ---------------------------------------------------------- | -------------------------------------------------------------- |
| **Data Isolation**       | Ensure complete separation between competing organizations | Tenant-scoped queries, organization-level access controls      |
| **Least Privilege**      | Grant minimum permissions necessary for job functions      | Granular permission definitions, role-based restrictions       |
| **Separation of Duties** | Prevent single-user fraud through multi-step approvals     | Order creation → Approval → Payment → Reconciliation workflows |
| **Audit Compliance**     | Maintain immutable logs of all access decisions            | Tamper-proof audit logging with user attribution               |
| **Credential Security**  | Protect authentication credentials and API keys            | Two-factor authentication, encrypted storage, token rotation   |

### 2.2 Operational Objectives

| Objective                 | Description                                               | Business Value                                              |
| ------------------------- | --------------------------------------------------------- | ----------------------------------------------------------- |
| **Scalability**           | Support thousands of organizations with millions of users | Efficient permission caching, hierarchical role inheritance |
| **Flexibility**           | Allow custom roles and dynamic permission assignment      | Runtime role creation, metadata-driven permissions          |
| **User Experience**       | Minimize friction while maintaining security              | Context-aware UI, role-based feature visibility             |
| **Onboarding Efficiency** | Streamline new organization setup                         | Default role templates, automated organization creation     |
| **Operational Clarity**   | Clear role definitions aligned with business functions    | Business-friendly role names, comprehensive documentation   |

### 2.3 Compliance Objectives

| Regulation   | Requirement                                               | RBAC Implementation                                            |
| ------------ | --------------------------------------------------------- | -------------------------------------------------------------- |
| **FSMA 204** | Food traceability with Critical Tracking Events (CTE)     | `lot:trace`, `lot:create` permissions with immutable logging   |
| **HACCP**    | Hazard Analysis and Critical Control Points documentation | `haccp_plan:view`, `monitoring_record:create` permissions      |
| **PCI-DSS**  | Payment card data protection                              | Restricted `payment:process` permissions, encrypted storage    |
| **SOX**      | Financial controls and audit trails                       | Separation of duties, immutable financial transaction logs     |
| **GDPR**     | Data privacy and user consent management                  | `user:delete`, `data:export` permissions with consent tracking |

---

## 3. RBAC Design Principles

### 3.1 Multi-Tenant Architecture

The platform implements a **three-tier tenant isolation model**:

```
┌─────────────────────────────────────────────────────────────┐
│                    PLATFORM TIER                            │
│  Global operations, cross-tenant analytics, billing         │
│  Roles: Super Admin, Operations Admin, Finance, Compliance  │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┴───────────────────┐
        │                                       │
┌───────▼────────────┐                 ┌───────▼────────────┐
│ ORGANIZATION TIER  │                 │ ORGANIZATION TIER  │
│  CHR Buyers        │                 │  Food Suppliers    │
│  (Tenant-scoped)   │                 │  (Tenant-scoped)   │
└───────┬────────────┘                 └───────┬────────────┘
        │                                       │
┌───────▼────────────┐                 ┌───────▼────────────┐
│ BUSINESS UNIT TIER │                 │ BUSINESS UNIT TIER │
│  Locations, Stores │                 │  Warehouses, Plants│
│  (Sub-tenant scope)│                 │  (Sub-tenant scope)│
└────────────────────┘                 └────────────────────┘
```

### 3.2 Role Hierarchy and Inheritance

Roles follow a **hierarchical inheritance model** where higher-level roles inherit permissions from lower-level roles:

```
Owner (Full Access)
  ├── Manager (Operational Control)
  │     ├── Supervisor (Team Management)
  │     │     └── Staff (Basic Operations)
  │     └── Specialist (Domain-Specific)
  └── Administrator (Technical/System)
```

**Inheritance Rules**:

- Child roles inherit all parent permissions
- Additional permissions can be granted at any level
- Permissions can be restricted via conditions (ABAC)
- Delegation allows temporary elevation with audit trails

### 3.3 Permission Granularity

Permissions are defined using a **resource:action** pattern with optional conditions:

| Component     | Description                   | Example                                                      |
| ------------- | ----------------------------- | ------------------------------------------------------------ |
| **Resource**  | The entity being accessed     | `order`, `product`, `invoice`, `user`                        |
| **Action**    | The operation being performed | `create`, `read`, `update`, `delete`, `approve`              |
| **Scope**     | Visibility boundary           | `own`, `team`, `business_unit`, `organization`, `platform`   |
| **Condition** | Attribute-based restrictions  | `order.total < $10,000`, `product.category == 'perishables'` |

**Example Permission Definitions**:

- `order:create` - Create new orders
- `order:approve` with condition `order.total < $5,000` - Approve orders under $5K
- `inventory:view` with scope `business_unit` - View inventory for assigned warehouse only
- `user:impersonate` - Impersonate users for support troubleshooting

### 3.4 Three-Dimensional Access Control

The RBAC model implements **three dimensions** of access control:

#### Dimension 1: Horizontal (Resource Type)

What types of entities can be accessed: Users, Products, Orders, Invoices, Reports, etc.

#### Dimension 2: Vertical (Action Type)

What operations can be performed: Create, Read, Update, Delete, Approve, Export, Configure

#### Dimension 3: Depth (Scope/Visibility)

What range of data is accessible: Own records, Team, Business Unit, Organization, Platform-wide

**Example**: A **Head Chef** can **UPDATE** (vertical) **ORDERS** (horizontal) but only for **OWN RECORDS** (depth) up to **$5,000** (conditional attribute).

### 3.5 Attribute-Based Access Control (ABAC) Extensions

For complex B2B scenarios, the RBAC model incorporates **attribute-based conditions**:

| Condition Type  | Description               | Example                                                         |
| --------------- | ------------------------- | --------------------------------------------------------------- |
| **Temporal**    | Time-based restrictions   | `order:approve` only during business hours (6AM-10PM)           |
| **Monetary**    | Value-based thresholds    | `order:approve` where `order.total < $10,000`                   |
| **Geographic**  | Location-based scope      | `inventory:view` for `warehouse.region == user.assigned_region` |
| **Categorical** | Product-type restrictions | `order:approve` for `product.category != 'alcohol'`             |
| **Relational**  | Relationship-based        | `customer:view` for `customer.assigned_rep == user.id`          |

---

## 4. Organization Types and Structures

### 4.1 Marketplace Operator (Internal Platform Team)

**Purpose**: Internal team managing platform operations, compliance, and support.

**Organizational Structure**: Flat hierarchy with role-based separation of duties

**Key Characteristics**:

- **Platform-Global Access**: Can view cross-tenant data for administration
- **Strict Separation of Duties**: Finance cannot modify products; Support cannot approve refunds > $500
- **Audit Oversight**: All actions logged to immutable storage
- **Emergency Access**: Super Admin with break-glass protocols

**Core Roles**:

| Role                 | Primary Responsibilities                                  | Key Permissions                                                      |
| -------------------- | --------------------------------------------------------- | -------------------------------------------------------------------- |
| **Super Admin**      | Platform governance, emergency access, audit oversight    | `*:*` (all resources, all actions)                                   |
| **Operations Admin** | Daily platform management, onboarding, dispute resolution | `user:manage`, `organization:validate`, `order:intervene`            |
| **Finance Admin**    | Commission management, invoicing, payout processing       | `billing:manage`, `commission:configure`, `refund:approve`           |
| **Compliance Admin** | FSMA/HACCP oversight, certification verification, recalls | `certification:audit`, `recall:initiate`, `audit_log:view`           |
| **Support Agent**    | Customer service, troubleshooting, training               | `support_ticket:manage`, `user:read`, `impersonate:user`             |
| **Product/Tech**     | Feature releases, system configuration, integrations      | `feature_flag:manage`, `integration:configure`, `api_gateway:manage` |

**Access Scope**: Platform-wide (cross-tenant) with strict audit logging

---

### 4.2 CHR Organizations (Buyers)

**Purpose**: Hospitality businesses (restaurants, hotels, cafés, caterers) purchasing food and supplies.

**Organizational Structure**: Hierarchical with multi-location support

**Key Characteristics**:

- **Multi-Store Management**: Enterprise chains with centralized procurement and local operations
- **Approval Workflows**: Multi-tier approvals based on order value and product category
- **Budget Controls**: Role-based spending limits and threshold configurations
- **Location-Based Access**: Staff can only access their assigned locations

**Organizational Model**:

```
CHR Enterprise (Holding Company)
├── Restaurant Location A (Downtown)
│   ├── Kitchen Staff
│   ├── Manager
│   └── Chef
├── Restaurant Location B (Airport)
│   ├── Kitchen Staff
│   └── Manager
└── Catering Division
    ├── Procurement Manager
    └── Operations Team
```

**Core Roles**:

| Role                    | Business Function                                              | Approval Authority                    | Scope               |
| ----------------------- | -------------------------------------------------------------- | ------------------------------------- | ------------------- |
| **CHR Owner**           | Strategic oversight, financial authority, contract negotiation | Unlimited                             | All business units  |
| **CHR Manager**         | Operational management, staff supervision, budget allocation   | Up to $10,000/order                   | Assigned units      |
| **Head Chef**           | Menu planning, quality control, inventory management           | Up to $5,000/order (ingredients only) | Assigned kitchen    |
| **Procurement Manager** | Vendor selection, price negotiation, purchase orders           | Up to $25,000/order                   | Assigned categories |
| **Accountant**          | Invoice processing, payment authorization, financial reporting | Payment approval up to $50,000        | Financial data only |
| **Staff Operator**      | Daily ordering, receiving, inventory updates                   | Submit only (no approval)             | Assigned location   |

**Approval Workflow Example**:

| Order Value      | Product Category | Required Approvers               | Approval Type |
| ---------------- | ---------------- | -------------------------------- | ------------- |
| < $500           | Any              | Manager (auto-approved, logged)  | Any of        |
| $500 - $5,000    | Perishables      | Head Chef OR Manager             | Any of        |
| $5,000 - $25,000 | Equipment        | Procurement Manager → Accountant | Sequential    |
| > $25,000        | Any              | CHR Owner                        | Single        |

**Access Scope**: Organization-scoped with business unit restrictions

---

### 4.3 Supplier Organizations (Sellers)

**Purpose**: Food producers, distributors, wholesalers, and importers selling to CHR buyers.

**Organizational Structure**: Hierarchical with warehouse/facility-based divisions

**Key Characteristics**:

- **Multi-Warehouse Operations**: Regional warehouses with local managers
- **Lot Tracking**: FSMA 204 compliance with Critical Tracking Events (CTE)
- **Customer Management**: B2B customer relationships with credit limits
- **Compliance Focus**: HACCP plans, certifications, recall management

**Organizational Model**:

```
Supplier Organization (Food Distributor)
├── Headquarters (Admin)
│   ├── Sales Team
│   ├── Finance Department
│   └── Quality Assurance
├── Regional Warehouse A
│   ├── Warehouse Manager
│   ├── Inventory Team
│   └── Logistics Coordinator
├── Regional Warehouse B
│   └── Warehouse Manager
└── Production Facility
    ├── Production Manager
    └── Quality Control
```

**Core Roles**:

| Role                      | Business Function                                            | Operational Scope            | Compliance Responsibility                    |
| ------------------------- | ------------------------------------------------------------ | ---------------------------- | -------------------------------------------- |
| **Supplier Owner**        | Business strategy, major accounts, platform relationship     | All locations, all functions | Ultimate responsibility for certifications   |
| **Sales Manager**         | Customer acquisition, pricing strategy, contract negotiation | Customer-facing operations   | Customer allergen communication              |
| **Inventory Manager**     | Stock control, lot tracking, warehouse operations            | All warehouses               | Lot traceability, recall execution           |
| **Warehouse Manager**     | Specific facility operations, picking, shipping              | Assigned warehouse           | Temperature logs, sanitation records         |
| **Production Manager**    | Manufacturing, batch control, quality testing                | Production facilities        | HACCP plan implementation                    |
| **Logistics Coordinator** | Route planning, delivery scheduling, carrier management      | Transportation network       | Sanitary transport compliance                |
| **Finance Manager**       | Invoicing, payment processing, credit management             | Financial operations         | Tax documentation, audit trails              |
| **Quality Assurance**     | Certification management, supplier audits, compliance docs   | Quality systems              | FSMA preventive controls, third-party audits |
| **Customer Rep**          | Order support, issue resolution, relationship management     | Assigned accounts            | Customer complaint handling                  |

**Compliance Focus Areas**:

| Compliance Area           | Required Permissions                          | Responsible Roles                        |
| ------------------------- | --------------------------------------------- | ---------------------------------------- |
| **FSMA 204 Traceability** | `lot:create`, `lot:trace`, `shipment:track`   | Inventory Manager, QA, Warehouse Manager |
| **HACCP Documentation**   | `haccp_plan:view`, `monitoring_record:create` | Production Manager, QA                   |
| **Recall Management**     | `recall:initiate`, `customer:notify`          | QA, Supplier Owner, Compliance Admin     |
| **Supplier Verification** | `certification:upload`, `certification:audit` | QA, Compliance Admin                     |

**Access Scope**: Organization-scoped with warehouse/facility restrictions

---

## 5. Cross-Organizational Interactions

### 5.1 Controlled Cross-Tenant Access

While organizations are isolated, certain interactions require **controlled cross-tenant access**:

| Interaction            | Actors                            | Access Mechanism                                                        |
| ---------------------- | --------------------------------- | ----------------------------------------------------------------------- |
| **Order Fulfillment**  | CHR Buyer → Supplier              | Supplier can view/update orders placed by CHR (read-only customer data) |
| **Dispute Resolution** | CHR/Supplier → Platform Support   | Support Agent can impersonate users and view cross-tenant order details |
| **Compliance Audits**  | Supplier → Platform Compliance    | Compliance Admin can audit supplier certifications and lot records      |
| **Payment Processing** | CHR → Supplier → Platform Finance | Finance Admin can view transaction details for commission calculation   |

### 5.2 Data Sharing Boundaries

| Data Type            | CHR Access                      | Supplier Access              | Platform Access                 |
| -------------------- | ------------------------------- | ---------------------------- | ------------------------------- |
| **Product Catalog**  | View all published catalogs     | Manage own catalog only      | View all, configure categories  |
| **Order Details**    | View/manage own orders          | View orders placed with them | View all for support/analytics  |
| **Pricing**          | View applicable prices          | Manage own pricing           | View for commission calculation |
| **Inventory Levels** | View supplier stock (if shared) | Manage own inventory         | No access (privacy)             |
| **Financial Data**   | View own invoices/payments      | View own invoices/payments   | Aggregated analytics only       |
| **Compliance Docs**  | View supplier certifications    | Manage own certifications    | Audit all for compliance        |

---

## 6. Implementation Approach

### 6.1 Technology Stack

- **Authentication Framework**: Better-Auth v1.4.18
- **Database**: PostgreSQL with Prisma ORM
- **Backend**: NestJS (TypeScript)
- **Frontend**: Next.js with React
- **Session Management**: JWT tokens with cookie-based caching
- **Audit Logging**: Immutable append-only logs with partitioning

### 6.2 Permission Evaluation Flow

```
User Request → Authentication → Tenant Isolation → Role Resolution
→ Permission Evaluation → Resource Scope Check → Audit Logging
→ [ALLOW] or [DENY]
```

### 6.3 Key Design Decisions

| Decision                                      | Rationale                                                                                               |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Use Organization Plugin for Multi-Tenancy** | Better-Auth's organization plugin provides built-in member management, invitations, and role assignment |
| **Use Admin Plugin for Platform-Level RBAC**  | Separate platform administration from tenant-level operations                                           |
| **Enable Dynamic Access Control**             | Allow runtime role creation for custom organizational needs                                             |
| **Implement Approval Workflows**              | Support complex multi-tier approval processes based on business rules                                   |
| **Enforce Server-Side Validation**            | All permission checks happen server-side; client-side is for UX only                                    |
| **Immutable Audit Logs**                      | Compliance requires tamper-proof logging of all access decisions                                        |

---

## 7. Success Criteria

### 7.1 Security Metrics

- ✅ Zero cross-tenant data leakage incidents
- ✅ 100% of privileged actions logged to immutable audit store
- ✅ MFA enforcement for all admin and supplier owner accounts
- ✅ Quarterly access recertification for all admin roles
- ✅ Annual penetration testing with zero critical findings

### 7.2 Operational Metrics

- ✅ < 5 minutes average time to onboard new organization
- ✅ < 2 seconds permission evaluation latency (p95)
- ✅ Support for 10,000+ organizations with 100,000+ users
- ✅ 99.9% uptime for authentication services
- ✅ < 1% user-reported permission errors (false positives/negatives)

### 7.3 Compliance Metrics

- ✅ 100% FSMA 204 traceability for all food products
- ✅ PCI-DSS Level 1 certification for payment processing
- ✅ SOX compliance for financial controls
- ✅ GDPR compliance for user data management
- ✅ Successful regulatory audits with zero findings

---

## 8. Next Steps

This introduction provides the foundation for the detailed RBAC implementation. The following documents provide comprehensive specifications:

1. **[roles_permissions.md](file:///Users/yonko/restomarket-app/docs/roles_permissions.md)** - Complete role definitions, permission matrices, and implementation code
2. **Database Schema Design** - Prisma models for roles, permissions, and audit logs
3. **API Integration Guide** - Middleware implementation and route protection patterns
4. **Frontend Component Library** - Role-aware UI components and permission gates
5. **Testing Strategy** - Comprehensive test matrix for all role/resource combinations
6. **Onboarding Documentation** - Customer-facing role descriptions and setup guides

---

## Glossary

| Term                     | Definition                                                                                                                   |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| **RBAC**                 | Role-Based Access Control - Access control paradigm where permissions are assigned to roles, and roles are assigned to users |
| **ABAC**                 | Attribute-Based Access Control - Access control based on attributes of users, resources, and environment                     |
| **CHR**                  | Cafés, Hôtels, Restaurants - The hospitality industry sector (French acronym)                                                |
| **FSMA 204**             | FDA Food Safety Modernization Act Section 204 - Food traceability regulation                                                 |
| **HACCP**                | Hazard Analysis and Critical Control Points - Food safety management system                                                  |
| **CTE**                  | Critical Tracking Event - Key points in food supply chain requiring traceability                                             |
| **Multi-Tenant**         | Software architecture where a single instance serves multiple customers (tenants) with data isolation                        |
| **Least Privilege**      | Security principle of granting minimum permissions necessary for job function                                                |
| **Separation of Duties** | Security control requiring multiple people to complete critical tasks                                                        |
| **Immutable Audit Log**  | Tamper-proof log of system events that cannot be modified or deleted                                                         |

---

**Document Version**: 1.0  
**Last Updated**: 2026-02-05  
**Author**: Restomarket Platform Team  
**Classification**: Internal - Implementation Reference
