import Link from 'next/link';
import { notFound } from 'next/navigation';
import { asc, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { getCategories } from '@/lib/catalog';
import { ProductEditor } from '@/components/admin/ProductEditor';

export const metadata = { title: 'Edit product' };

export default async function EditProduct({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const id = Number((await params).id);
  const { saved } = await searchParams;
  const [p] = await db.select().from(schema.products).where(eq(schema.products.id, id)).limit(1);
  if (!p) notFound();
  const [imgs, vars, categories] = await Promise.all([
    db.select().from(schema.productImages).where(eq(schema.productImages.productId, id)).orderBy(asc(schema.productImages.sortOrder)),
    db.select().from(schema.variants).where(eq(schema.variants.productId, id)).orderBy(asc(schema.variants.id)),
    getCategories(),
  ]);
  return (
    <div className="space-y-6">
      <Link href="/admin/products" className="text-sm underline">← Products</Link>
      <h1 className="font-display text-4xl uppercase">{p.title}</h1>
      {saved && <p className="bg-emerald-100 p-3 text-sm text-emerald-900">Saved. Changes are live in the store.</p>}
      <ProductEditor
        key={p.updatedAt.toISOString()}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        initial={{
          id: p.id, title: p.title, slug: p.slug, categoryId: p.categoryId, price: String(p.price / 100), compareAt: p.compareAt ? String(p.compareAt / 100) : '',
          description: p.description, details: p.details ?? '', tags: p.tags, isActive: p.isActive, isFeatured: p.isFeatured,
          images: imgs.map((i) => ({ url: i.url, alt: i.alt })),
          variants: vars.map((v) => ({ id: v.id, color: v.color ?? '', size: v.size ?? '', sku: v.sku ?? '', stock: v.stock })),
        }}
      />
    </div>
  );
}
