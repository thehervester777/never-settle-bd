import { asc, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requirePermission } from '@/lib/auth';
import { PageHeader } from '@/components/admin/ui';
import { AdminIcon } from '@/components/admin/AdminIcon';
import { CategoryManager, type CategoryRow, type PickProduct } from '@/components/admin/CategoryManager';

export const metadata = { title: 'Categories' };

export default async function CategoriesPage() {
  await requirePermission('products');
  const [rows, counts, productRows, images] = await Promise.all([
    db.select().from(schema.categories).orderBy(asc(schema.categories.sortOrder), asc(schema.categories.name)),
    db.select({ id: schema.products.categoryId, total: sql<number>`COUNT(*)`, live: sql<number>`SUM(${schema.products.isActive})` }).from(schema.products).groupBy(schema.products.categoryId),
    db.select({ id: schema.products.id, title: schema.products.title, categoryId: schema.products.categoryId, isActive: schema.products.isActive, price: schema.products.price })
      .from(schema.products).orderBy(asc(schema.products.title)),
    db.select({ productId: schema.productImages.productId, url: schema.productImages.url }).from(schema.productImages)
      .orderBy(asc(schema.productImages.productId), asc(schema.productImages.sortOrder), asc(schema.productImages.id)),
  ]);
  const firstImage = new Map<number, string>();
  for (const im of images) if (!firstImage.has(im.productId)) firstImage.set(im.productId, im.url);
  const products: PickProduct[] = productRows.map((p) => ({ id: p.id, title: p.title, categoryId: p.categoryId, isActive: p.isActive, price: p.price, image: firstImage.get(p.id) ?? '' }));
  const byId = new Map(counts.map((c) => [c.id, c]));
  const categories: CategoryRow[] = rows.map((c) => ({
    id: c.id, name: c.name, slug: c.slug, description: c.description ?? '', image: c.image ?? '',
    products: Number(byId.get(c.id)?.total ?? 0), live: Number(byId.get(c.id)?.live ?? 0),
  }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Categories"
        description="The groups your products are sorted into, with the pictures shown on the homepage and in the menu"
        actions={<a href="/#categories" target="_blank" className="abtn abtn-outline"><AdminIcon name="external" className="h-4 w-4" /> View in store</a>}
      />
      <CategoryManager categories={categories} products={products} />
    </div>
  );
}
