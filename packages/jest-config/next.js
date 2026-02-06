import base from './base.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: process.cwd(),
});

/** @type {import('jest').Config} */

const config = {
  ...base,
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],

  // ============================================
  // Next.js Module Resolution
  // ============================================
  moduleNameMapper: {
    ...base.moduleNameMapper,
    /* CSS Modules */
    '^.+\\.module\\.(css|sass|scss)$': 'identity-obj-proxy',
    /* Static assets */
    '^.+\\.(png|jpg|jpeg|gif|webp|avif|ico|bmp|svg)$': '<rootDir>/__mocks__/fileMock.js',
  },
};

export default createJestConfig(config);
