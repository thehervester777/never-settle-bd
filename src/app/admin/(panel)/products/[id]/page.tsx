import { notFound } from 'next/navigation';
import { asc, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requirePermission } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { getCategories } from '@/lib/catalog';
import { ProductEditor } from '@/components/admin/ProductEditor';
import { PageHeader } from '@/components/admin/ui';
import { StatusBadge } from '@/components/admin/StatusBadge';

export const metadata = { title: 'Edit product' };

export default async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requirePermission('products');
  const canCost = can(admin.role, 'costs');
  const id = Number((await params).id);
  const [p] = Number.isFinite(id) ? await db.select().from(schema.products).where(eq(schema.products.id, id)).limit(1) : [];
  if (!p) notFound();
  const [imgs, vars, categories] = await Promise.all([
    db.select().from(schema.productImages).where(eq(schema.productImages.productId, id)).orderBy(asc(schema.productImages.sortOrder)),
    db.select().from(schema.variants).where(eq(schema.variants.productId, id)).orderBy(asc(schema.variants.id)),
    getCategories(),
  ]);
  return (
    <div>
      <PageHeader back={{ href: '/admin/products', label: 'Products' }} title={p.title} description={<span className="inline-flex items-center gap-2"><StatusBadge status={p.isActive ? 'ACTIVE' : 'DISABLED'} label={p.isActive ? 'Visible in store' : 'Hidden'} /> Changes go live as soon as you save.</span>} />
      <ProductEditor
        key={p.updatedAt.toISOString()}
        canCost={canCost}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        initial={{
          id: p.id, title: p.title, slug: p.slug, categoryId: p.categoryId, price: String(p.price / 100), compareAt: p.compareAt ? String(p.compareAt / 100) : '',
          description: p.description, details: p.details ?? '', tags: p.tags, isActive: p.isActive, isFeatured: p.isFeatured,
          images: imgs.map((i) => ({ url: i.url, alt: i.alt })),
          variants: vars.map((v) => ({ id: v.id, color: v.color ?? '', size: v.size ?? '', sku: v.sku ?? '', stock: v.stock, cost: canCost && v.cost ? String(v.cost / 100) : '' })),
        }}
      />
    </div>
  );
}
