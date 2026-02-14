import postgres from 'postgres';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env from root
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not defined');
  process.exit(1);
}

const client = postgres(process.env.DATABASE_URL);

async function reset() {
  console.log('Dropping schema public...');
  await client`DROP SCHEMA IF EXISTS public CASCADE`;
  await client`CREATE SCHEMA public`;
  console.log('Schema public reset.');
  await client.end();
}

reset().catch(err => {
  console.error(err);
  process.exit(1);
});
