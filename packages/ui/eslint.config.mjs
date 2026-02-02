import { config } from '@repo/eslint-config/react-internal';

/** @type {import("eslint").Linter.Config} */
export default [
  {
    ignores: [
      'coverage/**',
      '**/coverage/**',
      'node_modules/**',
      '.turbo/**',
      'dist/**',
      '*.config.js',
      '*.config.ts',
      '*.setup.js',
      '*.setup.ts',
      '**/*.css',
    ],
  },
  ...config,
];
