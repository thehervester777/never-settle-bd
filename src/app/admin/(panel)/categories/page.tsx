import { asc, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requirePermission } from '@/lib/auth';
import { PageHeader } from '@/components/admin/ui';
import { AdminIcon } from '@/components/admin/AdminIcon';
import { CategoryManager, type CategoryRow } from '@/components/admin/CategoryManager';

export const metadata = { title: 'Categories' };

export default async function CategoriesPage() {
  await requirePermission('products');
  const [rows, counts] = await Promise.all([
    db.select().from(schema.categories).orderBy(asc(schema.categories.sortOrder), asc(schema.categories.name)),
    db.select({ id: schema.products.categoryId, total: sql<number>`COUNT(*)`, live: sql<number>`SUM(${schema.products.isActive})` }).from(schema.products).groupBy(schema.products.categoryId),
  ]);
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
      <CategoryManager categories={categories} />
    </div>
  );
}
