/**
 * Small in-memory rate limiter (per server process). Enough to slow down form spam on a single-server store.
 */
const hits = new Map<string, number[]>();

type HeaderSource = Request | { get(name: string): string | null };

export function clientIp(src: HeaderSource) {
  const h = src instanceof Request ? src.headers : src;
  return h.get('x-forwarded-for')?.split(',')[0].trim() || h.get('x-real-ip') || 'local';
}

/** Pass the Request (route handlers) or `await headers()` (server actions). */
export function rateLimit(src: HeaderSource, bucket: string, perMinute: number): boolean {
  const key = `${bucket}:${clientIp(src)}`;
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= perMinute) return false;
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear();
  return true;
}
