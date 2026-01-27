import base from './base.js';

/** @type {import('jest').Config} */

const config = {
  ...base,
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
};

export default config;
