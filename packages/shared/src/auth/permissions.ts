/**
 * RestoMarket Permission Definitions
 *
 * These are the shared permission statements and role definitions.
 * The actual access control is configured in the Next.js app where
 * Better Auth is initialized.
 *
 * This file exports the data structures that both apps can use.
 */

/**
 * Permission Statements
 *
 * Define all resources and their possible actions.
 * Using 'as const' for Better Auth's createAccessControl compatibility.
 */
export const statements = {
  // Organization management (from Better Auth defaults)
  organization: ['update', 'delete'],
  member: ['create', 'update', 'delete'],
  invitation: ['create', 'cancel'],

  // Custom RestoMarket resources
  product: ['create', 'read', 'update', 'delete', 'publish', 'archive'],
  order: ['create', 'read', 'update', 'delete', 'fulfill', 'refund', 'cancel'],
  customer: ['create', 'read', 'update', 'delete', 'export'],
  report: ['read', 'export', 'create'],
  settings: ['read', 'update'],
  billing: ['read', 'update', 'manage'],
  team: ['create', 'read', 'update', 'delete'],
} as const;

/**
 * Role Permission Mappings
 *
 * Each role defines what permissions it has for each resource.
 * Note: Arrays are kept mutable for Better Auth's newRole() compatibility.
 */
export const rolePermissions = {
  // Owner: Full access to everything
  owner: {
    organization: ['update', 'delete'] as ('update' | 'delete')[],
    member: ['create', 'update', 'delete'] as ('create' | 'update' | 'delete')[],
    invitation: ['create', 'cancel'] as ('create' | 'cancel')[],
    product: ['create', 'read', 'update', 'delete', 'publish', 'archive'] as (
      | 'create'
      | 'read'
      | 'update'
      | 'delete'
      | 'publish'
      | 'archive'
    )[],
    order: ['create', 'read', 'update', 'delete', 'fulfill', 'refund', 'cancel'] as (
      | 'create'
      | 'read'
      | 'update'
      | 'delete'
      | 'fulfill'
      | 'refund'
      | 'cancel'
    )[],
    customer: ['create', 'read', 'update', 'delete', 'export'] as (
      | 'create'
      | 'read'
      | 'update'
      | 'delete'
      | 'export'
    )[],
    report: ['read', 'export', 'create'] as ('read' | 'export' | 'create')[],
    settings: ['read', 'update'] as ('read' | 'update')[],
    billing: ['read', 'update', 'manage'] as ('read' | 'update' | 'manage')[],
    team: ['create', 'read', 'update', 'delete'] as ('create' | 'read' | 'update' | 'delete')[],
  },

  // Admin: Full access except billing management and org deletion
  admin: {
    organization: ['update'] as ('update' | 'delete')[],
    member: ['create', 'update', 'delete'] as ('create' | 'update' | 'delete')[],
    invitation: ['create', 'cancel'] as ('create' | 'cancel')[],
    product: ['create', 'read', 'update', 'delete', 'publish', 'archive'] as (
      | 'create'
      | 'read'
      | 'update'
      | 'delete'
      | 'publish'
      | 'archive'
    )[],
    order: ['create', 'read', 'update', 'delete', 'fulfill', 'refund', 'cancel'] as (
      | 'create'
      | 'read'
      | 'update'
      | 'delete'
      | 'fulfill'
      | 'refund'
      | 'cancel'
    )[],
    customer: ['create', 'read', 'update', 'delete', 'export'] as (
      | 'create'
      | 'read'
      | 'update'
      | 'delete'
      | 'export'
    )[],
    report: ['read', 'export', 'create'] as ('read' | 'export' | 'create')[],
    settings: ['read', 'update'] as ('read' | 'update')[],
    billing: ['read'] as ('read' | 'update' | 'manage')[],
    team: ['create', 'read', 'update', 'delete'] as ('create' | 'read' | 'update' | 'delete')[],
  },

  // Manager: Can manage products, orders, and customers
  manager: {
    member: ['create'] as ('create' | 'update' | 'delete')[],
    invitation: ['create'] as ('create' | 'cancel')[],
    product: ['create', 'read', 'update', 'publish'] as (
      | 'create'
      | 'read'
      | 'update'
      | 'delete'
      | 'publish'
      | 'archive'
    )[],
    order: ['create', 'read', 'update', 'fulfill'] as (
      | 'create'
      | 'read'
      | 'update'
      | 'delete'
      | 'fulfill'
      | 'refund'
      | 'cancel'
    )[],
    customer: ['read', 'update'] as ('create' | 'read' | 'update' | 'delete' | 'export')[],
    report: ['read'] as ('read' | 'export' | 'create')[],
    settings: ['read'] as ('read' | 'update')[],
    team: ['read'] as ('create' | 'read' | 'update' | 'delete')[],
  },

  // Member: Basic read access with limited write
  member: {
    product: ['read'] as ('create' | 'read' | 'update' | 'delete' | 'publish' | 'archive')[],
    order: ['read', 'create'] as (
      | 'create'
      | 'read'
      | 'update'
      | 'delete'
      | 'fulfill'
      | 'refund'
      | 'cancel'
    )[],
    customer: ['read'] as ('create' | 'read' | 'update' | 'delete' | 'export')[],
    report: ['read'] as ('read' | 'export' | 'create')[],
    team: ['read'] as ('create' | 'read' | 'update' | 'delete')[],
  },

  // Viewer: Read-only access
  viewer: {
    product: ['read'] as ('create' | 'read' | 'update' | 'delete' | 'publish' | 'archive')[],
    order: ['read'] as (
      | 'create'
      | 'read'
      | 'update'
      | 'delete'
      | 'fulfill'
      | 'refund'
      | 'cancel'
    )[],
    customer: ['read'] as ('create' | 'read' | 'update' | 'delete' | 'export')[],
  },
};

// Type exports
export type Role = keyof typeof rolePermissions;
export type Resource = keyof typeof statements;
export type Statement = typeof statements;
export type Permission = {
  [K in Resource]?: readonly (typeof statements)[K][number][];
};

/**
 * List of all available roles
 */
export const availableRoles: Role[] = ['owner', 'admin', 'manager', 'member', 'viewer'];

/**
 * Helper function to check if a role has a specific permission
 */
export function hasPermission(role: Role, resource: Resource, action: string): boolean {
  const permissions = rolePermissions[role];
  if (!permissions) return false;

  const resourcePermissions = permissions[resource as keyof typeof permissions];
  if (!resourcePermissions) return false;

  return (resourcePermissions as readonly string[]).includes(action);
}

/**
 * Helper function to check if a role has all specified permissions
 */
export function hasAllPermissions(role: Role, permissions: Permission): boolean {
  for (const [resource, actions] of Object.entries(permissions)) {
    if (!actions) continue;
    for (const action of actions) {
      if (!hasPermission(role, resource as Resource, action)) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Helper function to check if a role has any of the specified permissions
 */
export function hasAnyPermission(role: Role, permissions: Permission): boolean {
  for (const [resource, actions] of Object.entries(permissions)) {
    if (!actions) continue;
    for (const action of actions) {
      if (hasPermission(role, resource as Resource, action)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: Role): Permission {
  return rolePermissions[role] as Permission;
}

/**
 * Format permission string (e.g., 'product:create')
 */
export function formatPermission(resource: Resource, action: string): string {
  return `${resource}:${action}`;
}

/**
 * Parse permission string (e.g., 'product:create' -> { resource: 'product', action: 'create' })
 */
export function parsePermission(permission: string): { resource: Resource; action: string } | null {
  const [resource, action] = permission.split(':');
  if (!resource || !action) return null;
  if (!Object.keys(statements).includes(resource)) return null;
  return { resource: resource as Resource, action };
}
