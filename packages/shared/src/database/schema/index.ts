export * from './base.schema.js';
export * from './auth.schema.js';
export * from './organization.schema.js';

// ============================================
// Backward Compatibility
// ============================================
// Export authUsers as 'users' for backward compatibility
// This allows existing code to continue working without changes
export { authUsers as users } from './auth.schema.js';

// Note: User and NewUser types are exported from types/database.types.ts
// which now infers from authUsers (via the 'users' alias above)
//
// Note: users.schema.js is now deprecated - all user data is in auth.schema.js
