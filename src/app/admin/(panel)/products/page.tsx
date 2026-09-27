import Link from 'next/link';
import { asc, desc, eq, inArray, like, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { formatBDT } from '@/lib/money';

export const metadata = { title: 'Products' };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const { products, categories, variants, productImages } = schema;
  const rows = await db
    .select({ id: products.id, title: products.title, slug: products.slug, price: products.price, isActive: products.isActive, isFeatured: products.isFeatured, category: categories.name })
    .from(products).innerJoin(categories, eq(products.categoryId, categories.id))
    .where(q ? like(products.title, `%${q}%`) : undefined)
    .orderBy(desc(products.createdAt)).limit(500);
  const ids = rows.map((r) => r.id);
  const [stock, imgs] = ids.length
    ? await Promise.all([
      db.select({ productId: variants.productId, total: sql<number>`SUM(${variants.stock})` }).from(variants).where(inArray(variants.productId, ids)).groupBy(variants.productId),
      db.select().from(productImages).where(inArray(productImages.productId, ids)).orderBy(asc(productImages.sortOrder)),
    ])
    : [[], []];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-4xl uppercase">Products</h1>
        <div className="flex w-full gap-2 sm:w-auto">
          <form className="min-w-0 flex-1 sm:flex-none"><input name="q" defaultValue={q} placeholder="Search products" className="field w-full bg-white py-2 sm:w-56" /></form>
          <Link href="/admin/products/new" className="btn btn-primary shrink-0 py-2">Add product</Link>
        </div>
      </div>
      <div className="admin-card overflow-x-auto p-0">
        <table className="admin-table">
          <thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((p) => {
              const img = imgs.find((i) => i.productId === p.id);
              const total = Number(stock.find((s) => s.productId === p.id)?.total ?? 0);
              return (
                <tr key={p.id} className="hover:bg-bone/40">
                  <td>
                    <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {img ? <img src={img.url} alt="" className="h-14 w-11 object-cover" /> : <span className="h-14 w-11 bg-bone" />}
                      <span className="font-medium underline">{p.title}</span>
                    </Link>
                  </td>
                  <td>{p.category}</td>
                  <td className="tabular-nums">{formatBDT(p.price)}</td>
                  <td className={`tabular-nums ${total === 0 ? 'text-sale' : ''}`}>{total}</td>
                  <td className="text-xs">{p.isActive ? 'Active' : 'Hidden'}{p.isFeatured ? ' · Featured' : ''}</td>
                </tr>
              );
            })}
            {!rows.length && <tr><td colSpan={5} className="py-10 text-center text-muted">No products yet. <Link href="/admin/products/new" className="underline">Add your first product</Link>.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
