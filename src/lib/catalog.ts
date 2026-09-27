import 'server-only';
import { cache } from 'react';
import { and, asc, desc, eq, inArray, like, or, sql, gte, lte, type SQL } from 'drizzle-orm';
import { db, schema } from '@/db';

const { products, productImages, variants, categories } = schema;

export type ProductCard = {
  id: number;
  title: string;
  slug: string;
  price: number;
  compareAt: number | null;
  tags: string[];
  category: string;
  categorySlug: string;
  images: { url: string; alt: string }[];
  colors: string[];
  sizes: string[];
  inStock: boolean;
  singleVariantId: number | null; // set when the product has exactly one variant (quick add)
  quick: { id: number; label: string; stock: number }[] | null; // one-tap sizes when there's at most one color
};

export type ProductDetail = ProductCard & {
  description: string;
  details: string | null;
  variants: { id: number; color: string | null; size: string | null; stock: number }[];
};

import { SORTS } from './catalog-shared';
export { SORTS };
export type Sort = (typeof SORTS)[number]['value'];

const cardColumns = {
  id: products.id,
  title: products.title,
  slug: products.slug,
  description: products.description,
  details: products.details,
  price: products.price,
  compareAt: products.compareAt,
  tags: products.tags,
  isFeatured: products.isFeatured,
  createdAt: products.createdAt,
  categoryName: categories.name,
  categorySlug: categories.slug,
};
type Row = {
  id: number; title: string; slug: string; description: string; details: string | null; price: number;
  compareAt: number | null; tags: string; isFeatured: boolean; createdAt: Date; categoryName: string; categorySlug: string;
};

const baseSelect = () => db.select(cardColumns).from(products).innerJoin(categories, eq(products.categoryId, categories.id));

async function hydrate(rows: Row[]): Promise<ProductCard[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const [imgs, vars] = await Promise.all([
    db.select().from(productImages).where(inArray(productImages.productId, ids)).orderBy(asc(productImages.sortOrder), asc(productImages.id)),
    db.select().from(variants).where(inArray(variants.productId, ids)).orderBy(asc(variants.id)),
  ]);
  const uniq = (a: (string | null)[]) => [...new Set(a.filter(Boolean) as string[])];
  return rows.map((r) => {
    const v = vars.filter((x) => x.productId === r.id);
    return {
      id: r.id,
      title: r.title,
      slug: r.slug,
      price: r.price,
      compareAt: r.compareAt,
      tags: r.tags ? r.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      category: r.categoryName,
      categorySlug: r.categorySlug,
      images: imgs.filter((i) => i.productId === r.id).map((i) => ({ url: i.url, alt: i.alt || r.title })),
      colors: uniq(v.map((x) => x.color)),
      sizes: uniq(v.map((x) => x.size)),
      inStock: v.some((x) => x.stock > 0),
      singleVariantId: v.length === 1 ? v[0].id : null,
      quick: uniq(v.map((x) => x.color)).length <= 1 ? v.map((x) => ({ id: x.id, label: x.size || 'One size', stock: x.stock })) : null,
    };
  });
}

export type ListFilters = {
  category?: string; // slug, or special: 'all' | 'new-in' | 'sale'
  q?: string;
  sizes?: string[];
  colors?: string[];
  min?: number; // poisha
  max?: number;
  sort?: Sort;
  limit?: number;
  featured?: boolean;
};

export async function listProducts(f: ListFilters = {}): Promise<ProductCard[]> {
  const where: SQL[] = [eq(products.isActive, true)];
  if (f.category && !['all', 'new-in', 'sale'].includes(f.category)) where.push(eq(categories.slug, f.category));
  if (f.category === 'new-in') where.push(like(products.tags, '%new%'));
  if (f.category === 'sale') where.push(sql`${products.compareAt} > ${products.price}`);
  if (f.featured) where.push(eq(products.isFeatured, true));
  if (f.q) {
    const term = `%${f.q.trim()}%`;
    where.push(or(like(products.title, term), like(categories.name, term), like(products.tags, term))!);
  }
  if (f.min != null) where.push(gte(products.price, f.min));
  if (f.max != null) where.push(lte(products.price, f.max));
  if (f.sizes?.length) {
    where.push(sql`EXISTS (SELECT 1 FROM ${variants} v WHERE v.product_id = ${products.id} AND v.size IN (${sql.join(f.sizes.map((s) => sql`${s}`), sql`, `)}))`);
  }
  if (f.colors?.length) {
    where.push(sql`EXISTS (SELECT 1 FROM ${variants} v WHERE v.product_id = ${products.id} AND v.color IN (${sql.join(f.colors.map((s) => sql`${s}`), sql`, `)}))`);
  }
  const order =
    f.sort === 'price-asc' ? [asc(products.price)]
      : f.sort === 'price-desc' ? [desc(products.price)]
        : f.sort === 'newest' ? [desc(products.createdAt), desc(products.id)]
          : [desc(products.isFeatured), desc(products.createdAt), desc(products.id)];

  const rows = await baseSelect().where(and(...where)).orderBy(...order).limit(f.limit ?? 200);
  return hydrate(rows);
}

export const getProduct = cache(async (slug: string): Promise<ProductDetail | null> => {
  const rows = await baseSelect().where(and(eq(products.slug, slug), eq(products.isActive, true))).limit(1);
  if (!rows.length) return null;
  const [card] = await hydrate(rows);
  const vars = await db.select().from(variants).where(eq(variants.productId, rows[0].id)).orderBy(asc(variants.id));
  return {
    ...card,
    description: rows[0].description,
    details: rows[0].details,
    variants: vars.map((v) => ({ id: v.id, color: v.color, size: v.size, stock: v.stock })),
  };
});

export const getCategories = cache(async () =>
  db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name)),
);

export const getCategory = cache(async (slug: string) => {
  const [c] = await db.select().from(categories).where(eq(categories.slug, slug)).limit(1);
  return c ?? null;
});

/** Filter options (sizes, colors, price range) for a listing. */
export async function facetsFor(products: ProductCard[]) {
  const sizes = [...new Set(products.flatMap((p) => p.sizes))];
  const order = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
  sizes.sort((a, b) => {
    const ia = order.indexOf(a), ib = order.indexOf(b);
    if (ia >= 0 && ib >= 0) return ia - ib;
    if (!isNaN(+a) && !isNaN(+b)) return +a - +b;
    return ia >= 0 ? -1 : ib >= 0 ? 1 : a.localeCompare(b);
  });
  return {
    sizes,
    colors: [...new Set(products.flatMap((p) => p.colors))].sort(),
    maxPrice: Math.max(0, ...products.map((p) => p.price)),
  };
}
