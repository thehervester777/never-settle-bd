import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { facetsFor, getCategory, listProducts, SORTS, type Sort } from '@/lib/catalog';
import { ProductCard } from '@/components/product/ProductCard';
import { CollectionToolbar } from '@/components/product/CollectionToolbar';
import { Reveal, SplitText, Stagger, StaggerItem } from '@/components/motion/Reveal';
import { toPoisha } from '@/lib/money';

const SPECIAL: Record<string, { title: string; description: string }> = {
  all: { title: 'Shop all', description: 'Every T-shirt, pant, punjabi, kurta, shoe and wallet in one place.' },
  'new-in': { title: 'New in', description: 'The latest drops, fresh from the studio.' },
  sale: { title: 'Sale', description: 'Marked down, still built to last.' },
};

type Params = { slug: string };
type Search = Record<string, string | string[] | undefined>;
const arr = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);

async function resolve(slug: string) {
  if (SPECIAL[slug]) return SPECIAL[slug];
  const c = await getCategory(slug);
  return c ? { title: c.name, description: c.description ?? '' } : null;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const info = await resolve(slug);
  return info ? { title: info.title, description: info.description || undefined } : {};
}

export default async function CollectionPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Search> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const info = await resolve(slug);
  if (!info) notFound();

  const sort = (SORTS.some((s) => s.value === sp.sort) ? sp.sort : 'featured') as Sort;
  const filters = {
    sizes: arr(sp.size),
    colors: arr(sp.color),
    min: sp.min ? toPoisha(Number(sp.min)) : undefined,
    max: sp.max ? toPoisha(Number(sp.max)) : undefined,
  };
  const [products, allInCollection] = await Promise.all([
    listProducts({ category: slug, sort, ...filters }),
    listProducts({ category: slug }),
  ]);
  const facets = await facetsFor(allInCollection);

  return (
    <>
      <header className="border-b border-ink/10">
        <div className="container pb-10 pt-12 md:pt-16">
          <Reveal><p className="eyebrow mb-3 text-muted">{allInCollection.length} {allInCollection.length === 1 ? 'product' : 'products'}</p></Reveal>
          <SplitText as="h1" text={info.title} className="font-display text-display-lg uppercase" onMount />
          {info.description && <Reveal><p className="mt-4 max-w-xl text-sm text-muted">{info.description}</p></Reveal>}
        </div>
      </header>

      <div className="container pb-20">
        <CollectionToolbar facets={facets} count={products.length} sort={sort} active={{ sizes: filters.sizes, colors: filters.colors, min: sp.min as string | undefined, max: sp.max as string | undefined }} />
        {products.length ? (
          <>
            <h2 className="sr-only">{info.title}</h2>
            <Stagger key={JSON.stringify(sp)} className="grid grid-cols-2 gap-x-3 gap-y-10 md:grid-cols-3 md:gap-x-4 md:gap-y-14 lg:grid-cols-4">
              {products.map((p, i) => <StaggerItem key={p.id}><ProductCard product={p} priority={i < 4} /></StaggerItem>)}
            </Stagger>
          </>
        ) : (
          <div className="py-24 text-center">
            <p className="font-display text-display-sm uppercase">No products match these filters</p>
            <a href={`/collections/${slug}`} className="btn btn-primary mt-8">Clear filters</a>
          </div>
        )}
      </div>
    </>
  );
}
