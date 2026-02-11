/** @type {import('jest').Config} */

const config = {
  roots: ['<rootDir>'],

  // ============================================
  // File Extensions & Transforms
  // ============================================
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.json',
      },
    ],
  },

  // ============================================
  // Test Discovery
  // ============================================
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/dist/'],

  // ============================================
  // Coverage
  // ============================================
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    'app/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/index.ts',
    '!**/__mocks__/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text-summary', 'lcov', 'clover'],

  // ============================================
  // Module Resolution (Monorepo)
  // ============================================
  moduleNameMapper: {
    '^@/(.*)$': ['<rootDir>/src/$1', '<rootDir>/app/$1'],
    '^@repo/shared$': '<rootDir>/../../packages/shared/dist/index.js',
    '^@repo/shared/(.*)$': '<rootDir>/../../packages/shared/dist/$1',
  },

  // ============================================
  // Behavior
  // ============================================
  passWithNoTests: true,
  resetMocks: true,
};

export default config;
