import base from './base.js';

/** @type {import('jest').Config} */

const config = {
  ...base,
  testEnvironment: 'node',
  moduleNameMapper: {
    ...base.moduleNameMapper,
    '^src/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.json',
      },
    ],
  },
};

export default config;
