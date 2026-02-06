## RBAC Configuration Using Better-Auth (v1.4.18)

Based on the functional specifications for the Restomarkets application, I'll outline a best-practice implementation of Role-Based Access Control (RBAC) using the latest stable version of Better-Auth (v1.4.18 as of January 29, 2026). Better-Auth is a TypeScript authentication framework that supports RBAC through its **admin plugin** for platform-level administration and the **organization plugin** for multi-tenant setups like CHR clients (with roles such as Manager, Chef, etc.) and suppliers (with sub-stores and managers).

### Key Decisions and Best Practices

- **Use Organization Plugin for Multi-Tenancy**: The specs describe CHR clients as companies with multiple profiles (e.g., Manager with full access, Chef with limited access). Suppliers can have sub-stores with designated managers. This fits perfectly as "organizations" in Better-Auth, where members can be invited and assigned roles. Enable **dynamic access control** to allow creating/updating roles at runtime (e.g., admins adding custom sub-roles). Use **teams mode** (via configuration) for supplier sub-stores, treating them as sub-teams within a supplier organization.
- **Use Admin Plugin for Platform-Level RBAC**: For the Marketplace Administrator and Delivery Platform Administrator, use the admin plugin to define global roles with permissions for overseeing all organizations (e.g., validating registrations, managing data configs).
- **Permissions Definition**: Define permissions as "statements" (actions on resources, e.g., "orders:create", "products:manage"). Map them to roles based on the specs' authorization table (e.g., Manager can manage authorizations, but Chef cannot).
- **Plugins Needed**:
  - **Organization Plugin**: For client/supplier orgs, member invites, roles per org.
  - **Admin Plugin**: For platform admins, integrated with access control.
  - No additional plugins required (e.g., no rate-limiter unless specified; email/sms for OTP is built-in).
- **Best Practices**:
  - **Security**: Use two-factor authentication (built-in) for admins and suppliers. Enforce role assignments server-side via hooks (e.g., during signup, assign default role).
  - **Scalability**: Use Prisma adapter for database (as specs imply relational DB). Enable caching for sessions and roles.
  - **Onboarding**: After signup, use hooks to create an organization automatically for new CHR clients/suppliers and assign the creator as "manager".
  - **Dynamic Roles**: Enable for flexibility (e.g., admins creating new sectors/sub-roles).
  - **Auditing**: Use database hooks for logging role changes.
  - **Client-Side**: Use Better-Auth's client plugins for React/Next.js to check permissions (e.g., `hasPermission("orders:validate")`).
  - **Environment**: Assume Next.js setup; use environment variables for secrets (e.g., database URL).
- **Assumptions**: Database uses Prisma (common with Better-Auth). Extend schemas for custom fields (e.g., ICE number for companies).

### Step 1: Installation

Install Better-Auth and required packages:

```
npm install better-auth@1.4.18
npm install prisma --save-dev  # For database adapter
npx prisma init
npx better-auth migrate  # Migrate schemas (includes org tables)
```

### Step 2: Define Permissions and Roles

Create a `permissions.ts` file to define access control statements and roles based on specs.

```typescript
// permissions.ts
import { createAccessControl } from 'better-auth/plugins/access';

// Define permission statements (resources:actions) based on specs
const statements = {
  // CHR Client Features (from FC1-FC17 table)
  registration: ['create', 'manage'], // Manager only
  authorizations: ['manage'], // Manager only
  categories: ['explore'],
  search: ['advanced'],
  wishlist: ['manage'],
  products: ['suggest', 'addToCart', 'manage'],
  orders: ['validate', 'track', 'configureThreshold'],
  payments: ['secureOnline', 'onDelivery', 'byCheck', 'onAccount', 'wallet'],
  delivery: ['chooseMethod'],
  recipes: ['share', 'view'],
  loyalty: ['program'],
  kpi: ['purchaseHistory', 'orderStatus', 'loyaltyPoints'],
  account: ['settings'],
  chat: ['live'],
  faq: ['view'],
  reception: ['verify'],
  returns: ['manage'], // Manager only

  // Supplier Back-Office Features (from FC1-FC12)
  store: ['customize'],
  productsSupplier: ['add', 'manage', 'inventory', 'rates'],
  subStores: ['create', 'manage'],
  promotions: ['create', 'manage'],
  ordersSupplier: ['view', 'manage', 'notify'],
  vouchers: ['generate'],
  customersSupplier: ['manage', 'invite'],
  deliverySupplier: ['configure'],
  dashboardSupplier: ['view'],
  alerts: ['purchaseFrequency'],

  // Admin Features (from FC1-FC7)
  registrationsAdmin: ['manage'],
  requests: ['client', 'supplier'],
  emails: ['configure'],
  data: ['configure'], // Categories, VAT, sectors
  dashboardAdmin: ['view'],
  deliveryCosts: ['manage'],

  // Delivery Features
  deliveries: ['manage', 'track'],
} as const;

const ac = createAccessControl(statements);

// Define roles for CHR Client Orgs (based on specs table)
export const clientRoles = {
  manager: ac.newRole({
    registration: ['create', 'manage'],
    authorizations: ['manage'],
    categories: ['explore'],
    search: ['advanced'],
    wishlist: ['manage'],
    products: ['suggest', 'addToCart', 'manage'],
    orders: ['validate', 'track', 'configureThreshold'],
    payments: ['secureOnline', 'onDelivery', 'byCheck', 'onAccount', 'wallet'],
    delivery: ['chooseMethod'],
    recipes: ['share', 'view'],
    loyalty: ['program'],
    kpi: ['purchaseHistory', 'orderStatus', 'loyaltyPoints'],
    account: ['settings'],
    chat: ['live'],
    faq: ['view'],
    reception: ['verify'],
    returns: ['manage'],
  }),
  chef: ac.newRole({
    categories: ['explore'],
    search: ['advanced'],
    wishlist: ['manage'],
    products: ['suggest', 'addToCart', 'manage'],
    orders: ['validate', 'track'],
    delivery: ['chooseMethod'],
    recipes: ['share', 'view'],
    loyalty: ['program'],
    kpi: ['purchaseHistory'],
    account: ['settings'],
    chat: ['live'],
    faq: ['view'],
    reception: ['verify'],
  }),
  purchasingManager: ac.newRole({
    categories: ['explore'],
    search: ['advanced'],
    wishlist: ['manage'],
    products: ['suggest', 'addToCart', 'manage'],
    orders: ['validate', 'track'],
    payments: ['secureOnline', 'onDelivery', 'byCheck', 'onAccount'],
    delivery: ['chooseMethod'],
    recipes: ['share', 'view'],
    loyalty: ['program'],
    kpi: ['purchaseHistory', 'orderStatus', 'loyaltyPoints'],
    account: ['settings'],
    chat: ['live'],
    faq: ['view'],
    reception: ['verify'],
  }),
  cfoAccountant: ac.newRole({
    categories: ['explore'],
    search: ['advanced'],
    wishlist: ['manage'],
    products: ['suggest', 'addToCart', 'manage'],
    orders: ['validate', 'track'],
    payments: ['secureOnline', 'onDelivery', 'byCheck', 'onAccount'],
    delivery: ['chooseMethod'],
    recipes: ['share', 'view'],
    loyalty: ['program'],
    kpi: ['purchaseHistory', 'orderStatus', 'loyaltyPoints'],
    account: ['settings'],
    chat: ['live'],
    faq: ['view'],
    reception: ['verify'],
  }),
};

// Define roles for Supplier Orgs
export const supplierRoles = {
  supplierAdmin: ac.newRole({
    store: ['customize'],
    productsSupplier: ['add', 'manage', 'inventory', 'rates'],
    subStores: ['create', 'manage'],
    promotions: ['create', 'manage'],
    ordersSupplier: ['view', 'manage', 'notify'],
    vouchers: ['generate'],
    customersSupplier: ['manage', 'invite'],
    deliverySupplier: ['configure'],
    dashboardSupplier: ['view'],
    alerts: ['purchaseFrequency'],
  }),
  storeManager: ac.newRole({
    // For sub-stores
    productsSupplier: ['manage', 'inventory'],
    ordersSupplier: ['view', 'manage'],
    dashboardSupplier: ['view'],
  }),
};

// Define platform-level roles (admin plugin)
export const platformRoles = {
  marketplaceAdmin: ac.newRole({
    registrationsAdmin: ['manage'],
    requests: ['client', 'supplier'],
    emails: ['configure'],
    data: ['configure'],
    dashboardAdmin: ['view'],
    deliveryCosts: ['manage'],
  }),
  deliveryAdmin: ac.newRole({
    deliveries: ['manage', 'track'],
    dashboardAdmin: ['view'],
  }),
  deliveryTeam: ac.newRole({
    deliveries: ['track'],
  }),
};

export { ac }; // Export for use in auth config
```

### Step 3: Server-Side Auth Configuration

In `auth.ts` (server-side):

```typescript
// auth.ts
import { betterAuth } from 'better-auth';
import { organization } from 'better-auth/plugins';
import { admin } from 'better-auth/plugins';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { PrismaClient } from '@prisma/client';
import { ac, clientRoles, supplierRoles, platformRoles } from './permissions';

const prisma = new PrismaClient();

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }), // Use your DB
  emailAndPassword: { enabled: true }, // For email/OTP
  socialProviders: { google: { enabled: true } }, // As per specs
  twoFactor: { enabled: true }, // For admins/suppliers
  plugins: [
    // Organization for clients/suppliers
    organization({
      access: ac, // Integrate RBAC
      roles: { ...clientRoles, ...supplierRoles }, // Combined for orgs
      enabledDynamicAccessControl: true, // Allow runtime role changes
      maximumMembersPerOrganization: 50, // Scalability limit
      maximumOrganizationsPerUser: 5, // E.g., multi-store
      maximumRolesPerOrganization: 10,
      // Hooks for auto-org creation on signup
      organizationHooks: {
        beforeCreate: async ctx => {
          // Validate company details (e.g., ICE) before creating org
          if (!ctx.data.slug) ctx.data.slug = ctx.data.name.toLowerCase().replace(/\s/g, '-');
        },
        afterCreate: async ctx => {
          // Assign creator as manager
          await ctx.addMember({ userId: ctx.user.id, role: 'manager' });
          // Set as active org
          await ctx.setActive({ organizationId: ctx.organization.id });
        },
      },
    }),
    // Admin for platform-level
    admin({
      access: ac,
      roles: platformRoles,
      basePath: '/admin', // Admin dashboard path
    }),
  ],
  // Global hooks (e.g., for registration validation)
  databaseHooks: {
    'user.create.before': async ctx => {
      // Assign default role if not set (e.g., during signup)
      if (!ctx.data.role) ctx.data.role = 'user';
      // Limited access until admin validation (as per specs)
      ctx.data.verified = false;
    },
    'user.create.after': async ctx => {
      // Notify admin for validation
      // Send email (use built-in mailer)
    },
  },
  // Extend schemas for custom fields (e.g., company details)
  user: {
    additionalFields: {
      companyName: { type: 'string' },
      iceNumber: { type: 'string' },
      verified: { type: 'boolean', default: false },
    },
  },
  organization: {
    additionalFields: {
      legalStatus: { type: 'string' },
      sector: { type: 'string' }, // Conditional dropdowns via hooks
    },
  },
});
```

### Step 4: Client-Side Configuration

For React/Next.js, in `auth-client.ts`:

```typescript
// auth-client.ts
import { createAuthClient } from 'better-auth/client';
import { organizationClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
  baseURL: '/api/auth', // Your API route
  plugins: [organizationClient()],
});
```

Usage example (check permissions):

```typescript
const { hasPermission } = authClient.organization;

if (await hasPermission('orders:validate')) {
  // Allow order validation
}
```

### Step 5: Roles and Permissions Summary

Use tables for clarity:

#### CHR Client Organization Roles & Permissions

| Feature (Permission)              | Manager | Chef | Purchasing Manager | CFO/Accountant |
| --------------------------------- | ------- | ---- | ------------------ | -------------- |
| Registration & Account Creation   | ✔       | -    | -                  | -              |
| Authorization Management          | ✔       | -    | -                  | -              |
| Explore Categories & Suppliers    | ✔       | ✔    | ✔                  | ✔              |
| Advanced Search                   | ✔       | ✔    | ✔                  | ✔              |
| Wishlist Management               | ✔       | ✔    | ✔                  | ✔              |
| Product Suggestions               | ✔       | ✔    | ✔                  | ✔              |
| Add Products to Cart              | ✔       | ✔    | ✔                  | ✔              |
| Order Validation                  | ✔       | ✔    | ✔                  | ✔              |
| Order Threshold Config            | ✔       | -    | -                  | -              |
| Order Tracking                    | ✔       | ✔    | ✔                  | ✔              |
| Delivery Method Choice            | ✔       | -    | ✔                  | ✔              |
| Secure Payments                   | ✔       | -    | -                  | -              |
| Payment on Delivery/Check/Account | ✔       | -    | -                  | -              |
| Wallet Management                 | ✔       | -    | -                  | -              |
| Recipes & Tips                    | ✔       | ✔    | ✔                  | ✔              |
| Loyalty Program                   | ✔       | ✔    | ✔                  | ✔              |
| KPI: Purchase History             | ✔       | ✔    | ✔                  | ✔              |
| KPI: Order Status                 | ✔       | -    | ✔                  | ✔              |
| KPI: Loyalty Points               | ✔       | -    | ✔                  | ✔              |
| Account Settings                  | ✔       | ✔    | ✔                  | ✔              |
| Live Chat                         | ✔       | ✔    | ✔                  | ✔              |
| FAQ                               | ✔       | ✔    | ✔                  | ✔              |
| Product Reception/Verification    | ✔       | ✔    | ✔                  | ✔              |
| Returns Management                | ✔       | -    | -                  | -              |
| Multi-Store Management            | ✔       | -    | -                  | -              |

#### Supplier Organization Roles & Permissions

| Feature (Permission)      | Supplier Admin | Store Manager |
| ------------------------- | -------------- | ------------- |
| Registration & Validation | ✔              | -             |
| Store Customization       | ✔              | -             |
| Product Management        | ✔              | ✔             |
| Sub-Store Management      | ✔              | -             |
| Promotions Management     | ✔              | -             |
| Order Management          | ✔              | ✔             |
| Voucher Generation        | ✔              | -             |
| Customer Management       | ✔              | -             |
| Delivery Configuration    | ✔              | -             |
| Dashboard KPIs            | ✔              | ✔             |
| Purchase Frequency Alerts | ✔              | -             |
| Recipes & Tips Addition   | ✔              | -             |

#### Platform-Level Roles & Permissions

| Feature (Permission)                               | Marketplace Admin | Delivery Admin | Delivery Team |
| -------------------------------------------------- | ----------------- | -------------- | ------------- |
| Manage Registrations                               | ✔                 | -              | -             |
| Manage Client/Supplier Requests                    | ✔                 | -              | -             |
| Email/Notification Config                          | ✔                 | -              | -             |
| Marketplace Data Config (Categories, VAT, Sectors) | ✔                 | -              | -             |
| Platform Dashboard                                 | ✔                 | ✔              | -             |
| Manage Delivery Costs                              | ✔                 | -              | -             |
| Manage Deliveries                                  | -                 | ✔              | -             |
| Track Deliveries                                   | -                 | ✔              | ✔             |

### Implementation Notes

- **Validation Flow**: Use hooks to send registration to admin for approval (set `verified: false` initially).
- **Multi-Store**: Treat as teams within supplier org (enable via org config: `teams: true` in future betas; for v1.4.18, use custom fields).
- **Notifications**: Better-Auth handles OTP/email; integrate with specs' SMS via custom mailer.
- **Testing**: Use Better-Auth's `hasPermission` on client/server to enforce.
- **Updates**: Check for v1.5.0 (beta has improved org hooks); migrate if stable.

This setup aligns with specs, ensuring secure, scalable RBAC without overcomplicating. If needed, extend with custom plugins.

I'll analyze this Restomarkets functional specification and design a comprehensive RBAC (Role-Based Access Control) configuration using Better-Auth. Let me first search for the latest Better-Auth documentation and best practices to ensure accuracy.  
 Based on my research of Better-Auth v1.4 and the functional specifications for Restomarkets, I'll now design a comprehensive RBAC architecture. The system needs to handle three distinct platform levels: Marketplace Administrator (Super Admin), Supplier Back-office (multi-tenant with sub-stores), and CHR Client (multi-tenant with role-based permissions per restaurant/hotel).

## RBAC Architecture for Restomarkets using Better-Auth

### 1. Core Architecture Overview

Restomarkets requires a **hybrid RBAC model** combining:

1. **Platform-level administration** (Marketplace Admin) using the **Admin Plugin**
2. **Multi-tenant organizations** (Suppliers with sub-stores, CHR Clients with multiple establishments) using the **Organization Plugin** with custom roles
3. **Hierarchical permissions** within organizations (managers, chefs, accountants, etc.)

### 2. Permission System Definition

```typescript
// lib/auth/permissions.ts
import { createAccessControl } from 'better-auth/plugins/access';

// ==========================================
// ENTITY DEFINITIONS
// ==========================================

// Platform-level entities (Marketplace Admin)
const platformStatement = {
  // User management across platform
  user: ['create', 'read', 'update', 'delete', 'ban', 'impersonate'],
  // Supplier management
  supplier: ['create', 'read', 'update', 'delete', 'validate', 'suspend'],
  // Category/Configuration management
  category: ['create', 'read', 'update', 'delete'],
  configuration: ['manage'],
  // Analytics across platform
  analytics: ['view', 'export'],
  // Commission/Billing management
  billing: ['manage'],
} as const;

// Organization-level entities (CHR Client & Supplier)
const organizationStatement = {
  // Organization management
  organization: ['update', 'delete', 'transfer-ownership'],
  // Member management
  member: ['create', 'read', 'update', 'delete', 'update-role', 'invite'],
  // Invitation management
  invitation: ['create', 'cancel', 'read'],
  // Store/Sub-store management (for suppliers)
  store: ['create', 'read', 'update', 'delete', 'manage-inventory'],
  // Product catalog
  product: ['create', 'read', 'update', 'delete', 'import', 'export'],
  // Inventory management
  inventory: ['view', 'update', 'manage-alerts'],
  // Order management
  order: ['create', 'read', 'update', 'cancel', 'validate', 'process-refund'],
  // Promotion management
  promotion: ['create', 'read', 'update', 'delete', 'activate'],
  // Delivery slot management
  deliverySlot: ['create', 'read', 'update', 'delete'],
  // Customer management (for suppliers)
  customer: ['create', 'read', 'update', 'delete', 'set-credit-limit'],
  // Payment method configuration
  paymentMethod: ['configure', 'manage'],
  // Reporting and analytics
  report: ['view', 'export', 'configure'],
  // Authorization management (for CHR Clients)
  authorization: ['manage', 'configure-thresholds'],
  // Recipe management
  recipe: ['create', 'read', 'update', 'delete'],
  // Multi-store specific
  multiStore: ['consolidate-orders', 'switch-context', 'manage-managers'],
} as const;

// Combine statements for the access control instance
export const statement = {
  ...platformStatement,
  ...organizationStatement,
} as const;

export const ac = createAccessControl(statement);
```

### 3. Role Definitions by Platform Layer

#### 3.1 Marketplace Administrator Roles (Platform Level)

```typescript
// lib/auth/platform-roles.ts
import { ac } from './permissions';

// Super Admin: Full platform control
export const superAdmin = ac.newRole({
  user: ['create', 'read', 'update', 'delete', 'ban', 'impersonate'],
  supplier: ['create', 'read', 'update', 'delete', 'validate', 'suspend'],
  category: ['create', 'read', 'update', 'delete'],
  configuration: ['manage'],
  analytics: ['view', 'export'],
  billing: ['manage'],
});

// Platform Admin: Operational management without user deletion
export const platformAdmin = ac.newRole({
  user: ['create', 'read', 'update', 'ban'], // Cannot delete or impersonate
  supplier: ['read', 'update', 'validate', 'suspend'], // Cannot create/delete suppliers
  category: ['create', 'read', 'update', 'delete'],
  configuration: ['manage'],
  analytics: ['view', 'export'],
  billing: ['view'], // View only
});

// Support Agent: Limited operational access
export const supportAgent = ac.newRole({
  user: ['read', 'update'], // Can view and edit basic info
  supplier: ['read'], // View only
  category: ['read'],
  analytics: ['view'],
});
```

#### 3.2 CHR Client (Restaurant/Hotel) Organization Roles

```typescript
// lib/auth/chr-roles.ts
import { ac } from './permissions';

// Manager: Full control over the CHR organization
export const chrManager = ac.newRole({
  organization: ['update'],
  member: ['create', 'read', 'update', 'delete', 'update-role', 'invite'],
  invitation: ['create', 'cancel', 'read'],
  order: ['create', 'read', 'update', 'cancel', 'validate'],
  product: ['read'],
  inventory: ['view'],
  promotion: ['read'],
  report: ['view', 'export', 'configure'],
  paymentMethod: ['configure', 'manage'],
  authorization: ['manage', 'configure-thresholds'],
  multiStore: ['consolidate-orders', 'switch-context', 'manage-managers'],
  recipe: ['create', 'read', 'update', 'delete'],
});

// Chef: Operational focus with order validation
export const chef = ac.newRole({
  member: ['read', 'update-name'], // Can update own profile
  order: ['create', 'read', 'update', 'validate'], // Can validate orders
  product: ['read'],
  inventory: ['view', 'update'], // Can update inventory levels
  promotion: ['read'],
  report: ['view'], // Purchase history, order status
  recipe: ['create', 'read', 'update', 'delete'], // Full recipe management
  authorization: ['manage'], // Can manage some authorizations per FC specs
});

// Purchasing Manager: Procurement focus
export const purchasingManager = ac.newRole({
  member: ['read', 'update-name'],
  order: ['create', 'read', 'update', 'cancel'], // Can cancel orders
  product: ['read'],
  inventory: ['view'],
  promotion: ['read'],
  report: ['view'], // Purchase history, order status, loyalty points
  multiStore: ['consolidate-orders', 'switch-context'], // Can manage multi-store
});

// CFO/Accountant: Financial focus
export const cfoAccountant = ac.newRole({
  member: ['read', 'update-name'],
  order: ['read', 'validate'], // Can validate orders (financial validation)
  product: ['read'],
  inventory: ['view'],
  promotion: ['read'],
  report: ['view', 'export'], // Full reporting access
  paymentMethod: ['configure'], // Can configure payment methods
  multiStore: ['switch-context'], // Can view all stores
});

// Basic Staff: Read-only with limited order creation
export const staffMember = ac.newRole({
  member: ['read', 'update-name'],
  order: ['create', 'read'], // Can create orders but not validate/cancel
  product: ['read'],
  inventory: ['view'],
  recipe: ['read'],
});
```

#### 3.3 Supplier Organization Roles

```typescript
// lib/auth/supplier-roles.ts
import { ac } from './permissions';

// Supplier Owner: Full control over supplier organization and sub-stores
export const supplierOwner = ac.newRole({
  organization: ['update', 'delete', 'transfer-ownership'],
  member: ['create', 'read', 'update', 'delete', 'update-role', 'invite'],
  invitation: ['create', 'cancel', 'read'],
  store: ['create', 'read', 'update', 'delete', 'manage-inventory'],
  product: ['create', 'read', 'update', 'delete', 'import', 'export'],
  inventory: ['view', 'update', 'manage-alerts'],
  order: ['read', 'update', 'process-refund'], // Cannot create (customers do)
  promotion: ['create', 'read', 'update', 'delete', 'activate'],
  deliverySlot: ['create', 'read', 'update', 'delete'],
  customer: ['create', 'read', 'update', 'delete', 'set-credit-limit'],
  paymentMethod: ['configure', 'manage'],
  report: ['view', 'export', 'configure'],
  recipe: ['create', 'read', 'update', 'delete'],
});

// Store Manager: Manages specific sub-store
export const storeManager = ac.newRole({
  member: ['read', 'update-name'],
  store: ['read', 'manage-inventory'], // Only assigned stores
  product: ['read', 'update'], // Can update product details
  inventory: ['view', 'update', 'manage-alerts'], // Full inventory for their store
  order: ['read', 'update'], // Process orders for their store
  deliverySlot: ['read', 'update'], // Manage slots for their store
  customer: ['read', 'update'],
  report: ['view'], // Store-specific reports
});

// Product Manager: Catalog focus
export const productManager = ac.newRole({
  product: ['create', 'read', 'update', 'delete', 'import', 'export'],
  inventory: ['view', 'update'],
  promotion: ['create', 'read', 'update', 'delete'],
  recipe: ['create', 'read', 'update', 'delete'],
  report: ['view'], // Product performance
});

// Logistics Manager: Delivery and inventory focus
export const logisticsManager = ac.newRole({
  store: ['read', 'manage-inventory'],
  inventory: ['view', 'update', 'manage-alerts'],
  order: ['read', 'update'], // Update order status
  deliverySlot: ['create', 'read', 'update', 'delete'],
  report: ['view'], // Delivery performance
});

// Sales Representative: Customer and order focus
export const salesRep = ac.newRole({
  customer: ['create', 'read', 'update'],
  order: ['read', 'update'], // Update order status, process refunds
  report: ['view'], // Customer reports
  recipe: ['read'], // Can view recipes
});

// Read-only Analyst
export const analyst = ac.newRole({
  product: ['read'],
  inventory: ['view'],
  order: ['read'],
  customer: ['read'],
  report: ['view', 'export'],
});
```

### 4. Better-Auth Configuration

#### 4.1 Server Configuration

```typescript
// lib/auth/server.ts
import { betterAuth } from 'better-auth';
import { admin } from 'better-auth/plugins';
import { organization } from 'better-auth/plugins';
import { ac, superAdmin, platformAdmin, supportAgent } from './platform-roles';
import { chrManager, chef, purchasingManager, cfoAccountant, staffMember } from './chr-roles';
import {
  supplierOwner,
  storeManager,
  productManager,
  logisticsManager,
  salesRep,
  analyst,
} from './supplier-roles';

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  plugins: [
    // Admin plugin for platform-level administration
    admin({
      // Allow specific users to be admins
      adminUserIds: process.env.SUPER_ADMIN_IDS?.split(',') || [],
      // Or users with 'admin' role in user table
      defaultRole: 'user',
    }),

    // Organization plugin for multi-tenancy
    organization({
      ac,
      roles: {
        // CHR Client roles
        chr_manager: chrManager,
        chef: chef,
        purchasing_manager: purchasingManager,
        cfo_accountant: cfoAccountant,
        staff: staffMember,

        // Supplier roles
        supplier_owner: supplierOwner,
        store_manager: storeManager,
        product_manager: productManager,
        logistics_manager: logisticsManager,
        sales_rep: salesRep,
        analyst: analyst,

        // Include default roles for compatibility
        owner: supplierOwner, // Maps to supplier_owner
        admin: storeManager, // Maps to store_manager for suppliers
        member: staffMember, // Maps to staff for CHR
      },

      // Organization creation configuration
      allowUserToCreateOrganization: true,

      // Invitation configuration
      sendInvitationEmail: async data => {
        await sendEmail({
          to: data.email,
          subject: `Invitation to join ${data.organization.name}`,
          text: `You've been invited to join ${data.organization.name} as ${data.role}. 
                 Click here to accept: ${data.invitationUrl}`,
        });
      },

      // Hooks for Restomarkets-specific logic
      organizationHooks: {
        beforeCreateOrganization: async ({ organization, user }) => {
          // Validate organization type (CHR or Supplier)
          const orgType = organization.metadata?.type;
          if (!['chr', 'supplier'].includes(orgType)) {
            throw new Error("Organization type must be 'chr' or 'supplier'");
          }

          // Set limits based on type
          if (orgType === 'supplier') {
            // Check if user already owns a supplier org
            const existingSuppliers = await prisma.organization.count({
              where: {
                members: { some: { userId: user.id, role: 'supplier_owner' } },
              },
            });
            if (existingSuppliers > 0 && !user.isPlatformAdmin) {
              throw new Error('User can only own one supplier organization');
            }
          }
        },

        afterCreateOrganization: async ({ organization, user }) => {
          // Create default settings based on organization type
          if (organization.metadata?.type === 'chr') {
            await prisma.chrSettings.create({
              data: {
                organizationId: organization.id,
                defaultOrderThreshold: 1000,
                paymentMethods: ['card', 'cash_on_delivery'],
              },
            });
          } else if (organization.metadata?.type === 'supplier') {
            await prisma.supplierSettings.create({
              data: {
                organizationId: organization.id,
                defaultPaymentTerms: 'net_30',
                allowsCheckPayment: false,
                allowsAccountPayment: true,
              },
            });
          }
        },

        beforeAddMember: async ({ member, organization }) => {
          // Validate role is allowed for organization type
          const orgType = organization.metadata?.type;
          const chrRoles = ['chr_manager', 'chef', 'purchasing_manager', 'cfo_accountant', 'staff'];
          const supplierRoles = [
            'supplier_owner',
            'store_manager',
            'product_manager',
            'logistics_manager',
            'sales_rep',
            'analyst',
          ];

          if (orgType === 'chr' && !chrRoles.includes(member.role)) {
            throw new Error(`Role ${member.role} not allowed for CHR organizations`);
          }
          if (orgType === 'supplier' && !supplierRoles.includes(member.role)) {
            throw new Error(`Role ${member.role} not allowed for Supplier organizations`);
          }
        },
      },

      // Teams support for sub-stores (Supplier FC4 requirement)
      teams: {
        enabled: true,
        maximumTeams: (user, organization) => {
          // Dynamic limit based on subscription tier
          const tier = organization.metadata?.subscriptionTier;
          if (tier === 'enterprise') return 50;
          if (tier === 'professional') return 10;
          return 3; // Free tier
        },
        allowRemovingAllTeams: false,
      },
    }),
  ],

  // User roles for platform-level access
  user: {
    additionalFields: {
      role: {
        type: 'string',
        defaultValue: 'user',
        required: false,
      },
      isPlatformAdmin: {
        type: 'boolean',
        defaultValue: false,
      },
      organizationType: {
        type: 'string', // 'chr', 'supplier', null
        required: false,
      },
    },
  },

  // Session configuration
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },

  // Advanced configuration
  advanced: {
    database: {
      generateId: 'uuid',
    },
    cookiePrefix: 'restomarkets',
  },
});
```

#### 4.2 Client Configuration

```typescript
// lib/auth/client.ts
import { createAuthClient } from 'better-auth/client';
import { adminClient } from 'better-auth/client/plugins';
import { organizationClient } from 'better-auth/client/plugins';
import { ac, chrManager, chef, purchasingManager, cfoAccountant, staffMember } from './chr-roles';
import {
  supplierOwner,
  storeManager,
  productManager,
  logisticsManager,
  salesRep,
  analyst,
} from './supplier-roles';

export const authClient = createAuthClient({
  plugins: [
    adminClient(),
    organizationClient({
      ac,
      roles: {
        chr_manager: chrManager,
        chef: chef,
        purchasing_manager: purchasingManager,
        cfo_accountant: cfoAccountant,
        staff: staffMember,
        supplier_owner: supplierOwner,
        store_manager: storeManager,
        product_manager: productManager,
        logistics_manager: logisticsManager,
        sales_rep: salesRep,
        analyst: analyst,
      },
    }),
  ],
});
```

### 5. Permission Enforcement Patterns

#### 5.1 API Route Protection (Next.js App Router)

```typescript
// app/api/orders/route.ts
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Check if user has permission to create orders
  const canCreateOrder = await auth.api.hasPermission({
    headers: await headers(),
    permission: {
      order: ['create'],
    },
  });

  if (!canCreateOrder.success) {
    return new Response('Forbidden: Cannot create orders', { status: 403 });
  }

  // Get active organization context
  const activeOrgId = session.session.activeOrganizationId;
  if (!activeOrgId) {
    return new Response('No active organization', { status: 400 });
  }

  // Proceed with order creation...
}

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Managers can view all orders, others only their own
  const isManager = await auth.api.hasPermission({
    headers: await headers(),
    permission: {
      order: ['read'],
      member: ['update-role'], // Proxy for manager status
    },
  });

  // Filter orders based on permissions...
}
```

#### 5.2 Middleware for Route Protection

```typescript
// middleware.ts
import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  // Protect admin routes
  if (request.nextUrl.pathname.startsWith('/admin')) {
    if (!session?.user.isPlatformAdmin) {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }
  }

  // Protect supplier back-office
  if (request.nextUrl.pathname.startsWith('/supplier')) {
    const hasSupplierAccess = await auth.api.hasPermission({
      headers: request.headers,
      permission: {
        product: ['read'], // Any supplier role has this
      },
    });

    if (!hasSupplierAccess.success) {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }
  }

  // Protect CHR client features
  if (request.nextUrl.pathname.startsWith('/dashboard')) {
    const hasChrAccess = await auth.api.hasPermission({
      headers: request.headers,
      permission: {
        order: ['create'], // Any CHR role has this
      },
    });

    if (!hasChrAccess.success) {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/supplier/:path*', '/dashboard/:path*'],
};
```

#### 5.3 React Component Permission Checks

```typescript
// components/auth/permission-gate.tsx
"use client";

import { useSession } from "@/lib/auth-client";
import { useActiveOrganization } from "@/lib/auth-client";
import { ReactNode } from "react";

interface PermissionGateProps {
  permissions: Record<string, string[]>;
  fallback?: ReactNode;
  children: ReactNode;
}

export function PermissionGate({
  permissions,
  fallback = null,
  children
}: PermissionGateProps) {
  const { data: session } = useSession();
  const { data: organization } = useActiveOrganization();

  // Check permissions using client-side method
  const hasPermission = organization?.members?.some(
    (member) => member.userId === session?.user.id &&
    // Simplified check - in production use authClient.organization.checkRolePermission
    checkPermissions(member.role, permissions)
  );

  if (!hasPermission) {
    return fallback;
  }

  return children;
}

// Helper to check if role has required permissions
function checkPermissions(role: string, required: Record<string, string[]>): boolean {
  // Implementation would check against role definitions
  return true; // Simplified
}

// Usage example
export function OrderValidationButton() {
  return (
    <PermissionGate
      permissions={{ order: ["validate"] }}
      fallback={<span>View Only</span>}
    >
      <button>Validate Order</button>
    </PermissionGate>
  );
}
```

### 6. Organization Type-Specific Implementations

#### 6.1 CHR Client: Multi-Store Management (FC11)

```typescript
// lib/chr/multi-store.ts
import { auth } from '@/lib/auth';

export async function createStoreManager(
  organizationId: string,
  storeId: string,
  userData: { email: string; name: string },
) {
  // Invite user with store_manager role specific to a store
  const invitation = await auth.api.createInvitation({
    body: {
      email: userData.email,
      role: 'staff', // Base role
      organizationId,
      // Store-specific permissions via metadata
      metadata: {
        storeId,
        permissions: ['order:create', 'inventory:view'],
        isStoreManager: true,
      },
    },
  });

  return invitation;
}

export async function consolidateOrders(
  organizationId: string,
  storeIds: string[],
  orderData: any,
) {
  // Check if user has multi-store consolidation permission
  const session = await auth.api.getSession({ headers: await headers() });

  const canConsolidate = await auth.api.hasPermission({
    headers: await headers(),
    permission: {
      multiStore: ['consolidate-orders'],
    },
  });

  if (!canConsolidate.success) {
    throw new Error('Insufficient permissions to consolidate orders');
  }

  // Implementation for order consolidation across stores...
}
```

#### 6.2 Supplier: Sub-Store Inventory Management (FC4)

```typescript
// lib/supplier/sub-store.ts
import { auth } from '@/lib/auth';

export async function manageSubStoreInventory(subStoreId: string, inventoryData: any) {
  // Verify user has access to this specific sub-store
  const session = await auth.api.getSession({ headers: await headers() });
  const organization = await auth.api.getFullOrganization({
    headers: await headers(),
  });

  // Check if user is owner or manager of this specific store
  const member = organization?.members.find(m => m.userId === session?.user.id);

  if (!member) throw new Error('Not a member of this organization');

  // Owner has access to all stores
  if (member.role === 'supplier_owner') {
    return updateInventory(subStoreId, inventoryData);
  }

  // Store manager only for assigned stores
  if (member.role === 'store_manager') {
    const assignedStores = member.metadata?.assignedStores || [];
    if (!assignedStores.includes(subStoreId)) {
      throw new Error('Not authorized for this sub-store');
    }
    return updateInventory(subStoreId, inventoryData);
  }

  throw new Error('Insufficient permissions');
}
```

### 7. Dynamic Access Control for Advanced Scenarios

For the complex requirement where **Chef can validate orders up to a threshold** (per FC specs), implement dynamic access control:

```typescript
// lib/auth/dynamic-permissions.ts
import { auth } from '@/lib/auth';

// Extend member with dynamic permissions
export async function setOrderValidationThreshold(memberId: string, threshold: number) {
  await auth.api.updateMemberRole({
    body: {
      memberId,
      role: 'chef',
      // Store threshold in metadata for dynamic checks
      metadata: {
        orderValidationThreshold: threshold,
        canValidateOrders: true,
      },
    },
  });
}

// Middleware/API check for threshold
export async function validateOrderWithThreshold(orderAmount: number) {
  const session = await auth.api.getSession({ headers: await headers() });
  const organization = await auth.api.getFullOrganization({
    headers: await headers(),
  });

  const member = organization?.members.find(m => m.userId === session?.user.id);

  // Check dynamic permission
  if (member?.role === 'chef') {
    const threshold = member.metadata?.orderValidationThreshold || 0;
    if (orderAmount > threshold) {
      throw new Error(`Order exceeds validation threshold of ${threshold}`);
    }
  }

  // Also check static permission
  const hasPermission = await auth.api.hasPermission({
    headers: await headers(),
    permission: { order: ['validate'] },
  });

  if (!hasPermission.success) {
    throw new Error('No validation permission');
  }
}
```

### 8. Database Schema Considerations

```prisma
// schema.prisma extensions for Better-Auth
model User {
  id            String    @id @default(uuid())
  email         String    @unique
  name          String?
  emailVerified Boolean   @default(false)
  image         String?
  role          String    @default("user")
  isPlatformAdmin Boolean @default(false)
  banned        Boolean   @default(false)
  banReason     String?
  banExpires    DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  sessions      Session[]
  accounts      Account[]
  members       Member[]
  invitations   Invitation[]

  @@map("user")
}

// Better-Auth Organization models
model Organization {
  id          String   @id @default(uuid())
  name        String
  slug        String   @unique
  logo        String?
  metadata    Json?    // { type: 'chr' | 'supplier', subscriptionTier: string }
  createdAt   DateTime @default(now())

  members     Member[]
  invitations Invitation[]

  @@map("organization")
}

model Member {
  id             String       @id @default(uuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  userId         String
  user           User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  role           String       // chr_manager, chef, supplier_owner, etc.
  metadata       Json?        // { assignedStores: [], orderThreshold: 1000 }
  createdAt      DateTime     @default(now())

  @@unique([organizationId, userId])
  @@map("member")
}

// Custom models for Restomarkets
model ChrSettings {
  id                    String   @id @default(uuid())
  organizationId        String   @unique
  defaultOrderThreshold Int      @default(1000)
  paymentMethods        String[] @default(["card"])
  createdAt             DateTime @default(now())

  @@map("chr_settings")
}

model SupplierSettings {
  id                   String   @id @default(uuid())
  organizationId       String   @unique
  defaultPaymentTerms  String   @default("net_30")
  allowsCheckPayment   Boolean  @default(false)
  allowsAccountPayment Boolean  @default(true)
  maxSubStores         Int      @default(3)
  createdAt            DateTime @default(now())

  @@map("supplier_settings")
}
```

### 9. Implementation Checklist

Based on the functional specifications, verify these mappings:

| Feature Code   | Requirement                    | RBAC Implementation                                                        |
| -------------- | ------------------------------ | -------------------------------------------------------------------------- |
| FC1 (CHR)      | Manager manages authorizations | `chrManager` role with `authorization: ["manage", "configure-thresholds"]` |
| FC1 (CHR)      | Role assignment interface      | Built-in Better-Auth UI + custom threshold configuration                   |
| FC4 (Supplier) | Sub-store management           | `teams: { enabled: true }` with `store_manager` role                       |
| FC4 (Supplier) | Store-specific permissions     | Member metadata with `assignedStores` array                                |
| FC5 (Supplier) | Promotion management           | `promotion` entity permissions on `supplierOwner`/`productManager`         |
| FC6            | Payment method configuration   | `paymentMethod: ["configure", "manage"]` on Manager/Owner roles            |
| FC7            | Delivery slot management       | `deliverySlot` entity permissions                                          |
| FC11           | Multi-store consolidation      | `multiStore: ["consolidate-orders"]` permission                            |
| FC11           | Per-store managers             | Dynamic role assignment with store scoping                                 |

This architecture provides a robust, scalable RBAC system that maps precisely to Restomarkets' complex multi-tenant requirements while leveraging Better-Auth's type-safe, extensible plugin system.

### 1. Marketplace Structure and Actors

The Restomarkets B2B marketplace is a multi-tenant platform connecting CHR (Cafés, Hotels, Restaurants) buyers with food/alimentary suppliers and distributors. It operates as a centralized digital hub for sourcing agri-food products, equipment, hygiene, and packaging, emphasizing efficiency, digitalization, and AI-driven features like product substitutions and demand forecasting.

**Key Structure**:

- **Multi-Tenant Architecture**: Each CHR buyer and supplier operates within their own "organization" (tenant), with isolated data (e.g., orders, inventories). The marketplace operator oversees the platform globally.
- **Core Flows**: Buyers browse catalogs, place orders, manage deliveries/payments; suppliers manage products, fulfill orders, handle promotions; operators administer platform-wide configs, compliance, and analytics.
- **External Integrations**: Logistics (e.g., delivery apps for real-time tracking), payments (e.g., CMI API, NAPS), compliance (e.g., VAT/tax APIs), accounting (e.g., ERP sync for invoices), and AI tools (e.g., for recommendations).

**Actors**:

- **Marketplace Operator**: Internal teams managing platform ops, finance, support, and tech.
- **CHR Buyers**: Multi-user organizations (e.g., a hotel chain with centralized procurement but per-location managers).
- **Suppliers**: B2B sellers with warehouses, sales teams, and logistics.
- **External Parties**: Delivery teams (via dedicated app), payment gateways, regulatory bodies (for audits).

This structure demands RBAC to enforce data isolation (e.g., suppliers can't see competitors' catalogs) while allowing controlled cross-tenant interactions (e.g., order fulfillment).

### 2. Core Business Resources

Resources are entities or modules requiring access control. I've categorized them based on the specs and B2B marketplace best practices, focusing on data, actions, and services.

- **Organizations & Users**: Org creation/validation, user invites/roles, profiles (e.g., company details like ICE/RC numbers).
- **Products & Catalogs**: Product CRUD (create/read/update/delete), categories/subcategories (e.g., conditional dropdowns for sectors like "Restaurant: Asian Fusion"), photos/descriptions, bulk uploads (CSV/Excel).
- **Pricing & Contracts**: Price setting (default/specific per customer), promotions (discounts, bundles), contracts (e.g., deferred payments).
- **Orders & Order Lifecycle**: Order creation/validation/tracking, thresholds, multi-store consolidation, status updates (pending/accepted/shipped).
- **Invoices & Payments**: Invoice generation, payment methods (online, on-delivery, check, account), wallet management, credit notes.
- **Inventory & Stock**: Stock levels per sub-store, low-stock notifications, synchronization with supplier ERPs.
- **Logistics & Delivery**: Slot configuration (e.g., express/scheduled/pick-up), tracking, costs by region/method, inter-store consolidation.
- **Returns & Disputes**: Return/exchange/refund requests, verification interfaces, dispute resolution.
- **Analytics & Reporting**: KPIs (e.g., purchase history, sales by period, return rates), dashboards, exports (PDF/Excel).
- **Integrations & APIs**: API keys for payments/logistics, ERP/CRM sync, AI modules (e.g., product suggestions).
- **Compliance & Certifications**: VAT rates, sector configs, data encryption, audit logs, regulatory reports (e.g., GDPR compliance).
- **Support & Messaging**: Live chat, FAQs, notifications (push/email/SMS), ticket management.
- **System Configuration & Settings**: Email templates, platform-wide data (e.g., sectors, packaging options), delivery costs.

Actions on these resources include: view, create, update, delete, approve, export, notify, integrate.

### 3. Organization Types and Internal Hierarchies

Using a hierarchical multi-tenant model:

- **Marketplace Operator (Internal)**: Single global tenant with flat hierarchy but role-based separation (e.g., admins have full access, support has limited).
- **CHR Organizations (Buyers)**: Hierarchical (e.g., Owner oversees multiple locations; Managers per site; Staff report to Managers). Supports multi-store (e.g., franchise chains) with consolidated or separate management.
- **Suppliers (Sellers)**: Hierarchical (e.g., Owner at top; Managers per warehouse/sub-store; Coordinators for ops). Sub-stores have isolated inventories but shared products.

Hierarchies enforce inheritance (e.g., Owner inherits Manager permissions) with overrides for least-privilege.

### 4. Map Roles to Responsibilities

Roles are defined per organization type, aligned with real B2B responsibilities in CHR/supply chains.

**Marketplace Operator Roles**:

- **Admin**: Oversees platform configs, user validations, compliance.
- **Operations**: Manages daily ops like delivery slots, support tickets.
- **Finance**: Handles commissions, invoices, financial reports.
- **Support**: Resolves user queries, manages chat/FAQs.
- **Compliance**: Ensures regulatory adherence, audits data.
- **Product/Tech**: Configures integrations, AI features, system settings.

**CHR Organizations Roles**:

- **Owner/Director**: Strategic oversight, org setup, high-level approvals.
- **Manager**: Daily operations, user management, order thresholds.
- **Procurement/Purchasing**: Sourcing, order placement/validation.
- **Accountant**: Financial tracking, payments, reports.
- **Staff**: Operational tasks like viewing catalogs, basic tracking (read-only for sensitive actions).

**Suppliers Roles**:

- **Supplier Owner**: Business strategy, contracts, full access.
- **Sales Manager**: Promotions, customer invites, order acceptance.
- **Inventory/Warehouse Manager**: Stock management, low-stock alerts.
- **Finance/Billing**: Invoicing, payment configs.
- **Logistics Coordinator**: Delivery slots, tracking, consolidations.

### 5. Map Permissions to Roles (Least-Privilege Principles)

Permissions are granular (e.g., "orders:view_own" vs. "orders:view_all"). Use least-privilege: Grant only what's needed for responsibilities; deny by default; audit changes.

- Inheritance: Higher roles inherit lower ones (e.g., Owner inherits Manager).
- Scopes: "Own" (tenant-specific), "All" (platform-wide for operators).
- Conditional: E.g., based on verification status or thresholds.

### 6. Model Validation Against Real Scenarios

Validated against B2B scenarios:

- **Scenario 1: CHR Order Placement**: Procurement places order (create/validate), Manager approves threshold, Accountant views payments. No staff can approve—prevents fraud.
- **Scenario 2: Supplier Fulfillment**: Sales Manager accepts order, Inventory updates stock, Logistics schedules delivery. Owner views all reports; no cross-supplier access—ensures competition.
- **Scenario 3: Platform Admin**: Admin validates registrations, Compliance audits logs. No finance access to supplier inventories—separation of duties.
- **Scenario 4: Multi-Store CHR**: Manager consolidates orders across stores; Staff views only their store—scales for chains.
- **Scenario 5: Dispute**: Support views disputes; Finance issues credits. Audits track changes—compliance-ready.
- **Edge Case: Unverified User**: Limited access until admin approval—matches specs.
  Model is scalable (add roles via dynamic RBAC), secure (encrypt sensitive data, 2FA for admins), and operational (e.g., notifications only to relevant roles).

### Structured Tables for Implementation

#### Table 1: Marketplace Operator Roles & Permissions

| Resource                    | Action                   | Admin | Operations | Finance | Support | Compliance | Product/Tech |
| --------------------------- | ------------------------ | ----- | ---------- | ------- | ------- | ---------- | ------------ |
| Organizations & Users       | View All                 | ✔     | ✔          | -       | ✔       | ✔          | ✔            |
| Organizations & Users       | Create/Validate          | ✔     | -          | -       | -       | ✔          | -            |
| Organizations & Users       | Update/Delete            | ✔     | -          | -       | -       | ✔          | -            |
| Products & Catalogs         | Configure Global         | ✔     | -          | -       | -       | -          | ✔            |
| Pricing & Contracts         | View Commissions         | ✔     | -          | ✔       | -       | ✔          | -            |
| Orders & Lifecycle          | View All                 | ✔     | ✔          | ✔       | ✔       | ✔          | -            |
| Orders & Lifecycle          | Update Status (Platform) | -     | ✔          | -       | -       | -          | -            |
| Invoices & Payments         | Generate/Track Global    | -     | -          | ✔       | -       | ✔          | -            |
| Inventory & Stock           | View Supplier (Audit)    | -     | -          | -       | -       | ✔          | -            |
| Logistics & Delivery        | Configure Costs/Slots    | ✔     | ✔          | -       | -       | -          | ✔            |
| Returns & Disputes          | Resolve Platform         | -     | ✔          | ✔       | ✔       | ✔          | -            |
| Analytics & Reporting       | View Platform KPIs       | ✔     | ✔          | ✔       | -       | ✔          | ✔            |
| Integrations & APIs         | Configure/Manage         | ✔     | -          | -       | -       | -          | ✔            |
| Compliance & Certifications | Audit/Report             | ✔     | -          | -       | -       | ✔          | -            |
| Support & Messaging         | Manage Templates/Chat    | -     | -          | -       | ✔       | -          | ✔            |
| System Configuration        | Update Settings          | ✔     | -          | -       | -       | -          | ✔            |

#### Table 2: CHR Organizations (Buyers) Roles & Permissions

| Resource                    | Action                    | Owner/Director | Manager | Procurement/Purchasing | Accountant | Staff         |
| --------------------------- | ------------------------- | -------------- | ------- | ---------------------- | ---------- | ------------- |
| Organizations & Users       | View Own Org              | ✔              | ✔       | ✔                      | ✔          | ✔             |
| Organizations & Users       | Manage Users/Roles        | ✔              | ✔       | -                      | -          | -             |
| Products & Catalogs         | View/Search               | ✔              | ✔       | ✔                      | ✔          | ✔             |
| Products & Catalogs         | Suggest/Add               | ✔              | ✔       | ✔                      | -          | ✔ (View Only) |
| Pricing & Contracts         | View Promotions           | ✔              | ✔       | ✔                      | ✔          | ✔             |
| Orders & Lifecycle          | Create/Validate           | ✔              | ✔       | ✔                      | -          | -             |
| Orders & Lifecycle          | Track Own                 | ✔              | ✔       | ✔                      | ✔          | ✔             |
| Orders & Lifecycle          | Configure Thresholds      | ✔              | ✔       | -                      | -          | -             |
| Invoices & Payments         | View/Process Own          | ✔              | ✔       | -                      | ✔          | -             |
| Invoices & Payments         | Wallet Management         | ✔              | ✔       | -                      | ✔          | -             |
| Inventory & Stock           | Track Supplier (View)     | ✔              | ✔       | ✔                      | -          | ✔             |
| Logistics & Delivery        | Choose/Track Own          | ✔              | ✔       | ✔                      | -          | ✔ (View Only) |
| Returns & Disputes          | Initiate/Manage Own       | ✔              | ✔       | ✔                      | -          | -             |
| Analytics & Reporting       | View Own KPIs             | ✔              | ✔       | ✔                      | ✔          | ✔ (Limited)   |
| Integrations & APIs         | View Own (e.g., ERP Sync) | ✔              | -       | -                      | ✔          | -             |
| Compliance & Certifications | View Own Certs            | ✔              | ✔       | -                      | ✔          | -             |
| Support & Messaging         | Access Chat/FAQ           | ✔              | ✔       | ✔                      | ✔          | ✔             |
| System Configuration        | Update Own Settings       | ✔              | ✔       | -                      | -          | -             |

#### Table 3: Suppliers (Sellers) Roles & Permissions

| Resource                    | Action                      | Supplier Owner | Sales Manager | Inventory/Warehouse Manager | Finance/Billing | Logistics Coordinator |
| --------------------------- | --------------------------- | -------------- | ------------- | --------------------------- | --------------- | --------------------- |
| Organizations & Users       | View Own Org                | ✔              | ✔             | ✔                           | ✔               | ✔                     |
| Organizations & Users       | Manage Users/Roles          | ✔              | -             | -                           | -               | -                     |
| Products & Catalogs         | CRUD Own                    | ✔              | ✔             | ✔                           | -               | -                     |
| Products & Catalogs         | Bulk Upload                 | ✔              | ✔             | ✔                           | -               | -                     |
| Pricing & Contracts         | Set Prices/Promotions       | ✔              | ✔             | -                           | ✔               | -                     |
| Orders & Lifecycle          | View/Accept Own             | ✔              | ✔             | ✔                           | ✔               | ✔                     |
| Orders & Lifecycle          | Update Status               | ✔              | ✔             | ✔                           | -               | ✔                     |
| Invoices & Payments         | Generate/Track Own          | ✔              | -             | -                           | ✔               | -                     |
| Inventory & Stock           | Manage Own (Per Sub-Store)  | ✔              | -             | ✔                           | -               | ✔                     |
| Inventory & Stock           | Low-Stock Notify            | ✔              | ✔             | ✔                           | -               | -                     |
| Logistics & Delivery        | Configure Slots/Consolidate | ✔              | -             | ✔                           | -               | ✔                     |
| Logistics & Delivery        | Track Own                   | ✔              | ✔             | ✔                           | -               | ✔                     |
| Returns & Disputes          | Manage Own                  | ✔              | ✔             | ✔                           | ✔               | -                     |
| Analytics & Reporting       | View Own KPIs               | ✔              | ✔             | ✔                           | ✔               | ✔                     |
| Integrations & APIs         | Configure Own (e.g., ERP)   | ✔              | -             | ✔                           | ✔               | ✔                     |
| Compliance & Certifications | Upload/View Own             | ✔              | -             | -                           | ✔               | -                     |
| Support & Messaging         | Manage Recipes/Tips         | ✔              | ✔             | -                           | -               | -                     |
| System Configuration        | Update Own Store Settings   | ✔              | ✔             | -                           | -               | -                     |

I'll conduct a comprehensive analysis of this B2B marketplace ecosystem. Let me first search for current best practices in B2B marketplace RBAC, multi-tenant permission models, and food supply chain compliance requirements to ensure the design is grounded in industry standards.
Now let me search for specific information about food industry compliance requirements (HACCP, FDA, supply chain traceability) and B2B marketplace operational workflows to ensure the RBAC model addresses regulatory needs.  
 Now I have gathered comprehensive information on multi-tenant RBAC best practices, B2B food marketplace requirements, compliance needs (FSMA, HACCP), and organizational hierarchy patterns. Let me now design the complete RBAC architecture.

---

# Enterprise RBAC Architecture for B2B Food Marketplace

## Executive Summary

This document presents a comprehensive Role-Based Access Control (RBAC) model for a multi-tenant B2B food marketplace connecting CHR (Cafés, Hôtels, Restaurants) organizations with food/alimentary suppliers. The architecture addresses complex requirements including FDA FSMA compliance, multi-level approval workflows, hierarchical business structures, and granular operational permissions across three distinct organizational domains: **Marketplace Operator**, **CHR Buyers**, and **Food Suppliers**.

---

## 1. Marketplace Ecosystem Architecture

### 1.1 Organizational Topology

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

### 1.2 Multi-Tenant Isolation Strategy

The architecture implements **three-tier tenant isolation**:

| Tier              | Scope                   | Isolation Mechanism                                             |
| ----------------- | ----------------------- | --------------------------------------------------------------- |
| **Platform**      | Cross-tenant operations | Global admin operations, analytics, billing aggregation         |
| **Organization**  | Single CHR or Supplier  | Complete data isolation between competing entities              |
| **Business Unit** | Sub-entities within org | Hierarchical access (restaurant locations, supplier warehouses) |

---

## 2. Resource Taxonomy & Access Control Matrix

### 2.1 Core Resource Categories

#### A. Identity & Access Management Resources

| Resource        | Description                         | Sensitivity Level |
| --------------- | ----------------------------------- | ----------------- |
| `user`          | Platform user accounts              | Critical          |
| `organization`  | Tenant organizations                | Critical          |
| `business_unit` | Sub-entities (locations, divisions) | High              |
| `role`          | Role definitions per tenant         | High              |
| `permission`    | Granular permission grants          | High              |
| `invitation`    | Pending membership invitations      | Medium            |
| `api_key`       | Service account credentials         | Critical          |

#### B. Commercial Resources

| Resource     | Description                 | Compliance Relevance      |
| ------------ | --------------------------- | ------------------------- |
| `product`    | Product catalog entries     | FDA labeling requirements |
| `catalog`    | Curated product collections | Allergen declarations     |
| `price_list` | Customer-specific pricing   | Contract compliance       |
| `contract`   | Procurement agreements      | Legal audit trails        |
| `promotion`  | Discount campaigns          | Financial reporting       |
| `quote`      | Custom pricing requests     | Sales workflow            |

#### C. Transaction Resources

| Resource         | Description            | Workflow Integration     |
| ---------------- | ---------------------- | ------------------------ |
| `cart`           | Shopping carts         | Real-time inventory      |
| `order`          | Purchase orders        | Approval workflows       |
| `purchase_order` | Formal PO documents    | Three-way matching       |
| `invoice`        | Billing documents      | Accounts payable         |
| `payment`        | Payment transactions   | PCI-DSS compliance       |
| `credit_note`    | Refund/adjustment docs | Financial reconciliation |

#### D. Supply Chain Resources

| Resource                 | Description        | FSMA 204 Requirements          |
| ------------------------ | ------------------ | ------------------------------ |
| `inventory`              | Stock levels       | Real-time traceability         |
| `lot`                    | Batch/lot tracking | Critical tracking events (CTE) |
| `shipment`               | Delivery logistics | Temperature monitoring         |
| `warehouse`              | Storage locations  | Sanitation controls            |
| `supplier_certification` | Compliance docs    | Supplier verification          |
| `recall_notice`          | Product recalls    | Rapid response capability      |

#### E. Operational Resources

| Resource           | Description                 | Multi-tenant Considerations  |
| ------------------ | --------------------------- | ---------------------------- |
| `analytics_report` | Business intelligence       | Aggregated vs. tenant-scoped |
| `audit_log`        | Compliance logging          | Immutable, tamper-proof      |
| `message`          | Platform communications     | Data retention policies      |
| `support_ticket`   | Customer service            | Cross-tenant agent access    |
| `integration`      | External system connections | Credential isolation         |

---

## 3. Organization-Specific Role Architectures

### 3.1 Marketplace Operator (Internal) Roles

The internal team requires **platform-global access** with strict separation of duties for compliance.

#### Role Hierarchy & Inheritance

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

#### Detailed Role Specifications

| Role                 | Primary Responsibilities                                               | Key Permissions                                                                                     | Constraints                                                                   |
| -------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **SUPER_ADMIN**      | Platform governance, emergency access, audit oversight                 | `*:*` (all resources, all actions)                                                                  | MFA required; Activity logged to immutable store; Cannot delete own account   |
| **ADMIN_OPERATIONS** | Daily platform management, supplier/CHR onboarding, dispute resolution | `user:manage`, `organization:validate`, `order:intervene`, `analytics:view`, `support:escalate`     | Cannot modify billing settings; Cannot access raw payment data                |
| **ADMIN_FINANCE**    | Commission management, invoicing, payout processing                    | `billing:manage`, `commission:configure`, `invoice:manage`, `refund:approve`, `analytics:financial` | Cannot modify product data; Cannot access customer PII beyond billing context |
| **ADMIN_COMPLIANCE** | FSMA/HACCP oversight, certification verification, recall management    | `certification:audit`, `recall:initiate`, `audit_log:view`, `supplier:verify`, `violation:flag`     | Read-only on commercial transactions; Cannot modify financial settings        |
| **ADMIN_SUPPORT**    | Customer service, technical troubleshooting, training                  | `support_ticket:manage`, `user:read`, `order:view`, `message:send`, `impersonate:user`              | Cannot approve refunds >$500; Cannot modify supplier catalogs                 |
| **ADMIN_PRODUCT**    | Feature releases, system configuration, integration management         | `feature_flag:manage`, `integration:configure`, `api_gateway:manage`, `system:monitor`              | Cannot access customer data; Cannot modify financial transactions             |
| **SYSTEM_SERVICE**   | Automated services, ETL processes, report generation                   | `api:service`, `report:generate`, `webhook:manage`                                                  | Service account only; Token-based auth; IP-restricted                         |

#### Internal Team Permission Matrix

| Permission                  | Super Admin | Ops Admin | Finance | Compliance | Support  | Product |
| --------------------------- | :---------: | :-------: | :-----: | :--------: | :------: | :-----: |
| **User Management**         |
| `user:create`               |     ✅      |    ✅     |   ❌    |     ❌     |    ❌    |   ❌    |
| `user:delete`               |     ✅      |   ⚠️\*    |   ❌    |     ❌     |    ❌    |   ❌    |
| `user:impersonate`          |     ✅      |    ✅     |   ❌    |     ❌     |    ✅    |   ❌    |
| **Organization Management** |
| `organization:validate`     |     ✅      |    ✅     |   ❌    |     ✅     |    ❌    |   ❌    |
| `organization:suspend`      |     ✅      |    ✅     | ⚠️\*\*  |     ✅     |    ❌    |   ❌    |
| `organization:delete`       |     ✅      |    ❌     |   ❌    |     ❌     |    ❌    |   ❌    |
| **Financial Operations**    |
| `commission:configure`      |     ✅      |    ❌     |   ✅    |     ❌     |    ❌    |   ❌    |
| `payout:process`            |     ✅      |    ❌     |   ✅    |     ❌     |    ❌    |   ❌    |
| `refund:approve`            |     ✅      | ⚠️\*\*\*  |   ✅    |     ❌     | ⚠️\*\*\* |   ❌    |
| **Compliance & Safety**     |
| `recall:initiate`           |     ✅      |    ❌     |   ❌    |     ✅     |    ❌    |   ❌    |
| `certification:audit`       |     ✅      |    ❌     |   ❌    |     ✅     |    ❌    |   ❌    |
| `audit_log:purge`           |     ✅      |    ❌     |   ❌    |     ❌     |    ❌    |   ❌    |
| **System Configuration**    |
| `feature_flag:manage`       |     ✅      |    ❌     |   ❌    |     ❌     |    ❌    |   ✅    |
| `integration:configure`     |     ✅      |    ❌     |   ❌    |     ❌     |    ❌    |   ✅    |

- Requires secondary approval
  ** Only with compliance concurrence \*** Limited to threshold amount

---

### 3.2 CHR (Buyer) Organization Roles

CHR organizations operate with **hierarchical approval workflows** and **location-based access control**.

#### Organizational Structure Model

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

#### Role Specifications: CHR Organizations

| Role                    | Business Function                                                       | Approval Authority                    | Scope               |
| ----------------------- | ----------------------------------------------------------------------- | ------------------------------------- | ------------------- |
| **CHR_OWNER**           | Strategic oversight, financial ultimate authority, contract negotiation | Unlimited                             | All business units  |
| **CHR_MANAGER**         | Operational management, staff supervision, budget allocation            | Up to $10,000/order                   | Assigned units      |
| **HEAD_CHEF**           | Menu planning, quality control, inventory management                    | Up to $5,000/order (ingredients only) | Assigned kitchen    |
| **PROCUREMENT_MANAGER** | Vendor selection, price negotiation, purchase orders                    | Up to $25,000/order                   | Assigned categories |
| **ACCOUNTANT**          | Invoice processing, payment authorization, financial reporting          | Payment approval up to $50,000        | Financial data only |
| **STAFF_OPERATOR**      | Daily ordering, receiving, inventory updates                            | Submit only (no approval)             | Assigned location   |

#### CHR Permission Matrix: Resource Access

| Resource/Action               | Owner |   Manager    | Head Chef | Procurement  |  Accountant  | Staff |
| ----------------------------- | :---: | :----------: | :-------: | :----------: | :----------: | :---: |
| **Organization Settings**     |
| `organization:update`         |  ✅   |      ❌      |    ❌     |      ❌      |      ❌      |  ❌   |
| `organization:manage_billing` |  ✅   |      ❌      |    ❌     |      ❌      |      ✅      |  ❌   |
| `business_unit:create`        |  ✅   |     ⚠️\*     |    ❌     |      ❌      |      ❌      |  ❌   |
| **User Management**           |
| `member:invite`               |  ✅   |      ✅      |    ❌     |      ❌      |      ❌      |  ❌   |
| `member:remove`               |  ✅   |      ✅      |    ❌     |      ❌      |      ❌      |  ❌   |
| `member:assign_role`          |  ✅   |    ⚠️\*\*    |    ❌     |      ❌      |      ❌      |  ❌   |
| **Catalog & Products**        |
| `product:view`                |  ✅   |      ✅      |    ✅     |      ✅      |      ✅      |  ✅   |
| `catalog:save_favorites`      |  ✅   |      ✅      |    ✅     |      ✅      |      ✅      |  ✅   |
| `catalog:manage_restricted`   |  ✅   |      ✅      |    ✅     |      ✅      |      ❌      |  ❌   |
| **Ordering & Procurement**    |
| `cart:create`                 |  ✅   |      ✅      |    ✅     |      ✅      |      ❌      |  ✅   |
| `order:submit`                |  ✅   |      ✅      |    ✅     |      ✅      |      ❌      |  ✅   |
| `order:approve_own`           |  ✅   |      ✅      |    ❌     |      ✅      |      ❌      |  ❌   |
| `order:approve_others`        |  ✅   |      ✅      |    ❌     |      ✅      |      ❌      |  ❌   |
| `order:cancel`                |  ✅   |      ✅      | ⚠️\*\*\*  |   ⚠️\*\*\*   |      ❌      |  ❌   |
| `purchase_order:generate`     |  ✅   |      ✅      |    ✅     |      ✅      |      ✅      |  ❌   |
| **Inventory Management**      |
| `inventory:view`              |  ✅   |      ✅      |    ✅     |      ✅      |      ✅      |  ✅   |
| `inventory:update`            |  ✅   |      ✅      |    ✅     |  ⚠️\*\*\*\*  |      ❌      |  ✅   |
| `inventory:configure_alerts`  |  ✅   |      ✅      |    ✅     |      ✅      |      ❌      |  ❌   |
| **Financial Operations**      |
| `invoice:view`                |  ✅   |      ✅      |    ❌     |      ✅      |      ✅      |  ❌   |
| `invoice:approve_payment`     |  ✅   |   ⚠️**\***   |    ❌     |      ❌      |      ✅      |  ❌   |
| `payment_method:configure`    |  ✅   |  ⚠️**\*\***  |    ❌     |      ❌      |      ✅      |  ❌   |
| `credit_limit:view`           |  ✅   |      ✅      |    ❌     |      ✅      |      ✅      |  ❌   |
| **Reporting & Analytics**     |
| `report:view_all`             |  ✅   |      ✅      |    ❌     |      ✅      |      ✅      |  ❌   |
| `report:export`               |  ✅   |      ✅      |    ❌     |      ✅      |      ✅      |  ❌   |
| `report:configure`            |  ✅   | ⚠️**\*\*\*** |    ❌     | ⚠️**\*\*\*** | ⚠️**\*\*\*** |  ❌   |
| **Compliance**                |
| `food_safety_doc:view`        |  ✅   |      ✅      |    ✅     |      ✅      |      ❌      |  ✅   |
| `allergen_alert:manage`       |  ✅   |      ✅      |    ✅     |      ❌      |      ❌      |  ❌   |
| `temperature_log:verify`      |  ✅   |      ✅      |    ✅     |      ❌      |      ❌      |  ✅   |

- Subject to subscription tier limits
  ** Cannot assign Owner role \*** Only if not yet processed \***\* Consumables only, not equipment
  \*\*\*** Up to $10,000
  **\*\*** Cannot add new payment methods, only select existing
  **\*\*\*** Own reports only, except Owner

#### CHR Approval Workflow Configuration

CHR organizations implement **multi-tier approval workflows** based on order value and product category:

```typescript
// Approval Rules Configuration
interface ApprovalRule {
  id: string;
  organizationId: string;
  triggerConditions: {
    minAmount?: number;
    maxAmount?: number;
    categories?: string[]; // 'equipment', 'perishables', 'alcohol'
    suppliers?: string[]; // Restricted suppliers
  };
  approverRoles: string[]; // Sequential or parallel
  approvalType: 'sequential' | 'parallel' | 'any_of';
  timeoutHours: number;
  escalationRole?: string;
}

// Example Rules for Restaurant Chain
const defaultApprovalRules: ApprovalRule[] = [
  {
    id: 'rule-001',
    organizationId: 'chr-enterprise-001',
    triggerConditions: { maxAmount: 500 },
    approverRoles: ['manager'], // Auto-approved below threshold, but logged
    approvalType: 'any_of',
    timeoutHours: 24,
  },
  {
    id: 'rule-002',
    organizationId: 'chr-enterprise-001',
    triggerConditions: { minAmount: 500, maxAmount: 5000, categories: ['perishables'] },
    approverRoles: ['head_chef', 'manager'], // Either can approve food orders
    approvalType: 'any_of',
    timeoutHours: 12,
    escalationRole: 'chr_owner',
  },
  {
    id: 'rule-003',
    organizationId: 'chr-enterprise-001',
    triggerConditions: { minAmount: 5000, categories: ['equipment'] },
    approverRoles: ['procurement_manager', 'accountant'], // Both required
    approvalType: 'sequential',
    timeoutHours: 48,
  },
  {
    id: 'rule-004',
    organizationId: 'chr-enterprise-001',
    triggerConditions: { minAmount: 25000 },
    approverRoles: ['chr_owner'], // Owner only for large capital
    approvalType: 'any_of',
    timeoutHours: 72,
  },
];
```

---

### 3.3 Supplier Organization Roles

Suppliers require **operational roles** focused on inventory, fulfillment, and B2B customer management, plus **compliance roles** for food safety.

#### Supplier Organizational Model

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

#### Role Specifications: Supplier Organizations

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

#### Supplier Permission Matrix: Resource Access

| Resource/Action                      | Owner |       Sales Mgr        |  Inventory Mgr   |     WH Mgr     |     Production     | Logistics  | Finance  |   QA   |         Cust Rep         |
| ------------------------------------ | :---: | :--------------------: | :--------------: | :------------: | :----------------: | :--------: | :------: | :----: | :----------------------: |
| **Organization & Settings**          |
| `organization:update`                |  ✅   |           ❌           |        ❌        |       ❌       |         ❌         |     ❌     |    ❌    |   ❌   |            ❌            |
| `organization:configure_delivery`    |  ✅   |           ❌           |        ❌        |       ❌       |         ❌         |     ✅     |    ❌    |   ❌   |            ❌            |
| `organization:manage_certifications` |  ✅   |           ❌           |        ❌        |       ❌       |         ❌         |     ❌     |    ❌    |   ✅   |            ❌            |
| **Product Catalog**                  |
| `product:create`                     |  ✅   |           ✅           |        ❌        |       ❌       |        ⚠️\*        |     ❌     |    ❌    | ⚠️\*\* |            ❌            |
| `product:update`                     |  ✅   |           ✅           |     ⚠️\*\*\*     |       ❌       |        ⚠️\*        |     ❌     |    ❌    | ⚠️\*\* |            ❌            |
| `product:delete`                     |  ✅   |       ⚠️\*\*\*\*       |        ❌        |       ❌       |         ❌         |     ❌     |    ❌    |   ❌   |            ❌            |
| `catalog:publish`                    |  ✅   |           ✅           |        ❌        |       ❌       |         ❌         |     ❌     |    ❌    |   ✅   |            ❌            |
| `catalog:manage_pricing`             |  ✅   |           ✅           |        ❌        |       ❌       |         ❌         |     ❌     | ⚠️**\*** |   ❌   |            ❌            |
| **Inventory & Lots**                 |
| `inventory:view_all`                 |  ✅   |           ✅           |        ✅        |   ⚠️**\*\***   |         ✅         | ⚠️**\*\*** |    ❌    |   ✅   |        ⚠️**\*\***        |
| `inventory:update`                   |  ✅   |           ❌           |        ✅        |       ✅       |    ⚠️**\*\*\***    |     ❌     |    ❌    |   ❌   |            ❌            |
| `lot:create`                         |  ✅   |           ❌           |        ✅        | ⚠️**\*\*\*\*** |         ✅         |     ❌     |    ❌    |   ✅   |            ❌            |
| `lot:trace`                          |  ✅   |           ❌           |        ✅        |       ✅       |         ✅         |     ✅     |    ❌    |   ✅   |            ❌            |
| `recall:initiate`                    |  ✅   |           ❌           | ⚠️\***\*\*\*\*** |       ❌       |  ⚠️\***\*\*\*\***  |     ❌     |    ❌    |   ✅   |            ❌            |
| **Order Management**                 |
| `order:view_all`                     |  ✅   |           ✅           |        ✅        |       ✅       |         ✅         |     ✅     |    ✅    |   ✅   |            ✅            |
| `order:process`                      |  ✅   |           ❌           |        ✅        |       ✅       | ⚠️\***\*\*\*\*\*** |     ✅     |    ❌    |   ❌   |   ⚠️\***\*\*\*\*\*\***   |
| `order:cancel`                       |  ✅   | ⚠️\***\*\*\*\*\*\*\*** |        ❌        |       ❌       |         ❌         |     ❌     |    ❌    |   ❌   |  ⚠️\***\*\*\*\*\*\*\***  |
| **Customer Management**              |
| `customer:view`                      |  ✅   |           ✅           |        ❌        |       ❌       |         ❌         |     ❌     |    ✅    |   ❌   |            ✅            |
| `customer:update_credit`             |  ✅   |  ⚠️**\*\***\***\*\***  |        ❌        |       ❌       |         ❌         |     ❌     |    ✅    |   ❌   |            ❌            |
| `customer:onboard`                   |  ✅   |           ✅           |        ❌        |       ❌       |         ❌         |     ❌     |    ❌    |   ❌   |  ⚠️**\*\***\*\***\*\***  |
| **Financial**                        |
| `invoice:generate`                   |  ✅   |           ❌           |        ❌        |       ❌       |         ❌         |     ❌     |    ✅    |   ❌   |            ❌            |
| `invoice:send`                       |  ✅   |           ❌           |        ❌        |       ❌       |         ❌         |     ❌     |    ✅    |   ❌   |            ❌            |
| `payment:reconcile`                  |  ✅   |           ❌           |        ❌        |       ❌       |         ❌         |     ❌     |    ✅    |   ❌   |            ❌            |
| **Analytics & Reporting**            |
| `report:sales`                       |  ✅   |           ✅           |        ❌        |       ❌       |         ❌         |     ❌     |    ✅    |   ❌   | ⚠️**\*\***\*\*\***\*\*** |
| `report:inventory`                   |  ✅   |           ❌           |        ✅        |       ✅       |         ✅         |     ✅     |    ❌    |   ✅   |            ❌            |
| `report:compliance`                  |  ✅   |           ❌           |        ❌        |       ❌       |         ❌         |     ❌     |    ❌    |   ✅   |            ❌            |

- Ingredient/specification updates only
  ** Labeling/allergen updates only \*** Stock quantity updates only \***\* Soft delete only (archiving)
  \*\*\*** View pricing, suggest changes
  **\*\*** View assigned warehouses only
  **\*\*\*** Raw material consumption reporting
  **\*\*\*\*** Receive/put-away operations only \***\*\*\*\*** With QA concurrence \***\*\*\*\*\*** Production scheduling only \***\*\*\*\*\*\*** Status updates, not processing \***\*\*\*\*\*\*\*** If order not yet shipped
  **\*\***\***\*\*** Up to approved limit
  **\*\***\*\***\*\*** Collect docs, forward to Sales Mgr
  **\*\***\*\*\***\*\*** Own accounts only

---

## 4. Cross-Functional Permission Patterns

### 4.1 Three-Dimensional Access Control

The RBAC model implements **three dimensions** of access control:

```
┌─────────────────────────────────────────────────────────┐
│                 ACCESS CONTROL DIMENSIONS               │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. HORIZONTAL (Resource Type)                          │
│     ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐    │
│     │  User   │ │ Product │ │  Order  │ │ Invoice │    │
│     │  Mgmt   │ │ Catalog │ │  Mgmt   │ │  Mgmt   │    │
│     └─────────┘ └─────────┘ └─────────┘ └─────────┘    │
│                                                         │
│  2. VERTICAL (Action Type)                              │
│     ┌─────────┐                                         │
│     │  CREATE │  ──────┐                                │
│     ├─────────┤        │                                │
│     │  READ   │        ├── Permission Granularity        │
│     ├─────────┤        │                                │
│     │ UPDATE  │  ──────┘                                │
│     ├─────────┤                                         │
│     │ DELETE  │                                         │
│     ├─────────┤                                         │
│     │  ADMIN  │ (Manage permissions, configure)         │
│     └─────────┘                                         │
│                                                         │
│  3. DEPTH (Scope/Visibility)                            │
│     ┌─────────┐ ┌─────────┐ ┌─────────┐                 │
│     │  OWN    │ │  TEAM   │ │BUSINESS │ │ ORGANIZATION│ │
│     │ RECORDS │ │  UNIT   │ │  UNIT   │ │    WIDE     │ │
│     └─────────┘ └─────────┘ └─────────┘ └─────────────┘ │
│                                                         │
│  Example: A Chef can UPDATE (vertical) ORDERS (horizontal)│
│           but only for OWN RECORDS (depth) up to $5,000  │
│           (conditional attribute)                        │
└─────────────────────────────────────────────────────────┘
```

### 4.2 Conditional Permissions (ABAC Extensions)

For complex B2B scenarios, the RBAC model incorporates **attribute-based conditions**:

| Condition Type  | Description               | Example                                                         |
| --------------- | ------------------------- | --------------------------------------------------------------- |
| **Temporal**    | Time-based restrictions   | `order:approve` only during business hours (6AM-10PM)           |
| **Monetary**    | Value-based thresholds    | `order:approve` where `order.total < $10,000`                   |
| **Geographic**  | Location-based scope      | `inventory:view` for `warehouse.region == user.assigned_region` |
| **Categorical** | Product-type restrictions | `order:approve` for `product.category != 'alcohol'`             |
| **Relational**  | Relationship-based        | `customer:view` for `customer.assigned_rep == user.id`          |

### 4.3 Delegation & Temporary Elevations

| Pattern                 | Use Case                                | Implementation                               |
| ----------------------- | --------------------------------------- | -------------------------------------------- |
| **Temporary Elevation** | Manager on vacation, delegates approval | Time-bound role assignment with audit trail  |
| **Emergency Override**  | Recall situation, need immediate action | Break-glass protocol with post-hoc approval  |
| **Cross-Training**      | Shadow mode for new employees           | Read-only access to mentor's scope           |
| **Project-Based**       | Special event (catering large wedding)  | Temporary business unit with specific budget |

---

## 5. Compliance & Audit Requirements

### 5.1 FSMA 204 Food Traceability Compliance

| Requirement                        | RBAC Implementation                                                       | Responsible Roles                     |
| ---------------------------------- | ------------------------------------------------------------------------- | ------------------------------------- |
| **Critical Tracking Events (CTE)** | `lot:trace`, `lot:update` permissions with immutable logging              | Inventory Manager, QA, Supplier Owner |
| **Supplier Verification**          | `supplier_certification:audit` permission with document retention         | Compliance Admin, QA                  |
| **Preventive Controls**            | `haccp_plan:view`, `monitoring_record:create` with signature requirements | Production Manager, QA                |
| **Recall Management**              | `recall:initiate` with automatic notification to Compliance Admin         | QA, Supplier Owner, Compliance Admin  |
| **Audit Trail**                    | All `lot` and `shipment` actions logged with user attribution             | System-enforced for all roles         |

### 5.2 Financial Compliance (SOX, PCI-DSS)

| Control                          | RBAC Measure                                                                                  |
| -------------------------------- | --------------------------------------------------------------------------------------------- |
| **Separation of Duties**         | Order creation (Staff) → Approval (Manager) → Payment (Accountant) → Reconciliation (Finance) |
| **Privileged Access Monitoring** | All `refund:approve`, `commission:configure` actions require secondary approval               |
| **Immutable Audit Logs**         | All permission changes logged to tamper-proof storage (WORM)                                  |
| **Access Recertification**       | Quarterly automated review of all admin roles; annual for operational roles                   |

---

## 6. Implementation Architecture

### 6.1 Permission Evaluation Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    PERMISSION CHECK FLOW                     │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────┐
│  1. AUTHENTICATION                    │
│     Verify JWT token, MFA if required │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  2. TENANT ISOLATION                  │
│     Extract tenant_id from token      │
│     Verify user belongs to tenant     │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  3. ROLE RESOLUTION                   │
│     Get all roles for user in tenant  │
│     Resolve role hierarchy            │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  4. PERMISSION EVALUATION             │
│     Check if any role grants perm     │
│     Evaluate ABAC conditions          │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  5. RESOURCE SCOPE CHECK              │
│     Verify resource belongs to tenant │
│     Check business unit scope         │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  6. AUDIT LOGGING                     │
│     Log access decision with context  │
│     Async write to audit store        │
└──────────────┬───────────────────────┘
               │
               ▼
        [ALLOW] or [DENY]
```

### 6.2 Database Schema (Simplified)

```sql
-- Core RBAC Tables
CREATE TABLE roles (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL, -- NULL for platform roles
    name VARCHAR(100) NOT NULL,
    description TEXT,
    parent_role_id UUID REFERENCES roles(id),
    is_system_role BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);

CREATE TABLE permissions (
    id UUID PRIMARY KEY,
    resource VARCHAR(100) NOT NULL, -- 'order', 'product', etc.
    action VARCHAR(100) NOT NULL,   -- 'create', 'approve', etc.
    conditions JSONB,               -- ABAC conditions
    description TEXT
);

CREATE TABLE role_permissions (
    role_id UUID REFERENCES roles(id),
    permission_id UUID REFERENCES permissions(id),
    PRIMARY KEY (role_id, permission_id)
);

-- User-Role Assignment with Business Unit Scoping
CREATE TABLE user_roles (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    role_id UUID NOT NULL REFERENCES roles(id),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    business_unit_id UUID REFERENCES business_units(id), -- NULL = all units
    assigned_by UUID REFERENCES users(id),
    valid_from TIMESTAMP DEFAULT NOW(),
    valid_until TIMESTAMP, -- NULL = permanent
    is_delegation BOOLEAN DEFAULT false,
    delegation_reason TEXT
);

-- Approval Workflows
CREATE TABLE approval_rules (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    name VARCHAR(200),
    trigger_conditions JSONB NOT NULL,
    approver_role_ids UUID[] NOT NULL,
    approval_type VARCHAR(20) CHECK (approval_type IN ('sequential', 'parallel', 'any_of')),
    timeout_hours INTEGER,
    escalation_role_id UUID REFERENCES roles(id),
    is_active BOOLEAN DEFAULT true
);

-- Immutable Audit Log
CREATE TABLE access_audit_log (
    id UUID PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT NOW(),
    user_id UUID,
    tenant_id UUID,
    action VARCHAR(100),
    resource_type VARCHAR(100),
    resource_id UUID,
    decision BOOLEAN, -- allowed or denied
    context JSONB,    -- IP, user agent, etc.
    reason TEXT
) PARTITION BY RANGE (timestamp);
```

---

## 7. Validation Against Business Scenarios

### Scenario 1: Multi-Location Restaurant Chain

**Context**: 50-location restaurant chain, centralized procurement but local receiving.

| Requirement                           | RBAC Solution                                                      |
| ------------------------------------- | ------------------------------------------------------------------ |
| Central procurement negotiates prices | `PROCUREMENT_MANAGER` at enterprise level with `price_list:view`   |
| Local managers approve daily orders   | `MANAGER` role with `order:approve` scoped to location + $5K limit |
| Chefs manage ingredient inventory     | `HEAD_CHEF` with `inventory:update` for perishables only           |
| Accountants see all invoices          | `ACCOUNTANT` with `invoice:view` across all business units         |

### Scenario 2: Food Distributor with FSMA Compliance

**Context**: National distributor with 10 warehouses, HACCP certified.

| Requirement                    | RBAC Solution                                                                    |
| ------------------------------ | -------------------------------------------------------------------------------- |
| Lot tracking across warehouses | `INVENTORY_MANAGER` with `lot:trace` + `lot:create`                              |
| Temperature breach response    | `WAREHOUSE_MANAGER` with `alert:acknowledge` + auto-escalation to `QA`           |
| Customer complaint → recall    | `CUSTOMER_REP` creates ticket → `QA` verifies → `SUPPLIER_OWNER` approves recall |
| Audit preparation              | `QA` exports all `lot` records + `COMPLIANCE_ADMIN` reviews certifications       |

### Scenario 3: Platform Dispute Resolution

**Context**: CHR claims supplier delivered wrong quantity.

| Actor                | Action               | Permission Check                                             |
| -------------------- | -------------------- | ------------------------------------------------------------ |
| **CHR Manager**      | Opens dispute ticket | `support_ticket:create` on own orders                        |
| **Support Agent**    | Views both sides     | `order:view` (cross-tenant for support) + `impersonate:user` |
| **Operations Admin** | Issues refund        | `refund:approve` up to $1,000; >$1K requires `FINANCE_ADMIN` |
| **Compliance Admin** | Reviews for pattern  | `audit_log:view` across affected suppliers                   |

---

## 8. Summary Tables for Implementation Teams

### 8.1 Quick Reference: Role-to-Permission Mapping

| Organization | Role          | Create            | Read              | Update           | Delete | Admin           |
| ------------ | ------------- | ----------------- | ----------------- | ---------------- | ------ | --------------- |
| **Operator** | Super Admin   | All               | All               | All              | All    | All             |
|              | Ops Admin     | Users, Orgs       | All               | Users, Orgs      | -      | Support         |
|              | Finance       | -                 | Billing           | Commission       | -      | Refunds         |
| **CHR**      | Owner         | All               | All               | All              | Soft   | All             |
|              | Manager       | Orders, Users     | All               | Orders, Staff    | -      | Local           |
|              | Chef          | Inventory         | Products, Recipes | Inventory        | -      | -               |
|              | Procurement   | Orders, Quotes    | Catalog, Prices   | Orders           | Cancel | -               |
|              | Accountant    | Payments          | Invoices, Reports | -                | -      | Payment Methods |
|              | Staff         | Carts             | Products, Orders  | Own Profile      | -      | -               |
| **Supplier** | Owner         | All               | All               | All              | Soft   | All             |
|              | Sales Manager | Customers, Quotes | Orders, Analytics | Pricing          | -      | Contracts       |
|              | Inventory Mgr | Lots, Adjustments | Stock Levels      | Stock, Locations | -      | Alerts          |
|              | QA            | Certifications    | Compliance Docs   | HACCP Records    | -      | Recalls         |
|              | Warehouse Mgr | Shipments         | Pick Lists        | Picking Status   | -      | -               |

### 8.2 Implementation Checklist

- [ ] **Database**: Create roles, permissions, and user_roles tables with tenant isolation
- [ ] **API Layer**: Implement middleware for permission checking on all protected routes
- [ ] **Frontend**: Build role-aware UI components (hide buttons based on permissions)
- [ ] **Approval Engine**: Configure workflow engine for multi-tier approvals
- [ ] **Audit System**: Implement immutable logging for all access decisions
- [ ] **Compliance**: Map FSMA 204 requirements to specific permission checks
- [ ] **Testing**: Create test matrix covering all role/resource combinations
- [ ] **Documentation**: Generate role descriptions for customer onboarding

This RBAC architecture provides a secure, compliant, and operationally efficient foundation for the B2B food marketplace, ensuring proper access control across complex organizational hierarchies while meeting regulatory requirements.
