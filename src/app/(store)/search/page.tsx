import type { Metadata } from 'next';
import { listProducts } from '@/lib/catalog';
import { ProductCard } from '@/components/product/ProductCard';
import { Stagger, StaggerItem } from '@/components/motion/Reveal';

export const metadata: Metadata = { title: 'Search', robots: { index: false } };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? '').trim().slice(0, 60);
  const results = q ? await listProducts({ q }) : [];
  return (
    <section className="container pb-24 pt-10 md:pt-16">
      <h1 className="font-display text-display-lg uppercase">{q ? `Results for “${q}”` : 'Search'}</h1>
      <form action="/search" className="relative mt-8 max-w-2xl" role="search">
        <label htmlFor="q" className="sr-only">Search products</label>
        <input id="q" name="q" type="search" defaultValue={q} placeholder="What are you looking for?" className="field pr-12 text-base" />
      </form>
      {q && <p className="mt-6 text-sm text-muted">{results.length} {results.length === 1 ? 'result' : 'results'}</p>}
      {results.length > 0 && (
        <>
          <h2 className="sr-only">Products</h2>
          <Stagger className="mt-10 grid grid-cols-2 gap-x-3 gap-y-10 md:grid-cols-3 md:gap-x-4 lg:grid-cols-4">
            {results.map((p) => <StaggerItem key={p.id}><ProductCard product={p} /></StaggerItem>)}
          </Stagger>
        </>
      )}
      {q && results.length === 0 && <p className="mt-10">Nothing matched “{q}”. Try punjabi, pants or shoes.</p>}
    </section>
  );
}
