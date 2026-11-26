import { NextResponse } from 'next/server';
import { listProducts } from '@/lib/catalog';
import { formatBDT } from '@/lib/money';
import { rateLimit } from '@/lib/rate-limit';

export async function GET(req: Request) {
  if (!rateLimit(req, 'search', 90)) return NextResponse.json({ results: [], error: 'Too many searches. Please wait a moment.' }, { status: 429 });
  const q = new URL(req.url).searchParams.get('q')?.trim().slice(0, 60) ?? '';
  if (q.length < 2) return NextResponse.json({ results: [] });
  const products = await listProducts({ q, limit: 8 });
  return NextResponse.json({
    results: products.slice(0, 8).map((p) => ({ slug: p.slug, title: p.title, price: formatBDT(p.price), image: p.images[0]?.url ?? null })),
  });
}
