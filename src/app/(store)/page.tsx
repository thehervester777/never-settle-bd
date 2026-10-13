import { Hero } from '@/components/home/Hero';
import { Banner, CategoryTiles, Marquee, ProductRow, PromiseSection, Story } from '@/components/home/Sections';
import { getCategories, listProducts } from '@/lib/catalog';
import { getSlides } from '@/lib/home';

export default async function HomePage() {
  const [slides, newIn, featured, categories, all] = await Promise.all([
    getSlides(),
    listProducts({ category: 'new-in', sort: 'newest', limit: 4 }),
    listProducts({ featured: true, limit: 4 }),
    getCategories(),
    listProducts({ limit: 500 }),
  ]);
  const counts = (slug: string) => all.filter((p) => p.categorySlug === slug).length;

  return (
    <>
      {slides.length > 0 ? <Hero slides={slides} /> : <h1 className="sr-only">{process.env.NEXT_PUBLIC_STORE_NAME || 'NEVER SETTLE'}</h1>}
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
