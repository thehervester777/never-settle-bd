import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db, dbUsesSsl, schemaStatus } from '@/db';

export const dynamic = 'force-dynamic';

type DbError = { code?: string; errno?: number; message?: string; cause?: unknown };

/** Plain-English fix for common connection errors. Never echoes the raw message, which can contain host or user names. */
function explain(e: DbError): { code: string; fix: string } {
  const code = e.code || (e.errno ? `errno ${e.errno}` : 'UNKNOWN');
  const msg = e.message || '';
  if (/insecure transport|secure transport|SSL connection is required|requires? (SSL|TLS)/i.test(msg) || code === 'ER_SECURE_TRANSPORT_REQUIRED' || code === 'HANDSHAKE_NO_SSL_SUPPORT')
    return { code, fix: 'The database only accepts encrypted connections. Set DATABASE_SSL="true" and redeploy.' };
  if (/SELF_SIGNED|UNABLE_TO_VERIFY|CERT_/.test(code) || /certificate/i.test(msg))
    return { code, fix: "The database's SSL certificate isn't trusted. Paste your provider's CA certificate (PEM) into DATABASE_SSL_CA and redeploy." };
  switch (code) {
    case 'ENOTFOUND':
    case 'EAI_AGAIN':
      return { code, fix: 'The database host name in DATABASE_URL was not found. Copy the host again from your database provider.' };
    case 'ECONNREFUSED':
      return { code, fix: 'Nothing accepted the connection. On Vercel, DATABASE_URL must point at an internet-reachable host (not localhost), with the right port.' };
    case 'ETIMEDOUT':
    case 'ECONNRESET':
    case 'PROTOCOL_CONNECTION_LOST':
      return { code, fix: 'The connection timed out or was dropped. Allow remote connections from anywhere (0.0.0.0/0 or %) in your database settings.' };
    case 'ER_ACCESS_DENIED_ERROR':
    case 'ER_DBACCESS_DENIED_ERROR':
      return {
        code,
        fix: 'Wrong database user or password, or the user lacks access to this database. Check DATABASE_URL (encode symbols in the password: @ → %40, # → %23).'
          + (dbUsesSsl ? '' : ' Some hosts also report this when they require SSL: try DATABASE_SSL="true".'),
      };
    case 'ER_BAD_DB_ERROR':
      return { code, fix: 'The database name at the end of DATABASE_URL does not exist.' };
    case 'ER_NO_SUCH_TABLE':
      return { code, fix: 'Connected, but the tables are missing. Import database/install.sql into this database.' };
    default:
      return { code, fix: 'See the deployment logs for details.' };
  }
}

/** Drizzle wraps driver errors ("Failed query: …"); the driver error is in .cause. */
const driverError = (e: unknown): DbError => {
  const err = e as DbError;
  return err?.cause && typeof err.cause === 'object' ? (err.cause as DbError) : err;
};

/**
 * Setup check for the site owner: which settings are present and whether the database works.
 * Reports only yes/no and error codes, never values.
 */
export async function GET() {
  const authSecret = process.env.AUTH_SECRET;
  const env = {
    DATABASE_URL: process.env.DATABASE_URL ? 'set' : 'missing',
    AUTH_SECRET: !authSecret ? 'missing' : authSecret.length < 32 ? 'too short (needs 32+ characters)' : 'set',
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ? 'set' : 'missing',
    ...(process.env.VERCEL ? { BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN ? 'set' : 'missing (photo uploads disabled)' } : {}),
  };

  let database: Record<string, unknown>;
  if (!process.env.DATABASE_URL) {
    database = { ok: false, fix: 'Add DATABASE_URL in your hosting settings, then redeploy.' };
  } else {
    try {
      await db.execute(sql`select 1`);
      try {
        const [[counts]] = (await db.execute(sql`select (select count(*) from products) as products, (select count(*) from admins) as admins`)) as unknown as [[{ products: number; admins: number }]];
        const upgrade = schemaStatus();
        database = {
          ok: upgrade?.state !== 'failed',
          products: Number(counts.products),
          adminAccount: Number(counts.admins) > 0 ? 'created' : 'not yet: open /admin to create it',
          tables: upgrade?.state === 'failed'
            ? { ok: false, code: upgrade.error, fix: 'The database user needs permission to create and alter tables (ALL PRIVILEGES in cPanel → MySQL Databases).' }
            : { ok: true, updated: upgrade?.applied.length ? upgrade.applied : 'up to date' },
        };
      } catch (e) {
        database = { ok: false, connected: true, ...explain(driverError(e)) };
      }
    } catch (e) {
      database = { ok: false, connected: false, ...explain(driverError(e)) };
    }
  }

  const ok = database.ok === true && env.AUTH_SECRET === 'set';
  return NextResponse.json({ ok, env, database }, { status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } });
}
