import type { MetadataRoute } from 'next';
import { getCategories, listProducts } from '@/lib/catalog';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const [cats, products] = await Promise.all([getCategories().catch(() => []), listProducts({ limit: 5000 }).catch(() => [])]);
  const statics = ['', '/collections/all', '/collections/new-in', '/about', '/contact', '/faq', '/size-guide', '/policies/returns', '/policies/shipping', '/policies/privacy', '/policies/terms'];
  return [
    ...statics.map((p) => ({ url: `${site}${p}`, changeFrequency: 'weekly' as const })),
    ...cats.map((c) => ({ url: `${site}/collections/${c.slug}`, changeFrequency: 'daily' as const })),
    ...products.map((p) => ({ url: `${site}/products/${p.slug}`, changeFrequency: 'weekly' as const })),
  ];
}
