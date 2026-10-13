import { asc, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { getSession } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { csv, csvResponse } from '@/lib/csv';
import { dhakaDate } from '@/lib/dates';

/** Stock list as a spreadsheet; cost columns only for people allowed to see costs. */
export async function GET() {
  const admin = await getSession();
  if (!admin || !can(admin.role, 'inventory')) return new Response('Not allowed', { status: 403 });
  const costs = can(admin.role, 'costs');
  const { variants, products, categories } = schema;
  const rows = await db.select({ title: products.title, category: categories.name, color: variants.color, size: variants.size, sku: variants.sku, stock: variants.stock, cost: variants.cost, price: products.price, active: products.isActive })
    .from(variants).innerJoin(products, eq(variants.productId, products.id)).innerJoin(categories, eq(products.categoryId, categories.id))
    .orderBy(asc(products.title), asc(variants.id));
  const headers = ['Product', 'Category', 'Colour', 'Size', 'SKU', 'In stock', 'Price', ...(costs ? ['Cost', 'Stock value at cost'] : []), 'Visible'];
  return csvResponse(csv(headers, rows.map((r) => [
    r.title, r.category, r.color ?? '', r.size ?? '', r.sku ?? '', r.stock, r.price / 100,
    ...(costs ? [r.cost / 100, (Math.max(r.stock, 0) * r.cost) / 100] : []), r.active ? 'Yes' : 'No',
  ])), `inventory-${dhakaDate()}.csv`);
}
