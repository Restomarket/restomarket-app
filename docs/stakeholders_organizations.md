# Stakeholders & Organizational Hierarchies: Restomarket B2B Marketplace

## Executive Summary

This document provides a comprehensive analysis of **stakeholders** and **organizational structures** within the Restomarket B2B food marketplace platform. It identifies all actors across three distinct organizational domains: **Marketplace Operators** (internal platform team), **CHR Buyers** (Cafés, Hotels, Restaurants), and **Food Suppliers** (producers, distributors, wholesalers). The document details organizational hierarchies, business unit structures, and multi-tenant architecture patterns.

---

## 1. Platform Architecture Overview

### 1.1 Multi-Tenant Organizational Topology

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MARKETPLACE PLATFORM                               │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │   OPERATOR      │  │     CHR         │  │    SUPPLIER     │             │
│  │   (Internal)    │  │  Organizations  │  │  Organizations  │             │
│  │                 │  │                 │  │                 │             │
│  │ • Super Admin   │  │ • Enterprise    │  │ • Enterprise    │             │
│  │ • Operations    │  │   Restaurants   │  │   Producers     │             │
│  │ • Finance       │  │ • Hotel Chains  │  │ • Distributors  │             │
│  │ • Compliance    │  │ • Café Networks │  │ • Wholesalers   │             │
│  │ • Support       │  │ • Caterers      │  │ • Importers     │             │
│  │ • Product/Tech  │  │                 │  │                 │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
│                                                                              │
│  Cross-Cutting Concerns:                                                     │
│  • Identity Provider (IdP) Integration                                       │
│  • Audit & Compliance Logging                                                │
│  • API Gateway & Rate Limiting                                               │
│  • Payment Processing (PCI-DSS)                                              │
│  • Logistics Integration                                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Three-Tier Tenant Isolation Model

| Tier              | Scope                   | Isolation Mechanism                                             | Examples                                   |
| ----------------- | ----------------------- | --------------------------------------------------------------- | ------------------------------------------ |
| **Platform**      | Cross-tenant operations | Global admin operations, analytics, billing aggregation         | Marketplace operator team                  |
| **Organization**  | Single CHR or Supplier  | Complete data isolation between competing entities              | Individual restaurant chain, food supplier |
| **Business Unit** | Sub-entities within org | Hierarchical access (restaurant locations, supplier warehouses) | Individual restaurant location, warehouse  |

---

## 2. Marketplace Operator (Internal Platform Team)

### 2.1 Organizational Structure

**Purpose**: Internal team managing platform operations, compliance, and support.

**Structure**: Flat hierarchy with role-based separation of duties

**Key Characteristics**:

- **Platform-Global Access**: Can view cross-tenant data for administration
- **Strict Separation of Duties**: Finance cannot modify products; Support cannot approve refunds > $500
- **Audit Oversight**: All actions logged to immutable storage
- **Emergency Access**: Super Admin with break-glass protocols

### 2.2 Role Hierarchy & Inheritance

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

### 2.3 Stakeholder Roles

| Role                 | Primary Responsibilities                                               | Key Focus Areas                                                 | Constraints                                                                 |
| -------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **SUPER_ADMIN**      | Platform governance, emergency access, audit oversight                 | System-wide control, security, compliance                       | MFA required; Activity logged to immutable store; Cannot delete own account |
| **ADMIN_OPERATIONS** | Daily platform management, supplier/CHR onboarding, dispute resolution | User validation, organization approval, order intervention      | Cannot modify billing settings; Cannot access raw payment data              |
| **ADMIN_FINANCE**    | Commission management, invoicing, payout processing                    | Revenue operations, financial reporting, refund processing      | Cannot modify product data; Cannot access customer PII beyond billing       |
| **ADMIN_COMPLIANCE** | FSMA/HACCP oversight, certification verification, recall management    | Food safety, regulatory adherence, supplier audits              | Read-only on commercial transactions; Cannot modify financial settings      |
| **ADMIN_SUPPORT**    | Customer service, technical troubleshooting, training                  | Ticket management, user assistance, impersonation for debugging | Cannot approve refunds > $500; Cannot modify supplier catalogs              |
| **ADMIN_PRODUCT**    | Feature releases, system configuration, integration management         | Technical infrastructure, API gateway, feature flags            | Cannot access customer data; Cannot modify financial transactions           |
| **SYSTEM_SERVICE**   | Automated services, ETL processes, report generation                   | Background jobs, webhooks, scheduled tasks                      | Service account only; Token-based auth; IP-restricted                       |

### 2.4 Operational Scope

- **Access Scope**: Platform-wide (cross-tenant) with strict audit logging
- **Data Visibility**: Can view aggregated data across all organizations for analytics and compliance
- **Intervention Authority**: Can intervene in disputes, suspend organizations, initiate recalls
- **Financial Authority**: Manage platform commissions, process payouts, configure billing

---

## 3. CHR Organizations (Buyers)

### 3.1 Organizational Structure

**Purpose**: Hospitality businesses (restaurants, hotels, cafés, caterers) purchasing food and supplies.

**Structure**: Hierarchical with multi-location support

**Key Characteristics**:

- **Multi-Store Management**: Enterprise chains with centralized procurement and local operations
- **Approval Workflows**: Multi-tier approvals based on order value and product category
- **Budget Controls**: Role-based spending limits and threshold configurations
- **Location-Based Access**: Staff can only access their assigned locations

### 3.2 Organizational Hierarchy Model

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

**Example Structure**:

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

### 3.3 CHR Stakeholder Roles

| Role                    | Business Function                                                       | Approval Authority                    | Scope               | Typical Responsibilities                                      |
| ----------------------- | ----------------------------------------------------------------------- | ------------------------------------- | ------------------- | ------------------------------------------------------------- |
| **CHR_OWNER**           | Strategic oversight, financial ultimate authority, contract negotiation | Unlimited                             | All business units  | Business strategy, major contracts, high-value approvals      |
| **CHR_MANAGER**         | Operational management, staff supervision, budget allocation            | Up to $10,000/order                   | Assigned units      | Daily operations, staff management, local procurement         |
| **HEAD_CHEF**           | Menu planning, quality control, inventory management                    | Up to $5,000/order (ingredients only) | Assigned kitchen    | Recipe development, ingredient ordering, quality standards    |
| **PROCUREMENT_MANAGER** | Vendor selection, price negotiation, purchase orders                    | Up to $25,000/order                   | Assigned categories | Supplier relationships, contract negotiation, bulk purchasing |
| **ACCOUNTANT**          | Invoice processing, payment authorization, financial reporting          | Payment approval up to $50,000        | Financial data only | Financial reconciliation, payment processing, reporting       |
| **STAFF_OPERATOR**      | Daily ordering, receiving, inventory updates                            | Submit only (no approval)             | Assigned location   | Order creation, receiving verification, basic inventory       |

### 3.4 Multi-Store Management Patterns

**Enterprise Chains** (e.g., 50-location restaurant chain):

- **Centralized Procurement**: Enterprise-level procurement manager negotiates pricing
- **Local Operations**: Individual location managers approve daily orders within limits
- **Consolidated Ordering**: Ability to consolidate orders across multiple locations
- **Location-Specific Access**: Staff restricted to their assigned location(s)

**Approval Workflow Examples**:

| Order Value      | Product Category | Required Approvers               | Approval Type |
| ---------------- | ---------------- | -------------------------------- | ------------- |
| < $500           | Any              | Manager (auto-approved, logged)  | Any of        |
| $500 - $5,000    | Perishables      | Head Chef OR Manager             | Any of        |
| $5,000 - $25,000 | Equipment        | Procurement Manager → Accountant | Sequential    |
| > $25,000        | Any              | CHR Owner                        | Single        |

---

## 4. Supplier Organizations (Sellers)

### 4.1 Organizational Structure

**Purpose**: Food producers, distributors, wholesalers, and importers selling to CHR buyers.

**Structure**: Hierarchical with warehouse/facility-based divisions

**Key Characteristics**:

- **Multi-Warehouse Operations**: Regional warehouses with local managers
- **Lot Tracking**: FSMA 204 compliance with Critical Tracking Events (CTE)
- **Customer Management**: B2B customer relationships with credit limits
- **Compliance Focus**: HACCP plans, certifications, recall management

### 4.2 Supplier Organizational Hierarchy

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

**Example Structure**:

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

### 4.3 Supplier Stakeholder Roles

| Role                      | Business Function                                                   | Operational Scope            | Compliance Responsibility                    |
| ------------------------- | ------------------------------------------------------------------- | ---------------------------- | -------------------------------------------- |
| **SUPPLIER_OWNER**        | Business strategy, major account management, platform relationship  | All locations, all functions | Ultimate responsibility for certifications   |
| **SALES_MANAGER**         | Customer acquisition, pricing strategy, contract negotiation        | Customer-facing operations   | Customer allergen communication              |
| **INVENTORY_MANAGER**     | Stock control, lot tracking, warehouse operations                   | All warehouses               | Lot traceability, recall execution           |
| **WAREHOUSE_MANAGER**     | Specific facility operations, picking, shipping                     | Assigned warehouse           | Temperature logs, sanitation records         |
| **PRODUCTION_MANAGER**    | Manufacturing, batch control, quality testing                       | Production facilities        | HACCP plan implementation                    |
| **LOGISTICS_COORDINATOR** | Route planning, delivery scheduling, carrier management             | Transportation network       | Sanitary transport compliance                |
| **FINANCE_MANAGER**       | Invoicing, payment processing, credit management                    | Financial operations         | Tax documentation, audit trails              |
| **QUALITY_ASSURANCE**     | Certification management, supplier audits, compliance documentation | Quality systems              | FSMA preventive controls, third-party audits |
| **CUSTOMER_REP**          | Order support, issue resolution, relationship management            | Assigned accounts            | Customer complaint handling                  |

### 4.4 Sub-Store Management (Multi-Warehouse)

**Sub-Store Structure**:

- **Supplier Owner**: Full access to all sub-stores and warehouses
- **Store Manager**: Manages specific warehouse/sub-store with isolated inventory
- **Product Manager**: Manages product catalog across all locations
- **Logistics Coordinator**: Coordinates delivery across regional warehouses

**Sub-Store Characteristics**:

- Each sub-store has isolated inventory management
- Shared product catalog across all sub-stores
- Store-specific managers with limited scope
- Centralized pricing and promotion management

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

## 6. External Stakeholders

### 6.1 Delivery Platform Team

**Purpose**: Dedicated delivery/logistics team managing order fulfillment

**Roles**:

- **Delivery Admin**: Manages delivery operations, costs, and tracking
- **Delivery Team**: Drivers and logistics coordinators tracking deliveries

**Access**:

- View delivery assignments and routes
- Update delivery status and tracking information
- No access to pricing, financial data, or product catalogs

### 6.2 External Integration Partners

| Partner Type             | Integration Purpose                  | Data Access                                   |
| ------------------------ | ------------------------------------ | --------------------------------------------- |
| **Payment Gateways**     | Process payments (CMI API, NAPS)     | Transaction data only (PCI-DSS compliant)     |
| **Logistics Providers**  | Real-time delivery tracking          | Shipment data, delivery addresses             |
| **ERP Systems**          | Accounting and inventory sync        | Invoice data, stock levels (tenant-specific)  |
| **Compliance Platforms** | FSMA, HACCP documentation            | Certification data, audit logs                |
| **AI/ML Services**       | Product recommendations, forecasting | Anonymized transaction data, product metadata |

---

## 7. Organizational Type Comparison

### 7.1 Structural Comparison

| Aspect                 | Marketplace Operator           | CHR Organizations                | Supplier Organizations            |
| ---------------------- | ------------------------------ | -------------------------------- | --------------------------------- |
| **Hierarchy Type**     | Flat (role-based)              | Hierarchical (multi-location)    | Hierarchical (multi-warehouse)    |
| **Tenant Scope**       | Platform-wide                  | Organization-scoped              | Organization-scoped               |
| **Business Units**     | Departments (Finance, Support) | Locations (Restaurants, Hotels)  | Warehouses, Production Facilities |
| **Primary Focus**      | Platform operations            | Procurement and consumption      | Production and distribution       |
| **Approval Workflows** | Separation of duties           | Multi-tier order approvals       | Quality control and compliance    |
| **Compliance Focus**   | Platform security, PCI-DSS     | Food safety, receiving standards | FSMA 204, HACCP, lot traceability |

### 7.2 Role Count by Organization Type

| Organization Type         | Typical Role Count | Example Roles                                                                        |
| ------------------------- | ------------------ | ------------------------------------------------------------------------------------ |
| **Marketplace Operator**  | 6-7 roles          | Super Admin, Operations, Finance, Compliance, Support, Product                       |
| **CHR (Small)**           | 2-3 roles          | Owner, Manager, Staff                                                                |
| **CHR (Enterprise)**      | 5-6 roles          | Owner, Manager, Head Chef, Procurement Manager, Accountant, Staff                    |
| **Supplier (Small)**      | 2-3 roles          | Owner, Sales Manager, Warehouse Manager                                              |
| **Supplier (Enterprise)** | 8-9 roles          | Owner, Sales, Inventory, Warehouse, Production, Logistics, Finance, QA, Customer Rep |

---

## 8. Organizational Hierarchy Patterns

### 8.1 Single-Location vs. Multi-Location

**Single-Location CHR** (e.g., independent restaurant):

- Flat structure with Owner, Manager, and Staff
- No location-based access restrictions
- Simplified approval workflows

**Multi-Location CHR** (e.g., hotel chain):

- Hierarchical structure with enterprise-level roles
- Location-based access controls for staff
- Consolidated ordering capabilities
- Complex approval workflows based on value and category

### 8.2 Single-Warehouse vs. Multi-Warehouse Suppliers

**Single-Warehouse Supplier** (e.g., local producer):

- Simplified structure with Owner, Sales, and Operations
- No warehouse-specific access controls
- Direct inventory management

**Multi-Warehouse Supplier** (e.g., national distributor):

- Complex hierarchy with regional divisions
- Warehouse-specific managers with scoped access
- Centralized product catalog with distributed inventory
- Lot tracking across multiple facilities

---

## 9. Stakeholder Summary Tables

### 9.1 All Stakeholder Roles by Organization Type

#### Marketplace Operator Roles

| Role             | Count | Primary Function          | Access Scope    |
| ---------------- | ----- | ------------------------- | --------------- |
| Super Admin      | 1-2   | Platform governance       | Platform-wide   |
| Operations Admin | 2-5   | Daily platform management | Platform-wide   |
| Finance Admin    | 1-3   | Commission and billing    | Financial only  |
| Compliance Admin | 1-2   | Regulatory oversight      | Compliance only |
| Support Agent    | 5-20  | Customer service          | Support scope   |
| Product/Tech     | 2-10  | Technical infrastructure  | System config   |

#### CHR Organization Roles

| Role                | Count per Org | Primary Function       | Access Scope       |
| ------------------- | ------------- | ---------------------- | ------------------ |
| CHR Owner           | 1             | Strategic oversight    | All business units |
| CHR Manager         | 1-50          | Operational management | Assigned units     |
| Head Chef           | 1-50          | Menu and quality       | Assigned kitchen   |
| Procurement Manager | 1-5           | Vendor management      | Procurement scope  |
| Accountant          | 1-3           | Financial operations   | Financial data     |
| Staff Operator      | 5-500         | Daily operations       | Assigned location  |

#### Supplier Organization Roles

| Role                  | Count per Org | Primary Function       | Access Scope          |
| --------------------- | ------------- | ---------------------- | --------------------- |
| Supplier Owner        | 1             | Business strategy      | All locations         |
| Sales Manager         | 1-10          | Customer acquisition   | Customer-facing       |
| Inventory Manager     | 1-5           | Stock control          | All warehouses        |
| Warehouse Manager     | 1-20          | Facility operations    | Assigned warehouse    |
| Production Manager    | 1-5           | Manufacturing          | Production facilities |
| Logistics Coordinator | 1-10          | Delivery coordination  | Transportation        |
| Finance Manager       | 1-3           | Invoicing and payments | Financial operations  |
| Quality Assurance     | 1-5           | Compliance management  | Quality systems       |
| Customer Rep          | 2-50          | Account management     | Assigned accounts     |

### 9.2 Organizational Complexity Matrix

| Organization Type        | Size Category | Typical Users | Business Units  | Complexity Level |
| ------------------------ | ------------- | ------------- | --------------- | ---------------- |
| **Marketplace Operator** | N/A           | 10-100        | 6 departments   | High             |
| **CHR - Independent**    | Small         | 2-10          | 1 location      | Low              |
| **CHR - Chain**          | Medium        | 20-100        | 5-20 locations  | Medium           |
| **CHR - Enterprise**     | Large         | 100-1000      | 50+ locations   | High             |
| **Supplier - Local**     | Small         | 3-15          | 1 warehouse     | Low              |
| **Supplier - Regional**  | Medium        | 20-100        | 3-10 warehouses | Medium           |
| **Supplier - National**  | Large         | 100-500       | 20+ warehouses  | High             |

---

## 10. Key Organizational Characteristics

### 10.1 Marketplace Operator Characteristics

- **Flat hierarchy** with strict separation of duties
- **Cross-tenant visibility** for administration and support
- **Compliance-focused** with audit oversight
- **Emergency access protocols** for critical situations
- **Service account automation** for background processes

### 10.2 CHR Organization Characteristics

- **Hierarchical approval workflows** based on order value
- **Multi-location support** with consolidated ordering
- **Budget controls** and spending limits per role
- **Location-based access restrictions** for staff
- **Financial separation** between ordering and payment approval

### 10.3 Supplier Organization Characteristics

- **Warehouse-based divisions** with local managers
- **Compliance-heavy** with FSMA 204 and HACCP requirements
- **Lot tracking** and traceability across facilities
- **Customer relationship management** with credit controls
- **Quality assurance** and certification management

---

## Glossary

| Term                  | Definition                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------- |
| **CHR**               | Cafés, Hôtels, Restaurants - The hospitality industry sector (French acronym)               |
| **Multi-Tenant**      | Software architecture where a single instance serves multiple customers with data isolation |
| **Business Unit**     | Sub-entity within an organization (e.g., restaurant location, warehouse)                    |
| **FSMA 204**          | FDA Food Safety Modernization Act Section 204 - Food traceability regulation                |
| **HACCP**             | Hazard Analysis and Critical Control Points - Food safety management system                 |
| **Lot Tracking**      | Traceability of food batches through the supply chain                                       |
| **Sub-Store**         | Warehouse or distribution point managed by a supplier organization                          |
| **Approval Workflow** | Multi-step process requiring different roles to approve actions based on business rules     |

---

**Document Version**: 1.0  
**Last Updated**: 2026-02-05  
**Author**: Restomarket Platform Team  
**Classification**: Internal - Implementation Reference
