import base from './base.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const nextJest = require('next/jest');

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: process.cwd(),
});

/** @type {import('jest').Config} */

const config = {
  ...base,
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    ...base.moduleNameMapper,
    // Handle CSS imports (with CSS modules)
    // https://jestjs.io/docs/webpack#mocking-css-modules
    '^.+\\.module\\.(css|sass|scss)$': 'identity-obj-proxy',
  },
};

export default createJestConfig(config);
