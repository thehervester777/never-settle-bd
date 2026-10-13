import { asc, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requirePermission } from '@/lib/auth';
import { getCategories } from '@/lib/catalog';
import { PageHeader } from '@/components/admin/ui';
import { AdminIcon } from '@/components/admin/AdminIcon';
import { SlideManager, type SlideRow } from '@/components/admin/SlideManager';

export const metadata = { title: 'Homepage slider' };

export default async function HomepageSliderPage() {
  await requirePermission('settings');
  const [rows, categories, products] = await Promise.all([
    db.select().from(schema.homeSlides).orderBy(asc(schema.homeSlides.sortOrder), asc(schema.homeSlides.id)),
    getCategories().catch(() => []),
    db.select({ title: schema.products.title, slug: schema.products.slug }).from(schema.products).where(eq(schema.products.isActive, true)).orderBy(asc(schema.products.title)).limit(200),
  ]);
  const slides: SlideRow[] = rows.map((r) => ({
    id: r.id, sortOrder: r.sortOrder, isActive: r.isActive, mediaType: r.mediaType, mediaUrl: r.mediaUrl, mobileMediaUrl: r.mobileMediaUrl, posterUrl: r.posterUrl,
    eyebrow: r.eyebrow, heading: r.heading, text: r.text, ctaLabel: r.ctaLabel, ctaHref: r.ctaHref, cta2Label: r.cta2Label, cta2Href: r.cta2Href,
  }));
  // Suggestions for button links
  const links = [
    { label: 'All products', href: '/collections/all' },
    ...categories.map((c) => ({ label: c.name, href: `/collections/${c.slug}` })),
    ...products.map((p) => ({ label: p.title, href: `/products/${p.slug}` })),
    { label: 'About', href: '/about' }, { label: 'Contact', href: '/contact' }, { label: 'Size guide', href: '/size-guide' },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Homepage slider"
        description="The pictures and videos at the top of your homepage, with their headings and buttons"
        actions={<a href="/" target="_blank" className="abtn abtn-outline"><AdminIcon name="external" className="h-4 w-4" /> View homepage</a>}
      />
      <SlideManager slides={slides} links={links} />
    </div>
  );
}
