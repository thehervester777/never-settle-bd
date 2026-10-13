import Link from 'next/link';
import { and, asc, desc, eq, inArray, like, sql, type SQL } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requirePermission } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { getSettings } from '@/lib/settings';
import { getCategories } from '@/lib/catalog';
import { formatBDT } from '@/lib/money';
import { EmptyState, PageHeader, Segmented } from '@/components/admin/ui';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { AdminIcon } from '@/components/admin/AdminIcon';

export const metadata = { title: 'Products' };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ q?: string; cat?: string; show?: string }> }) {
  const admin = await requirePermission('products');
  const canCost = can(admin.role, 'costs');
  const sp = await searchParams;
  const { products, categories, variants, productImages } = schema;
  const settings = await getSettings();
  const where: SQL[] = [];
  const q = sp.q?.trim().replace(/[%_]/g, '');
  if (q) where.push(like(products.title, `%${q}%`));
  if (sp.cat && Number(sp.cat)) where.push(eq(products.categoryId, Number(sp.cat)));
  if (sp.show === 'hidden') where.push(eq(products.isActive, false));
  if (sp.show === 'visible') where.push(eq(products.isActive, true));

  const [rows, cats] = await Promise.all([
    db.select({ id: products.id, title: products.title, slug: products.slug, price: products.price, compareAt: products.compareAt, isActive: products.isActive, isFeatured: products.isFeatured, category: categories.name })
      .from(products).innerJoin(categories, eq(products.categoryId, categories.id))
      .where(where.length ? and(...where) : undefined).orderBy(desc(products.createdAt)).limit(500),
    getCategories(),
  ]);
  const ids = rows.map((r) => r.id);
  const [stock, imgs] = ids.length
    ? await Promise.all([
      db.select({ productId: variants.productId, total: sql<number>`SUM(${variants.stock})`, sizes: sql<number>`COUNT(*)`, low: sql<number>`SUM(${variants.stock} <= ${settings.lowStockThreshold})`, cost: sql<number>`AVG(NULLIF(${variants.cost}, 0))` })
        .from(variants).where(inArray(variants.productId, ids)).groupBy(variants.productId),
      db.select().from(productImages).where(inArray(productImages.productId, ids)).orderBy(asc(productImages.sortOrder)),
    ])
    : [[], []];
  const qs = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ q: sp.q, cat: sp.cat, show: sp.show, ...extra }).filter(([, v]) => v) as [string, string][]);
    return p.size ? `?${p}` : '';
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Products" description={`${rows.length} product${rows.length === 1 ? '' : 's'}`} actions={<Link href="/admin/products/new" className="abtn abtn-primary"><AdminIcon name="plus" className="h-4 w-4" /> Add product</Link>} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Segmented current={sp.show ?? 'all'} items={[['all', 'All'], ['visible', 'Visible'], ['hidden', 'Hidden']].map(([k, l]) => ({ key: k, label: l, href: `/admin/products${qs({ show: k === 'all' ? undefined : k })}` }))} />
        <form className="flex flex-wrap gap-2">
          {sp.show && <input type="hidden" name="show" value={sp.show} />}
          <select name="cat" defaultValue={sp.cat ?? ''} className="aselect w-44"><option value="">All categories</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <input name="q" defaultValue={sp.q} placeholder="Search products" className="ainput w-56" />
          <button className="abtn abtn-primary">Search</button>
        </form>
      </div>
      <section className="admin-card p-0">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead><tr><th>Product</th><th>Category</th><th className="text-right">Price</th>{canCost && <th className="text-right">Margin</th>}<th className="text-right">Stock</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((p) => {
                const img = imgs.find((i) => i.productId === p.id);
                const s = stock.find((x) => x.productId === p.id);
                const total = Number(s?.total ?? 0), low = Number(s?.low ?? 0), cost = Number(s?.cost ?? 0);
                const margin = cost && p.price ? (p.price - cost) / p.price : null;
                return (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/admin/products/${p.id}`} className="group flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {img ? <img src={img.url} alt="" className="h-14 w-11 rounded-lg object-cover transition group-hover:scale-105" /> : <span className="h-14 w-11 rounded-lg bg-[#f4f4f1]" />}
                        <span><span className="font-medium group-hover:underline">{p.title}</span>{p.isFeatured && <span className="ml-2 rounded-full bg-accent px-1.5 py-0.5 text-[0.6rem] font-bold uppercase">Best seller</span>}
                          <span className="block text-xs text-ink/45">{Number(s?.sizes ?? 0)} sizes/colours</span></span>
                      </Link>
                    </td>
                    <td className="text-ink/70">{p.category}</td>
                    <td className="text-right tabular">{formatBDT(p.price)}{p.compareAt && <span className="block text-xs text-ink/40 line-through">{formatBDT(p.compareAt)}</span>}</td>
                    {canCost && <td className={`text-right tabular ${margin === null ? 'text-ink/35' : margin < 0.2 ? 'text-amber-600' : 'text-emerald-700'}`}>{margin === null ? 'No cost' : `${(margin * 100).toFixed(0)}%`}</td>}
                    <td className="text-right"><span className={`font-semibold tabular ${total <= 0 ? 'text-red-600' : ''}`}>{total}</span>{low > 0 && total > 0 && <span className="block text-xs text-amber-600">{low} size{low === 1 ? '' : 's'} low</span>}</td>
                    <td><StatusBadge status={p.isActive ? 'ACTIVE' : 'DISABLED'} label={p.isActive ? 'Visible' : 'Hidden'} /></td>
                  </tr>
                );
              })}
              {!rows.length && <tr><td colSpan={6}><EmptyState icon="products" title="No products found"><Link href="/admin/products/new" className="underline">Add a product</Link></EmptyState></td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
