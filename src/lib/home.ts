import 'server-only';
import { asc, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import type { Slide } from '@/components/home/Hero';

export type SlideRow = typeof schema.homeSlides.$inferSelect;

/** Shown if the database can't be reached, so the homepage never loses its slider. */
const FALLBACK: Slide[] = [
  {
    media: 'image', src: '/images/hero-1.jpg', eyebrow: 'New season', heading: 'Never\nSettle',
    text: 'T-shirts, pants and punjabis cut for everyday Dhaka, plus shoes and wallets to finish the look.',
    cta: { label: 'Shop new arrivals', href: '/collections/new-in' }, cta2: { label: 'Shop punjabis', href: '/collections/punjabis' },
  },
  {
    media: 'image', src: '/images/hero-2.jpg', eyebrow: 'Punjabi season', heading: 'Punjabi\nSeason',
    text: 'Festive punjabis and kurtas in breathable cotton and soft linen blends.',
    cta: { label: 'Shop the edit', href: '/collections/punjabis' },
  },
];

const cta = (label: string, href: string) => (label.trim() && href.trim() ? { label: label.trim(), href: href.trim() } : null);

export const toSlide = (r: SlideRow): Slide => ({
  media: r.mediaType === 'VIDEO' ? 'video' : 'image', src: r.mediaUrl, mobileSrc: r.mobileMediaUrl, poster: r.posterUrl,
  eyebrow: r.eyebrow, heading: r.heading.replace(/\r/g, ''), text: r.text,
  cta: cta(r.ctaLabel, r.ctaHref), cta2: cta(r.cta2Label, r.cta2Href),
});

/** The live homepage slides, in the order set in Admin → Homepage slider. */
export async function getSlides(): Promise<Slide[]> {
  try {
    const rows = await db.select().from(schema.homeSlides).where(eq(schema.homeSlides.isActive, true))
      .orderBy(asc(schema.homeSlides.sortOrder), asc(schema.homeSlides.id));
    return rows.map(toSlide);
  } catch (e) {
    console.error('Homepage slides unavailable', e);
    return FALLBACK;
  }
}
