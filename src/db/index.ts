import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './schema';

// One connection pool per server process (reused across hot reloads in development).
const globalForDb = globalThis as unknown as { __nsPool?: mysql.Pool };

const pool =
  globalForDb.__nsPool ??
  mysql.createPool({
    uri: process.env.DATABASE_URL,
    connectionLimit: 8, // shared hosting usually allows ~10–25 connections per user
    charset: 'utf8mb4',
    timezone: 'Z',
  });

if (process.env.NODE_ENV !== 'production') globalForDb.__nsPool = pool;

export const db = drizzle(pool, { schema, mode: 'default' });
export { schema };
