import Link from 'next/link';
import { and, asc, eq, gt, inArray, like, lte, or, type SQL } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requirePermission } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { getSettings } from '@/lib/settings';
import { formatBDT } from '@/lib/money';
import { inventoryTotals } from '@/lib/reports';
import { getCategories } from '@/lib/catalog';
import { InventoryTable } from '@/components/admin/InventoryTable';
import { PageHeader, Segmented } from '@/components/admin/ui';
import { StatTile } from '@/components/admin/StatTile';
import { AdminIcon } from '@/components/admin/AdminIcon';

export const metadata = { title: 'Inventory' };

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ filter?: string; q?: string; cat?: string }> }) {
  const admin = await requirePermission('inventory');
  const canCost = can(admin.role, 'costs');
  const sp = await searchParams;
  const settings = await getSettings();
  const lowAt = settings.lowStockThreshold;
  const { variants, products, productImages } = schema;

  const where: SQL[] = [eq(products.isActive, true)];
  if (sp.filter === 'low') where.push(gt(variants.stock, 0), lte(variants.stock, lowAt));
  if (sp.filter === 'out') where.push(lte(variants.stock, 0));
  if (sp.filter === 'nocost' && canCost) where.push(eq(variants.cost, 0));
  if (sp.cat && Number(sp.cat)) where.push(eq(products.categoryId, Number(sp.cat)));
  const q = sp.q?.trim().replace(/[%_]/g, '');
  if (q) where.push(or(like(products.title, `%${q}%`), like(variants.sku, `%${q}%`), like(variants.color, `%${q}%`))!);

  const [rows, totals, categories] = await Promise.all([
    db.select({ id: variants.id, productId: products.id, title: products.title, price: products.price, color: variants.color, size: variants.size, sku: variants.sku, stock: variants.stock, cost: variants.cost })
      .from(variants).innerJoin(products, eq(variants.productId, products.id)).where(and(...where))
      .orderBy(asc(products.title), asc(variants.id)).limit(1000),
    inventoryTotals(lowAt),
    getCategories(),
  ]);
  const imgs = rows.length
    ? await db.select({ productId: productImages.productId, url: productImages.url, sort: productImages.sortOrder }).from(productImages).where(inArray(productImages.productId, [...new Set(rows.map((r) => r.productId))])).orderBy(asc(productImages.sortOrder))
    : [];
  const firstImg = new Map<number, string>();
  for (const i of imgs) if (!firstImg.has(i.productId)) firstImg.set(i.productId, i.url);

  const qs = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ filter: sp.filter, q: sp.q, cat: sp.cat, ...extra }).filter(([, v]) => v) as [string, string][]);
    return p.size ? `?${p}` : '';
  };
  const filters = [['all', 'All items'], ['low', `Low (${totals.low})`], ['out', `Sold out (${totals.outOfStock})`], ...(canCost ? [['nocost', `No cost (${totals.noCost})`]] : [])] as [string, string][];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description={`Stock for every size and colour · low stock means ${lowAt} or fewer`}
        actions={(
          <>
            <Link href="/admin/inventory/movements" className="abtn abtn-outline"><AdminIcon name="history" className="h-4 w-4" /> Stock history</Link>
            <a href="/admin/inventory/export" className="abtn abtn-outline"><AdminIcon name="download" className="h-4 w-4" /> Export CSV</a>
          </>
        )}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Units in stock" value={totals.units} hint={`${totals.skus} sizes & colours`} icon="box" />
        {canCost
          ? <StatTile tone="accent" label="Stock value at cost" value={totals.costValue} format="bdt" hint={`${formatBDT(totals.retailValue)} at selling price`} icon="cash" />
          : <StatTile label="Products active" value={new Set(rows.map((r) => r.productId)).size} icon="products" />}
        <StatTile label="Low stock" value={totals.low} hint={`${lowAt} or fewer left`} icon="alert" />
        <StatTile label="Sold out" value={totals.outOfStock} hint="Customers can't buy these" icon="close" />
      </div>
      {canCost && totals.noCost > 0 && (
        <Link href={`/admin/inventory${qs({ filter: 'nocost' })}`} className="flex items-center gap-3 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-inset ring-amber-200 transition hover:bg-amber-100">
          <AdminIcon name="alert" className="h-5 w-5 shrink-0" />
          <span><strong>{totals.noCost} items have no purchase cost.</strong> Profit reports count them as free. Add costs in each product (Products → product → Cost) or when restocking.</span>
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Segmented current={sp.filter ?? 'all'} items={filters.map(([k, l]) => ({ key: k, label: l, href: `/admin/inventory${qs({ filter: k === 'all' ? undefined : k })}` }))} />
        <form className="flex flex-wrap gap-2">
          {sp.filter && <input type="hidden" name="filter" value={sp.filter} />}
          <select name="cat" defaultValue={sp.cat ?? ''} className="aselect w-44"><option value="">All categories</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <input name="q" defaultValue={sp.q} placeholder="Product, SKU or colour" className="ainput w-56" />
          <button className="abtn abtn-primary">Search</button>
        </form>
      </div>
      <section className="admin-card p-0">
        <InventoryTable
          canCost={canCost}
          canProducts={can(admin.role, 'products')}
          rows={rows.map((r) => ({
            id: r.id, productId: r.productId, title: r.title, variant: [r.color, r.size].filter(Boolean).join(' / ') || 'One size', sku: r.sku ?? '',
            image: firstImg.get(r.productId) ?? null, stock: r.stock, costRaw: canCost ? r.cost : 0, cost: canCost ? formatBDT(r.cost) : null,
            price: formatBDT(r.price), value: canCost ? formatBDT(Math.max(r.stock, 0) * r.cost) : null,
            state: r.stock <= 0 ? 'OUT' : r.stock <= lowAt ? 'LOW' : 'IN_STOCK',
          }))}
        />
      </section>
    </div>
  );
}
