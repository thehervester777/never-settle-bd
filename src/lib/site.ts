/** The public address of the store: NEXT_PUBLIC_SITE_URL, or the address the request came in on. */
export function siteUrl(req?: Request) {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');
  if (env || !req) return env || 'http://localhost:3000';
  const h = req.headers;
  const host = h.get('x-forwarded-host') ?? h.get('host');
  if (!host) return new URL(req.url).origin;
  return `${h.get('x-forwarded-proto')?.split(',')[0] ?? new URL(req.url).protocol.replace(':', '')}://${host}`;
}
