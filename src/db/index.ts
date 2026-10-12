import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './schema';

// URL options some hosts put in their connection string to ask for TLS (mysql2 doesn't understand them itself).
const SSL_PARAMS = ['ssl', 'ssl-mode', 'sslmode', 'sslaccept'];

/**
 * Reads DATABASE_URL. TLS is turned on by DATABASE_SSL="true" or by an ssl option in the URL
 * (e.g. ?ssl-mode=REQUIRED or ?sslaccept=strict), which most cloud MySQL hosts require.
 * DATABASE_SSL_CA can hold the host's CA certificate (PEM) when it isn't publicly trusted.
 */
function connectionOptions(): mysql.PoolOptions {
  const raw = process.env.DATABASE_URL;
  let uri = raw;
  let wantSsl = process.env.DATABASE_SSL === 'true';
  if (raw) {
    try {
      const url = new URL(raw);
      for (const key of SSL_PARAMS) {
        const v = url.searchParams.get(key);
        if (v === null) continue;
        if (!/^(false|disabled?|0|off)$/i.test(v)) wantSsl = true;
        url.searchParams.delete(key);
      }
      uri = url.toString();
    } catch {
      // Not a parseable URL: hand it to mysql2 unchanged and let it report the problem.
    }
  }
  const ca = process.env.DATABASE_SSL_CA?.replace(/\\n/g, '\n');
  return {
    uri,
    // Serverless hosts run many copies of the app at once, so each keeps fewer connections open.
    connectionLimit: process.env.VERCEL ? 3 : 8, // shared hosting usually allows ~10–25 connections per user
    connectTimeout: 10_000,
    charset: 'utf8mb4',
    timezone: 'Z',
    ...(wantSsl || ca ? { ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true, ...(ca ? { ca } : {}) } } : {}),
  };
}

// One connection pool per server process (reused across hot reloads in development).
const globalForDb = globalThis as unknown as { __nsPool?: mysql.Pool };

const options = connectionOptions();
const pool = globalForDb.__nsPool ?? mysql.createPool(options);

if (process.env.NODE_ENV !== 'production') globalForDb.__nsPool = pool;

export const db = drizzle(pool, { schema, mode: 'default' });
/** Whether connections are encrypted (TLS). */
export const dbUsesSsl = Boolean(options.ssl);
export { schema };
