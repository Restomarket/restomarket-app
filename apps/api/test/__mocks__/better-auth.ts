// Mock for better-auth module
export const betterAuth = jest.fn().mockReturnValue({
  api: {
    hasPermission: jest.fn(),
  },
});
