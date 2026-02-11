// Mock for better-auth/plugins/access module
export const createAccessControl = jest.fn().mockReturnValue({
  newRole: jest.fn().mockReturnValue({}),
});
