import base from './base.js';

/** @type {import('jest').Config} */

const config = {
  ...base,
  testEnvironment: 'node',

  // ============================================
  // NestJS Module Resolution
  // ============================================
  moduleNameMapper: {
    ...base.moduleNameMapper,
    '^src/(.*)$': '<rootDir>/src/$1',
  },

  // ============================================
  // Transform (NestJS CommonJS)
  // ============================================
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.json',
      },
    ],
  },

  // ============================================
  // ESM Compatibility
  // ============================================
  transformIgnorePatterns: ['node_modules/(?!(better-auth|@better-auth)/)'],
};

export default config;
