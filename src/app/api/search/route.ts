import { NextResponse } from 'next/server';
import { listProducts } from '@/lib/catalog';
import { formatBDT } from '@/lib/money';

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get('q')?.trim().slice(0, 60) ?? '';
  if (q.length < 2) return NextResponse.json({ results: [] });
  const products = await listProducts({ q, limit: 8 });
  return NextResponse.json({
    results: products.slice(0, 8).map((p) => ({ slug: p.slug, title: p.title, price: formatBDT(p.price), image: p.images[0]?.url ?? null })),
  });
}
