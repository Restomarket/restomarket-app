/** @type {import('jest').Config} */

const config = {
  roots: ['<rootDir>'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    'app/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/vendor/**',
  ],
  coverageDirectory: 'coverage',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.json',
      },
    ],
  },
  moduleNameMapper: {
    '^@/(.*)$': ['<rootDir>/src/$1', '<rootDir>/app/$1'],
    '^@repo/shared$': '<rootDir>/../../packages/shared/dist/index.js',
    '^@repo/shared/(.*)$': '<rootDir>/../../packages/shared/dist/$1',
  },
  passWithNoTests: true,
  resetMocks: true,
  // Coverage thresholds disabled by default - enable per package as needed
  // coverageThreshold: {
  //   global: {
  //     branches: 80,
  //     functions: 80,
  //     lines: 80,
  //     statements: 80,
  //   },
  // },
  watchPlugins: ['jest-watch-typeahead/filename', 'jest-watch-typeahead/testname'],
};

export default config;
