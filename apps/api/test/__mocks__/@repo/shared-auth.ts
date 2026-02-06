// Mock for @repo/shared/auth module
export const createBetterAuthBaseConfig = jest.fn().mockReturnValue({
  appName: 'RestoMarket',
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  plugins: [],
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    storage: 'database',
  },
});

export const statements = [];
export const rolePermissions = {};
