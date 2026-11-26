import { createHash } from 'crypto';

/**
 * Small in-memory rate limiter (per server process). Enough to slow down form spam and password
 * guessing on a single-server store; sign-in attempts are also counted in the database (see auth).
 */
const hits = new Map<string, number[]>();

type HeaderSource = Request | { get(name: string): string | null };

/**
 * The visitor's IP. server.js sets x-ns-client-ip from the connection and trusted proxy hops, so a
 * visitor can't fake it; on hosts without server.js (Vercel) the platform's own headers are used.
 * With no address at all, visitors are grouped by browser rather than all sharing one limit.
 */
export function clientIp(src: HeaderSource) {
  const h = src instanceof Request ? src.headers : src;
  if (process.env.NS_CUSTOM_SERVER === '1') {
    const ours = h.get('x-ns-client-ip');
    if (ours) return ours;
  }
  const real = h.get('x-real-ip');
  if (real) return real.trim();
  const xff = h.get('x-forwarded-for')?.split(',').map((s) => s.trim()).filter(Boolean);
  if (xff?.length) return xff[xff.length - 1];
  return `ua:${createHash('sha256').update(`${h.get('user-agent') ?? ''}|${h.get('accept-language') ?? ''}`).digest('hex').slice(0, 16)}`;
}

/** Pass the Request (route handlers) or `await headers()` (server actions). */
export function rateLimit(src: HeaderSource, bucket: string, perMinute: number): boolean {
  const key = `${bucket}:${clientIp(src)}`;
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= perMinute) return false;
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 20_000) {
    // Drop entries whose last hit is over a minute old, then the oldest if still too many.
    for (const [k, v] of hits) if (now - v[v.length - 1] > 60_000) hits.delete(k);
    if (hits.size > 20_000) hits.clear();
  }
  return true;
}
