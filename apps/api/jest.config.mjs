import nestConfig from '@repo/jest-config/nest';

/** @type {import('jest').Config} */
const config = {
  ...nestConfig,
  moduleNameMapper: {
    ...nestConfig.moduleNameMapper,
    '^@common/(.*)$': '<rootDir>/src/common/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@core/(.*)$': '<rootDir>/src/core/$1',
    '^@database/(.*)$': '<rootDir>/src/database/$1',
    '^@modules/(.*)$': '<rootDir>/src/modules/$1',
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
    '^@logger/(.*)$': '<rootDir>/src/logger/$1',
  },
};

export default config;
