/**
 * Manual mock for better-auth
 * This mock prevents ESM import issues in Jest e2e tests
 */

export const betterAuth = jest.fn(() => ({
  handler: jest.fn(),
  api: {
    getSession: jest.fn(),
    signInEmail: jest.fn(),
    signOut: jest.fn(),
  },
  options: {},
}));

// Mock for better-auth/adapters/drizzle
export const drizzleAdapter = jest.fn(() => ({}));

// Mock for better-auth/plugins
export const organization = jest.fn(() => ({}));
export const bearer = jest.fn(() => ({}));
