import { NextResponse, type NextRequest } from 'next/server';
import { FILTER_KEYS, collectionPath } from '@/lib/catalog-shared';

/**
 * Old-style filter links (/collections/all?sort=price-asc&size=M) move to the cacheable form
 * /collections/all/f/sort=price-asc&size=M. Anything else in the query (ad tracking tags) is kept.
 */
export function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;
  const m = pathname.match(/^\/collections\/([^/]+)\/?$/);
  if (!m || !FILTER_KEYS.some((k) => searchParams.has(k))) return NextResponse.next();
  const all = (k: string) => searchParams.getAll(k).map((v) => v.trim().slice(0, 40)).filter(Boolean).slice(0, 12);
  const url = req.nextUrl.clone();
  url.pathname = collectionPath(`/collections/${m[1]}`, {
    sort: searchParams.get('sort') ?? undefined, sizes: all('size'), colors: all('color'),
    min: searchParams.get('min') ?? undefined, max: searchParams.get('max') ?? undefined,
  });
  for (const k of FILTER_KEYS) url.searchParams.delete(k);
  return NextResponse.redirect(url, 308);
}

export const config = { matcher: ['/collections/:slug'] };
