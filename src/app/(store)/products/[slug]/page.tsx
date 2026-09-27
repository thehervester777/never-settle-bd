import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getProduct, listProducts } from '@/lib/catalog';
import { ProductBuy } from '@/components/product/ProductBuy';
import { ProductGallery } from '@/components/product/ProductGallery';
import { ProductCard } from '@/components/product/ProductCard';
import { SplitText, Stagger, StaggerItem } from '@/components/motion/Reveal';
import { getSettings } from '@/lib/settings';
import { formatBDT } from '@/lib/money';

type Params = { slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const p = await getProduct((await params).slug);
  if (!p) return {};
  const description = p.description.replace(/<[^>]+>/g, '').slice(0, 155);
  return { title: p.title, description, openGraph: { title: p.title, description, images: p.images[0] ? [p.images[0].url] : [] } };
}

export default async function ProductPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();
  const [related, featured, latest, settings] = await Promise.all([
    listProducts({ category: product.categorySlug, limit: 5 }),
    listProducts({ featured: true, limit: 8 }),
    listProducts({ limit: 8 }),
    getSettings(),
  ]);
  // Same category first, topped up with featured and then newest pieces so the row is always full.
  const seen = new Set([product.id]);
  const others = [...related, ...featured, ...latest].filter((r) => !seen.has(r.id) && seen.add(r.id)).slice(0, 4);
  const site = process.env.NEXT_PUBLIC_SITE_URL || '';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    image: product.images.map((i) => `${site}${i.url}`),
    description: product.description.replace(/<[^>]+>/g, ''),
    brand: { '@type': 'Brand', name: 'NEVER SETTLE' },
    offers: {
      '@type': 'Offer',
      priceCurrency: 'BDT',
      price: (product.price / 100).toFixed(2),
      availability: product.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: `${site}/products/${product.slug}`,
    },
  };

  return (
    <>
      <section className="pb-16 md:container md:pb-24 md:pt-6">
        <nav className="container hidden py-4 text-xs text-muted md:block md:px-0" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-ink">Home</Link> <span className="mx-2">/</span>
          <Link href={`/collections/${product.categorySlug}`} className="hover:text-ink">{product.category}</Link> <span className="mx-2">/</span>
          <span className="text-ink">{product.title}</span>
        </nav>
        <div className="grid gap-8 md:grid-cols-12 md:gap-10 lg:gap-16">
          <div className="md:col-span-7"><ProductGallery images={product.images} title={product.title} /></div>
          <div className="container md:col-span-5 md:px-0">
            <div className="md:sticky md:top-24">
              <p className="eyebrow mb-3 text-muted">{product.category}</p>
              <SplitText as="h1" text={product.title} className="font-display text-display-sm uppercase md:text-5xl" onMount />
              <ProductBuy
                product={{
                  id: product.id, slug: product.slug, title: product.title, price: product.price, compareAt: product.compareAt,
                  image: product.images[0]?.url ?? null, variants: product.variants,
                }}
                deliveryNote={`${settings.codEnabled ? 'Cash on delivery available · ' : ''}Inside Dhaka ${formatBDT(settings.shippingInsideDhaka)} · Outside Dhaka ${formatBDT(settings.shippingOutsideDhaka)}${settings.freeShippingThreshold ? ` · Free over ${formatBDT(settings.freeShippingThreshold)}` : ''}`}
              />
              <div className="mt-8 border-t border-ink/15">
                <Details title="Description" open><div className="rte" dangerouslySetInnerHTML={{ __html: product.description }} /></Details>
                {product.details && <Details title="Details & care"><div className="rte" dangerouslySetInnerHTML={{ __html: product.details }} /></Details>}
                <Details title="Delivery & exchange">
                  <p>Inside Dhaka in 1–2 working days, outside Dhaka in 2–4. Exchange within 7 days if the item is unworn with tags attached. <Link href="/policies/returns" className="underline">Read the policy</Link>.</p>
                </Details>
              </div>
            </div>
          </div>
        </div>
      </section>

      {others.length > 0 && (
        <section className="border-t border-ink/10 py-16 md:py-24">
          <div className="container">
            <SplitText text="You may also like" className="mb-8 font-display text-display-sm uppercase md:mb-12" />
            <Stagger className="grid grid-cols-2 gap-x-3 gap-y-10 md:gap-x-4 lg:grid-cols-4">
              {others.map((p) => <StaggerItem key={p.id}><ProductCard product={p} /></StaggerItem>)}
            </Stagger>
          </div>
        </section>
      )}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
    </>
  );
}

function Details({ title, children, open = false }: { title: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details className="group border-b border-ink/15" open={open}>
      <summary className="flex items-center justify-between py-5 text-xs font-semibold uppercase tracking-[0.18em]">
        {title}
        <span className="text-lg leading-none transition-transform duration-300 group-open:rotate-45">+</span>
      </summary>
      <div className="pb-6 text-sm text-ink/80">{children}</div>
    </details>
  );
}
