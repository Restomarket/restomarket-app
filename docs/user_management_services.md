# User Management Services: Restomarket B2B Marketplace

## Executive Summary

This document details the **User Management Services** for the Restomarket B2B food marketplace platform, focusing on user lifecycle operations: **onboarding** (invitations, verifications), **role assignments**, and **offboarding** processes. It provides comprehensive workflows, technical implementation patterns, and operational procedures across three organizational domains: **Marketplace Operators**, **CHR Buyers**, and **Food Suppliers**.

---

## 1. User Lifecycle Overview

### 1.1 User Lifecycle Stages

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER LIFECYCLE STAGES                         │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│  1. INVITATION  │  User invited to join organization
│  & REGISTRATION │  Email verification, account creation
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  2. VALIDATION  │  Platform admin validates organization
│  & VERIFICATION │  Compliance checks, document verification
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  3. ROLE        │  Role assignment based on job function
│  ASSIGNMENT     │  Permission configuration, threshold setup
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  4. ACTIVE      │  User performs daily operations
│  OPERATIONS     │  Role updates, permission changes
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  5. OFFBOARDING │  User removal, access revocation
│  & ARCHIVAL     │  Data retention, audit trail preservation
└─────────────────┘
```

---

## 2. User Onboarding Services

### 2.1 Onboarding Workflows by Organization Type

#### 2.1.1 Marketplace Operator Onboarding

**Process**: Internal HR-driven process with strict security controls

**Steps**:

1. **HR Initiates**: HR creates platform admin account
2. **Super Admin Approval**: Super Admin reviews and approves
3. **MFA Setup**: Mandatory two-factor authentication
4. **Role Assignment**: Assign specific admin role (Operations, Finance, Compliance, Support, Product)
5. **Training**: Complete platform admin training
6. **Audit Log**: All actions logged to immutable storage

**Technical Implementation**:

```typescript
// Platform admin creation (server-side only)
async function createPlatformAdmin(data: {
  email: string;
  name: string;
  role: 'operations' | 'finance' | 'compliance' | 'support' | 'product';
}) {
  // 1. Create user account
  const user = await auth.api.signUp({
    email: data.email,
    name: data.name,
    password: generateSecurePassword(),
    role: 'admin',
    isPlatformAdmin: true,
  });

  // 2. Send setup email with MFA instructions
  await sendAdminSetupEmail(user.email, {
    setupUrl: generateSetupUrl(user.id),
    mfaRequired: true,
  });

  // 3. Log creation event
  await auditLog.create({
    action: 'admin_created',
    userId: user.id,
    role: data.role,
    createdBy: getCurrentAdmin().id,
  });

  return user;
}
```

---

#### 2.1.2 CHR Organization Onboarding

**Process**: Self-registration with admin validation

**Steps**:

1. **Self-Registration**: CHR Owner registers via platform
2. **Company Information**: Provide company details (name, ICE number, RC number, sector, legal status)
3. **Document Upload**: Upload business registration documents
4. **Email Verification**: Verify email address
5. **Platform Validation**: Admin validates registration and documents
6. **Organization Creation**: Auto-create organization upon approval
7. **Owner Role Assignment**: Creator assigned as CHR_OWNER
8. **Team Invitations**: Owner invites team members

**Registration Form Fields**:

- Company Name
- ICE Number (Identifiant Commun de l'Entreprise)
- RC Number (Registre de Commerce)
- Legal Status (SARL, SA, SAS, etc.)
- Sector (Restaurant, Hotel, Café, Catering)
- Sub-sector (conditional dropdown based on sector)
- Address, Phone, Email
- Business Registration Certificate (upload)

**Technical Implementation**:

```typescript
// CHR registration workflow
async function registerCHROrganization(data: {
  // User info
  email: string;
  name: string;
  password: string;
  // Company info
  companyName: string;
  iceNumber: string;
  rcNumber: string;
  legalStatus: string;
  sector: string;
  subSector?: string;
  address: string;
  phone: string;
  // Documents
  businessCertificate: File;
}) {
  // 1. Create user account (unverified)
  const user = await auth.api.signUp({
    email: data.email,
    name: data.name,
    password: data.password,
    emailVerified: false,
    additionalFields: {
      companyName: data.companyName,
      iceNumber: data.iceNumber,
      verified: false, // Platform admin must verify
    },
  });

  // 2. Send email verification
  await auth.api.sendVerificationEmail({ email: data.email });

  // 3. Store pending organization data
  await prisma.pendingOrganization.create({
    data: {
      userId: user.id,
      name: data.companyName,
      type: 'chr',
      metadata: {
        iceNumber: data.iceNumber,
        rcNumber: data.rcNumber,
        legalStatus: data.legalStatus,
        sector: data.sector,
        subSector: data.subSector,
        address: data.address,
        phone: data.phone,
      },
      documents: {
        businessCertificate: await uploadDocument(data.businessCertificate),
      },
      status: 'pending_validation',
    },
  });

  // 4. Notify platform admin for validation
  await notifyAdminForValidation(user.id, data.companyName);

  return { userId: user.id, status: 'pending_validation' };
}

// Admin validation and organization creation
async function validateCHRRegistration(pendingOrgId: string, approved: boolean) {
  const pendingOrg = await prisma.pendingOrganization.findUnique({
    where: { id: pendingOrgId },
    include: { user: true },
  });

  if (!pendingOrg) throw new Error('Pending organization not found');

  if (!approved) {
    // Reject registration
    await prisma.pendingOrganization.update({
      where: { id: pendingOrgId },
      data: { status: 'rejected' },
    });
    await sendRejectionEmail(pendingOrg.user.email);
    return;
  }

  // Create organization
  const organization = await auth.api.createOrganization({
    name: pendingOrg.name,
    slug: generateSlug(pendingOrg.name),
    metadata: {
      type: 'chr',
      ...pendingOrg.metadata,
    },
  });

  // Assign creator as CHR_OWNER
  await auth.api.addMember({
    organizationId: organization.id,
    userId: pendingOrg.userId,
    role: 'chr_manager', // Default to manager, can be upgraded
  });

  // Set as active organization
  await auth.api.setActiveOrganization({
    userId: pendingOrg.userId,
    organizationId: organization.id,
  });

  // Create default CHR settings
  await prisma.chrSettings.create({
    data: {
      organizationId: organization.id,
      defaultOrderThreshold: 1000,
      paymentMethods: ['card', 'cash_on_delivery'],
    },
  });

  // Mark user as verified
  await prisma.user.update({
    where: { id: pendingOrg.userId },
    data: { verified: true },
  });

  // Update pending org status
  await prisma.pendingOrganization.update({
    where: { id: pendingOrgId },
    data: { status: 'approved', organizationId: organization.id },
  });

  // Send approval email
  await sendApprovalEmail(pendingOrg.user.email, organization.id);

  return organization;
}
```

---

#### 2.1.3 Supplier Organization Onboarding

**Process**: Similar to CHR with additional compliance requirements

**Steps**:

1. **Self-Registration**: Supplier Owner registers
2. **Company Information**: Provide supplier details (name, ICE, RC, certifications)
3. **Compliance Documents**: Upload certifications (HACCP, food safety, business license)
4. **Email Verification**: Verify email address
5. **Platform Validation**: Admin validates registration and compliance docs
6. **Organization Creation**: Auto-create supplier organization
7. **Owner Role Assignment**: Creator assigned as SUPPLIER_OWNER
8. **Initial Setup**: Configure payment terms, delivery methods
9. **Team Invitations**: Owner invites team members

**Additional Supplier Fields**:

- Food Safety Certifications
- HACCP Certification
- Product Categories (produce, dairy, meat, etc.)
- Warehouse Locations
- Delivery Capabilities
- Payment Terms (net 30, net 60, etc.)

**Technical Implementation**:

```typescript
// Supplier registration workflow
async function registerSupplierOrganization(data: {
  // User info
  email: string;
  name: string;
  password: string;
  // Company info
  companyName: string;
  iceNumber: string;
  rcNumber: string;
  legalStatus: string;
  productCategories: string[];
  // Compliance
  haccpCertificate?: File;
  foodSafetyCertificate?: File;
  businessLicense: File;
  // Operations
  warehouseLocations: Array<{ address: string; capacity: number }>;
  deliveryMethods: string[];
  paymentTerms: string;
}) {
  // 1. Create user account (unverified)
  const user = await auth.api.signUp({
    email: data.email,
    name: data.name,
    password: data.password,
    emailVerified: false,
    additionalFields: {
      companyName: data.companyName,
      iceNumber: data.iceNumber,
      verified: false,
    },
  });

  // 2. Send email verification
  await auth.api.sendVerificationEmail({ email: data.email });

  // 3. Store pending organization with compliance docs
  await prisma.pendingOrganization.create({
    data: {
      userId: user.id,
      name: data.companyName,
      type: 'supplier',
      metadata: {
        iceNumber: data.iceNumber,
        rcNumber: data.rcNumber,
        legalStatus: data.legalStatus,
        productCategories: data.productCategories,
        warehouseLocations: data.warehouseLocations,
        deliveryMethods: data.deliveryMethods,
        paymentTerms: data.paymentTerms,
      },
      documents: {
        businessLicense: await uploadDocument(data.businessLicense),
        haccpCertificate: data.haccpCertificate
          ? await uploadDocument(data.haccpCertificate)
          : null,
        foodSafetyCertificate: data.foodSafetyCertificate
          ? await uploadDocument(data.foodSafetyCertificate)
          : null,
      },
      status: 'pending_validation',
    },
  });

  // 4. Notify compliance admin for validation
  await notifyComplianceAdminForValidation(user.id, data.companyName);

  return { userId: user.id, status: 'pending_validation' };
}
```

---

### 2.2 Team Member Invitation Workflows

#### 2.2.1 Invitation Process

**Steps**:

1. **Initiator**: Organization Owner or Manager initiates invitation
2. **Role Selection**: Select role for invitee (Manager, Chef, Staff, etc.)
3. **Email Invitation**: System sends invitation email with unique link
4. **Acceptance**: Invitee clicks link and creates account
5. **Role Assignment**: Role automatically assigned upon acceptance
6. **Onboarding**: Invitee completes profile and training

**Technical Implementation**:

```typescript
// Invite team member to organization
async function inviteTeamMember(data: {
  organizationId: string;
  email: string;
  role: string;
  invitedBy: string;
  metadata?: {
    assignedStores?: string[]; // For multi-store
    orderThreshold?: number; // For approval limits
  };
}) {
  // 1. Validate inviter has permission
  const inviter = await auth.api.getMember({
    organizationId: data.organizationId,
    userId: data.invitedBy,
  });

  if (!hasPermission(inviter.role, 'member:invite')) {
    throw new Error('Insufficient permissions to invite members');
  }

  // 2. Validate role is appropriate for organization type
  const organization = await auth.api.getOrganization({
    organizationId: data.organizationId,
  });

  const validRoles =
    organization.metadata.type === 'chr'
      ? ['chr_manager', 'chef', 'purchasing_manager', 'cfo_accountant', 'staff']
      : ['sales_manager', 'store_manager', 'product_manager', 'logistics_manager', 'customer_rep'];

  if (!validRoles.includes(data.role)) {
    throw new Error(`Invalid role for ${organization.metadata.type} organization`);
  }

  // 3. Create invitation
  const invitation = await auth.api.createInvitation({
    organizationId: data.organizationId,
    email: data.email,
    role: data.role,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    metadata: data.metadata,
  });

  // 4. Send invitation email
  await sendInvitationEmail({
    to: data.email,
    organizationName: organization.name,
    role: data.role,
    invitedBy: inviter.user.name,
    invitationUrl: generateInvitationUrl(invitation.id),
  });

  // 5. Log invitation
  await auditLog.create({
    action: 'member_invited',
    organizationId: data.organizationId,
    invitedEmail: data.email,
    role: data.role,
    invitedBy: data.invitedBy,
  });

  return invitation;
}

// Accept invitation and create account
async function acceptInvitation(
  invitationId: string,
  userData: {
    name: string;
    password: string;
  },
) {
  // 1. Get invitation
  const invitation = await auth.api.getInvitation({ invitationId });

  if (!invitation || invitation.status !== 'pending') {
    throw new Error('Invalid or expired invitation');
  }

  // 2. Check if user already exists
  let user = await prisma.user.findUnique({
    where: { email: invitation.email },
  });

  if (!user) {
    // Create new user
    user = await auth.api.signUp({
      email: invitation.email,
      name: userData.name,
      password: userData.password,
      emailVerified: true, // Auto-verify invited users
    });
  }

  // 3. Add user to organization with assigned role
  await auth.api.addMember({
    organizationId: invitation.organizationId,
    userId: user.id,
    role: invitation.role,
    metadata: invitation.metadata,
  });

  // 4. Mark invitation as accepted
  await auth.api.updateInvitation({
    invitationId,
    status: 'accepted',
  });

  // 5. Set as active organization
  await auth.api.setActiveOrganization({
    userId: user.id,
    organizationId: invitation.organizationId,
  });

  // 6. Log acceptance
  await auditLog.create({
    action: 'invitation_accepted',
    organizationId: invitation.organizationId,
    userId: user.id,
    role: invitation.role,
  });

  return { user, organization: invitation.organization };
}
```

---

### 2.3 Email Verification Services

**Email Verification Flow**:

1. User registers or is invited
2. System sends verification email with unique token
3. User clicks verification link
4. Token validated and email marked as verified
5. User gains access to platform

**Technical Implementation**:

```typescript
// Send verification email
async function sendVerificationEmail(email: string) {
  const token = await auth.api.generateVerificationToken({ email });

  await sendEmail({
    to: email,
    subject: 'Verify your Restomarket account',
    template: 'email-verification',
    data: {
      verificationUrl: `${process.env.APP_URL}/verify-email?token=${token}`,
      expiresIn: '24 hours',
    },
  });
}

// Verify email with token
async function verifyEmail(token: string) {
  const result = await auth.api.verifyEmail({ token });

  if (!result.success) {
    throw new Error('Invalid or expired verification token');
  }

  await auditLog.create({
    action: 'email_verified',
    userId: result.user.id,
    email: result.user.email,
  });

  return result.user;
}
```

---

## 3. Role Assignment Services

### 3.1 Role Assignment Workflows

#### 3.1.1 Initial Role Assignment

**Process**: Automatic during onboarding or manual by authorized users

**Authorized Assigners**:

- **Platform Admin**: Can assign any role
- **Organization Owner**: Can assign any role within organization
- **Organization Manager**: Can assign roles except Owner

**Technical Implementation**:

```typescript
// Assign role to member
async function assignRole(data: {
  organizationId: string;
  userId: string;
  role: string;
  assignedBy: string;
  metadata?: {
    orderThreshold?: number;
    assignedStores?: string[];
    assignedCategories?: string[];
  };
}) {
  // 1. Validate assigner has permission
  const assigner = await auth.api.getMember({
    organizationId: data.organizationId,
    userId: data.assignedBy,
  });

  if (!hasPermission(assigner.role, 'member:update-role')) {
    throw new Error('Insufficient permissions to assign roles');
  }

  // 2. Prevent non-owners from assigning owner role
  if (data.role.includes('owner') && !assigner.role.includes('owner')) {
    throw new Error('Only owners can assign owner role');
  }

  // 3. Update member role
  await auth.api.updateMemberRole({
    organizationId: data.organizationId,
    userId: data.userId,
    role: data.role,
    metadata: data.metadata,
  });

  // 4. Log role assignment
  await auditLog.create({
    action: 'role_assigned',
    organizationId: data.organizationId,
    userId: data.userId,
    role: data.role,
    assignedBy: data.assignedBy,
    metadata: data.metadata,
  });

  // 5. Notify user of role change
  await sendRoleAssignmentEmail(data.userId, data.role);

  return { success: true };
}
```

---

#### 3.1.2 Role Update and Modification

**Use Cases**:

- Promotion (Staff → Manager)
- Demotion (Manager → Staff)
- Role change (Chef → Procurement Manager)
- Temporary delegation (Manager delegates approval authority)

**Technical Implementation**:

```typescript
// Update member role
async function updateMemberRole(data: {
  organizationId: string;
  userId: string;
  newRole: string;
  updatedBy: string;
  reason?: string;
  temporary?: {
    expiresAt: Date;
    originalRole: string;
  };
}) {
  // 1. Get current member
  const member = await auth.api.getMember({
    organizationId: data.organizationId,
    userId: data.userId,
  });

  const previousRole = member.role;

  // 2. Validate updater has permission
  const updater = await auth.api.getMember({
    organizationId: data.organizationId,
    userId: data.updatedBy,
  });

  if (!hasPermission(updater.role, 'member:update-role')) {
    throw new Error('Insufficient permissions to update roles');
  }

  // 3. Update role
  await auth.api.updateMemberRole({
    organizationId: data.organizationId,
    userId: data.userId,
    role: data.newRole,
    metadata: {
      ...member.metadata,
      ...(data.temporary && {
        temporary: true,
        expiresAt: data.temporary.expiresAt,
        originalRole: data.temporary.originalRole,
      }),
    },
  });

  // 4. Log role update
  await auditLog.create({
    action: 'role_updated',
    organizationId: data.organizationId,
    userId: data.userId,
    previousRole,
    newRole: data.newRole,
    updatedBy: data.updatedBy,
    reason: data.reason,
    temporary: data.temporary,
  });

  // 5. Schedule role reversion if temporary
  if (data.temporary) {
    await scheduleRoleReversion({
      organizationId: data.organizationId,
      userId: data.userId,
      originalRole: data.temporary.originalRole,
      expiresAt: data.temporary.expiresAt,
    });
  }

  // 6. Notify user
  await sendRoleUpdateEmail(data.userId, previousRole, data.newRole);

  return { success: true };
}
```

---

### 3.2 Permission Configuration

#### 3.2.1 Order Approval Thresholds

**Use Case**: Configure monetary limits for order approval by role

**Technical Implementation**:

```typescript
// Configure order approval threshold for member
async function configureOrderThreshold(data: {
  organizationId: string;
  userId: string;
  threshold: number;
  configuredBy: string;
}) {
  // 1. Validate configurer has permission
  const configurer = await auth.api.getMember({
    organizationId: data.organizationId,
    userId: data.configuredBy,
  });

  if (!hasPermission(configurer.role, 'authorization:configure-thresholds')) {
    throw new Error('Insufficient permissions to configure thresholds');
  }

  // 2. Update member metadata
  await auth.api.updateMember({
    organizationId: data.organizationId,
    userId: data.userId,
    metadata: {
      orderApprovalThreshold: data.threshold,
    },
  });

  // 3. Log configuration
  await auditLog.create({
    action: 'threshold_configured',
    organizationId: data.organizationId,
    userId: data.userId,
    threshold: data.threshold,
    configuredBy: data.configuredBy,
  });

  return { success: true };
}
```

---

#### 3.2.2 Multi-Store Access Assignment

**Use Case**: Assign staff to specific store locations in multi-store organizations

**Technical Implementation**:

```typescript
// Assign member to specific stores
async function assignStoreAccess(data: {
  organizationId: string;
  userId: string;
  storeIds: string[];
  assignedBy: string;
}) {
  // 1. Validate assigner has permission
  const assigner = await auth.api.getMember({
    organizationId: data.organizationId,
    userId: data.assignedBy,
  });

  if (!hasPermission(assigner.role, 'multiStore:manage-managers')) {
    throw new Error('Insufficient permissions to assign store access');
  }

  // 2. Update member metadata
  await auth.api.updateMember({
    organizationId: data.organizationId,
    userId: data.userId,
    metadata: {
      assignedStores: data.storeIds,
    },
  });

  // 3. Log assignment
  await auditLog.create({
    action: 'store_access_assigned',
    organizationId: data.organizationId,
    userId: data.userId,
    storeIds: data.storeIds,
    assignedBy: data.assignedBy,
  });

  return { success: true };
}
```

---

## 4. User Offboarding Services

### 4.1 Offboarding Workflows

#### 4.1.1 Voluntary Departure

**Process**: User leaves organization voluntarily or is removed by manager

**Steps**:

1. **Initiation**: Manager or Owner initiates removal
2. **Access Revocation**: Immediately revoke all access
3. **Data Transfer**: Transfer ownership of pending items (orders, tickets)
4. **Session Termination**: Terminate all active sessions
5. **Audit Trail**: Log all offboarding actions
6. **Data Retention**: Archive user data per retention policy

**Technical Implementation**:

```typescript
// Remove member from organization
async function removeMember(data: {
  organizationId: string;
  userId: string;
  removedBy: string;
  reason?: string;
  transferDataTo?: string; // Transfer pending items to this user
}) {
  // 1. Validate remover has permission
  const remover = await auth.api.getMember({
    organizationId: data.organizationId,
    userId: data.removedBy,
  });

  if (!hasPermission(remover.role, 'member:delete')) {
    throw new Error('Insufficient permissions to remove members');
  }

  // 2. Get member to remove
  const member = await auth.api.getMember({
    organizationId: data.organizationId,
    userId: data.userId,
  });

  // 3. Prevent removing last owner
  if (member.role.includes('owner')) {
    const ownerCount = await prisma.member.count({
      where: {
        organizationId: data.organizationId,
        role: { contains: 'owner' },
      },
    });

    if (ownerCount === 1) {
      throw new Error('Cannot remove last owner. Transfer ownership first.');
    }
  }

  // 4. Transfer pending items
  if (data.transferDataTo) {
    await transferPendingItems({
      fromUserId: data.userId,
      toUserId: data.transferDataTo,
      organizationId: data.organizationId,
    });
  }

  // 5. Terminate all sessions
  await auth.api.revokeUserSessions({ userId: data.userId });

  // 6. Remove member
  await auth.api.removeMember({
    organizationId: data.organizationId,
    userId: data.userId,
  });

  // 7. Archive member data
  await archiveMemberData({
    organizationId: data.organizationId,
    userId: data.userId,
    removedBy: data.removedBy,
    reason: data.reason,
  });

  // 8. Log removal
  await auditLog.create({
    action: 'member_removed',
    organizationId: data.organizationId,
    userId: data.userId,
    removedBy: data.removedBy,
    reason: data.reason,
    timestamp: new Date(),
  });

  // 9. Notify user
  await sendRemovalEmail(data.userId, data.organizationId);

  return { success: true };
}

// Transfer pending items to another user
async function transferPendingItems(data: {
  fromUserId: string;
  toUserId: string;
  organizationId: string;
}) {
  // Transfer pending orders
  await prisma.order.updateMany({
    where: {
      createdBy: data.fromUserId,
      organizationId: data.organizationId,
      status: 'pending',
    },
    data: {
      createdBy: data.toUserId,
    },
  });

  // Transfer open support tickets
  await prisma.supportTicket.updateMany({
    where: {
      createdBy: data.fromUserId,
      organizationId: data.organizationId,
      status: { in: ['open', 'in_progress'] },
    },
    data: {
      assignedTo: data.toUserId,
    },
  });

  // Log transfer
  await auditLog.create({
    action: 'items_transferred',
    fromUserId: data.fromUserId,
    toUserId: data.toUserId,
    organizationId: data.organizationId,
  });
}
```

---

#### 4.1.2 Account Suspension

**Use Case**: Temporarily suspend user access without full removal

**Technical Implementation**:

```typescript
// Suspend user account
async function suspendUser(data: {
  userId: string;
  suspendedBy: string;
  reason: string;
  duration?: number; // Days, undefined = indefinite
}) {
  // 1. Validate suspender is platform admin
  const suspender = await prisma.user.findUnique({
    where: { id: data.suspendedBy },
  });

  if (!suspender?.isPlatformAdmin) {
    throw new Error('Only platform admins can suspend users');
  }

  // 2. Calculate suspension end date
  const suspendedUntil = data.duration
    ? new Date(Date.now() + data.duration * 24 * 60 * 60 * 1000)
    : null;

  // 3. Update user status
  await prisma.user.update({
    where: { id: data.userId },
    data: {
      banned: true,
      banReason: data.reason,
      banExpires: suspendedUntil,
    },
  });

  // 4. Revoke all sessions
  await auth.api.revokeUserSessions({ userId: data.userId });

  // 5. Log suspension
  await auditLog.create({
    action: 'user_suspended',
    userId: data.userId,
    suspendedBy: data.suspendedBy,
    reason: data.reason,
    suspendedUntil,
  });

  // 6. Notify user
  await sendSuspensionEmail(data.userId, data.reason, suspendedUntil);

  return { success: true, suspendedUntil };
}

// Reactivate suspended user
async function reactivateUser(data: { userId: string; reactivatedBy: string }) {
  // 1. Validate reactivator is platform admin
  const reactivator = await prisma.user.findUnique({
    where: { id: data.reactivatedBy },
  });

  if (!reactivator?.isPlatformAdmin) {
    throw new Error('Only platform admins can reactivate users');
  }

  // 2. Update user status
  await prisma.user.update({
    where: { id: data.userId },
    data: {
      banned: false,
      banReason: null,
      banExpires: null,
    },
  });

  // 3. Log reactivation
  await auditLog.create({
    action: 'user_reactivated',
    userId: data.userId,
    reactivatedBy: data.reactivatedBy,
  });

  // 4. Notify user
  await sendReactivationEmail(data.userId);

  return { success: true };
}
```

---

### 4.2 Data Retention and Archival

**Retention Policies**:

- **User Profile Data**: Retain for 7 years (regulatory compliance)
- **Audit Logs**: Retain indefinitely (immutable)
- **Transaction Data**: Retain for 10 years (financial compliance)
- **Communication Logs**: Retain for 3 years
- **Session Data**: Purge after 90 days

**Technical Implementation**:

```typescript
// Archive member data upon removal
async function archiveMemberData(data: {
  organizationId: string;
  userId: string;
  removedBy: string;
  reason?: string;
}) {
  // 1. Create archive record
  await prisma.archivedMember.create({
    data: {
      userId: data.userId,
      organizationId: data.organizationId,
      removedBy: data.removedBy,
      removedAt: new Date(),
      reason: data.reason,
      // Snapshot of member data
      snapshot: {
        user: await prisma.user.findUnique({ where: { id: data.userId } }),
        member: await prisma.member.findFirst({
          where: {
            userId: data.userId,
            organizationId: data.organizationId,
          },
        }),
        orders: await prisma.order.findMany({
          where: {
            createdBy: data.userId,
            organizationId: data.organizationId,
          },
        }),
      },
    },
  });

  // 2. Log archival
  await auditLog.create({
    action: 'member_data_archived',
    userId: data.userId,
    organizationId: data.organizationId,
    archivedBy: data.removedBy,
  });
}
```

---

## 5. Notification Services

### 5.1 Email Notifications

**Notification Types**:

- **Invitation Emails**: Sent when user is invited to organization
- **Verification Emails**: Sent for email verification
- **Approval Emails**: Sent when registration is approved
- **Role Assignment Emails**: Sent when role is assigned or updated
- **Removal Emails**: Sent when user is removed from organization
- **Suspension Emails**: Sent when account is suspended

**Technical Implementation**:

```typescript
// Email notification service
async function sendInvitationEmail(data: {
  to: string;
  organizationName: string;
  role: string;
  invitedBy: string;
  invitationUrl: string;
}) {
  await sendEmail({
    to: data.to,
    subject: `You've been invited to join ${data.organizationName}`,
    template: 'invitation',
    data: {
      organizationName: data.organizationName,
      role: formatRoleName(data.role),
      invitedBy: data.invitedBy,
      invitationUrl: data.invitationUrl,
      expiresIn: '7 days',
    },
  });
}

async function sendApprovalEmail(email: string, organizationId: string) {
  const organization = await auth.api.getOrganization({ organizationId });

  await sendEmail({
    to: email,
    subject: 'Your Restomarket registration has been approved',
    template: 'registration-approved',
    data: {
      organizationName: organization.name,
      loginUrl: `${process.env.APP_URL}/login`,
    },
  });
}

async function sendRoleAssignmentEmail(userId: string, role: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  await sendEmail({
    to: user.email,
    subject: 'Your role has been updated',
    template: 'role-assignment',
    data: {
      userName: user.name,
      role: formatRoleName(role),
      loginUrl: `${process.env.APP_URL}/login`,
    },
  });
}
```

---

## 6. Audit and Compliance

### 6.1 Audit Logging

**All user management actions must be logged**:

- User registration
- Email verification
- Organization validation
- Role assignments
- Permission changes
- Member invitations
- Member removals
- Account suspensions

**Audit Log Schema**:

```typescript
interface AuditLog {
  id: string;
  timestamp: Date;
  action: string;
  userId?: string;
  organizationId?: string;
  performedBy: string;
  metadata: Record<string, any>;
  ipAddress: string;
  userAgent: string;
}
```

---

### 6.2 Compliance Requirements

**GDPR Compliance**:

- **Right to Access**: Users can request their data
- **Right to Deletion**: Users can request account deletion
- **Right to Portability**: Users can export their data
- **Consent Management**: Track user consents

**Technical Implementation**:

```typescript
// GDPR data export
async function exportUserData(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      members: true,
      orders: true,
      supportTickets: true,
    },
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    },
    organizations: user.members.map(m => ({
      organizationId: m.organizationId,
      role: m.role,
      joinedAt: m.createdAt,
    })),
    orders: user.orders.map(o => ({
      id: o.id,
      total: o.total,
      status: o.status,
      createdAt: o.createdAt,
    })),
    supportTickets: user.supportTickets.map(t => ({
      id: t.id,
      subject: t.subject,
      status: t.status,
      createdAt: t.createdAt,
    })),
  };
}

// GDPR account deletion
async function deleteUserAccount(userId: string, requestedBy: string) {
  // 1. Verify requester is the user or platform admin
  if (userId !== requestedBy) {
    const requester = await prisma.user.findUnique({
      where: { id: requestedBy },
    });

    if (!requester?.isPlatformAdmin) {
      throw new Error('Only user or platform admin can delete account');
    }
  }

  // 2. Remove from all organizations
  const memberships = await prisma.member.findMany({
    where: { userId },
  });

  for (const membership of memberships) {
    await removeMember({
      organizationId: membership.organizationId,
      userId,
      removedBy: requestedBy,
      reason: 'Account deletion requested',
    });
  }

  // 3. Anonymize user data (soft delete)
  await prisma.user.update({
    where: { id: userId },
    data: {
      email: `deleted-${userId}@restomarket.local`,
      name: 'Deleted User',
      banned: true,
      banReason: 'Account deleted',
    },
  });

  // 4. Log deletion
  await auditLog.create({
    action: 'account_deleted',
    userId,
    deletedBy: requestedBy,
  });

  return { success: true };
}
```

---

## 7. Best Practices and Security

### 7.1 Security Best Practices

**Password Requirements**:

- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

**MFA Requirements**:

- Mandatory for all platform admins
- Recommended for organization owners
- Optional for other roles

**Session Management**:

- Session timeout: 7 days
- Idle timeout: 24 hours
- Concurrent session limit: 5 per user

**Access Control**:

- Least privilege principle
- Regular access reviews (quarterly for admins, annually for users)
- Immediate revocation upon termination

---

### 7.2 Operational Best Practices

**Onboarding**:

- Provide clear role descriptions during invitation
- Include training materials in welcome emails
- Assign mentor for new team members
- Schedule onboarding call for complex roles

**Role Management**:

- Document role changes with reason
- Notify affected users immediately
- Review role assignments quarterly
- Audit high-privilege roles monthly

**Offboarding**:

- Transfer ownership of pending items
- Archive user data per retention policy
- Revoke all access immediately
- Conduct exit interview for feedback

---

## Glossary

| Term                | Definition                                                       |
| ------------------- | ---------------------------------------------------------------- |
| **Onboarding**      | Process of adding new users to the platform and organizations    |
| **Offboarding**     | Process of removing users from organizations and revoking access |
| **Role Assignment** | Assigning specific roles with associated permissions to users    |
| **Invitation**      | Email-based invitation to join an organization                   |
| **Verification**    | Confirming email address ownership                               |
| **Validation**      | Platform admin review and approval of registrations              |
| **Suspension**      | Temporary revocation of user access                              |
| **Archival**        | Long-term storage of user data per retention policies            |
| **Audit Trail**     | Immutable log of all user management actions                     |

---

**Document Version**: 1.0  
**Last Updated**: 2026-02-06  
**Author**: Restomarket Platform Team  
**Classification**: Internal - Implementation Reference
