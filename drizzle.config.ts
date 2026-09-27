import { defineConfig } from 'drizzle-kit';
import { readFileSync, existsSync } from 'fs';

// drizzle-kit doesn't read .env on its own; load DATABASE_URL from it when present.
if (!process.env.DATABASE_URL && existsSync('.env')) {
  const line = readFileSync('.env', 'utf8').split('\n').find((l) => l.startsWith('DATABASE_URL='));
  if (line) process.env.DATABASE_URL = line.slice('DATABASE_URL='.length).replace(/^"|"$/g, '');
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './database/migrations',
  dialect: 'mysql',
  dbCredentials: { url: process.env.DATABASE_URL! },
});
