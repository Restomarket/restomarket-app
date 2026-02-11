import nestConfig from '@repo/jest-config/nest';

/** @type {import('jest').Config} */
const config = {
  ...nestConfig,

  // ============================================
  // App-specific Path Aliases
  // ============================================
  moduleNameMapper: {
    ...nestConfig.moduleNameMapper,
    '^@common/(.*)$': '<rootDir>/src/common/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@core/(.*)$': '<rootDir>/src/core/$1',
    '^@database/(.*)$': '<rootDir>/src/database/$1',
    '^@modules/(.*)$': '<rootDir>/src/modules/$1',
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
    '^@logger/(.*)$': '<rootDir>/src/logger/$1',
    // Library mocks (ESM → CJS compatibility)
    '@thallesp/nestjs-better-auth': '<rootDir>/test/mocks/better-auth.mock.ts',
    '^better-auth$': '<rootDir>/test/__mocks__/better-auth.ts',
    '^better-auth/plugins/access$': '<rootDir>/test/__mocks__/better-auth-plugins-access.ts',
    '^better-auth/plugins$': '<rootDir>/test/__mocks__/better-auth-plugins.ts',
    '^better-auth/adapters/drizzle$': '<rootDir>/test/__mocks__/better-auth-adapters-drizzle.ts',
    '^@repo/shared/auth$': '<rootDir>/test/__mocks__/@repo/shared-auth.ts',
  },
};

export default config;
