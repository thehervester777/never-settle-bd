import { Hero } from '@/components/home/Hero';
import { Banner, CategoryTiles, Marquee, ProductRow, PromiseSection, Story } from '@/components/home/Sections';
import { getCategories, listProducts } from '@/lib/catalog';

export default async function HomePage() {
  const [newIn, featured, categories, all] = await Promise.all([
    listProducts({ category: 'new-in', sort: 'newest', limit: 4 }),
    listProducts({ featured: true, limit: 4 }),
    getCategories(),
    listProducts({ limit: 500 }),
  ]);
  const counts = (slug: string) => all.filter((p) => p.categorySlug === slug).length;

  return (
    <>
      <Hero
        slides={[
          {
            image: '/images/hero-1.jpg', eyebrow: 'New season', heading: 'Never\nSettle',
            text: 'T-shirts, pants and punjabis cut for everyday Dhaka, plus shoes and wallets to finish the look.',
            cta: { label: 'Shop new arrivals', href: '/collections/new-in' }, cta2: { label: 'Shop punjabis', href: '/collections/punjabis' },
          },
          {
            image: '/images/hero-2.jpg', eyebrow: 'Punjabi season', heading: 'Punjabi\nSeason',
            text: 'Festive punjabis and kurtas in breathable cotton and soft linen blends.',
            cta: { label: 'Shop the edit', href: '/collections/punjabis' },
          },
        ]}
      />
      <Marquee items={['T-shirts', 'Pants', 'Punjabis', 'Kurtas', 'Shoes', 'Wallets']} />
      {newIn.length > 0 && <ProductRow eyebrow="Just landed" heading="New arrivals" products={newIn} href="/collections/new-in" />}
      <CategoryTiles categories={categories.map((c) => ({ name: c.name, slug: c.slug, image: c.image, count: counts(c.slug) }))} />
      <Story image="/images/story.jpg" />
      {featured.length > 0 && <ProductRow eyebrow="Most wanted" heading="Best sellers" products={featured} href="/collections/all" />}
      <Banner image="/images/banner.jpg" />
      <PromiseSection />
    </>
  );
}
