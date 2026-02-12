import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Load test environment variables before tests run
 *
 * This is necessary because E2ETestSetup needs DATABASE_URL before
 * the NestJS app (and ConfigModule) is initialized.
 *
 * The ConfigModule in app.module.ts will also load .env.test when NODE_ENV=test,
 * but that happens too late for the test setup that needs env vars immediately.
 */
const envFile = resolve(__dirname, '../.env.test');
try {
  const envContent = readFileSync(envFile, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmedLine = line.trim();
    // Skip empty lines and comments
    if (!trimmedLine || trimmedLine.startsWith('#')) {
      return;
    }
    const [key, ...valueParts] = trimmedLine.split('=');
    if (key) {
      let value = valueParts.join('=').trim();
      // Remove surrounding quotes if present
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key.trim()] = value;
    }
  });
} catch (error) {
  console.error('Failed to load .env.test file:', error);
}
