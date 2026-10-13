import Link from 'next/link';
import { and, count, desc, eq, inArray, like, or, type SQL } from 'drizzle-orm';
import { db, schema } from '@/db';
import { STOCK_REASONS } from '@/db/schema';
import { requirePermission } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { formatBDT } from '@/lib/money';
import { fmtDateTime, timeAgo } from '@/lib/dates';
import { EmptyState, PageHeader, Segmented } from '@/components/admin/ui';

export const metadata = { title: 'Stock history' };

const REASON: Record<string, [string, string]> = {
  INITIAL: ['Opening stock', 'bg-neutral-100 text-neutral-700'],
  SALE: ['Sold', 'bg-sky-50 text-sky-700'],
  CANCEL: ['Order cancelled', 'bg-neutral-100 text-neutral-700'],
  RETURN: ['Returned', 'bg-rose-50 text-rose-700'],
  RESTOCK: ['Restock', 'bg-emerald-50 text-emerald-700'],
  ADJUST: ['Edited', 'bg-violet-50 text-violet-700'],
  DAMAGE: ['Damaged / lost', 'bg-amber-50 text-amber-800'],
  COUNT: ['Stock count', 'bg-indigo-50 text-indigo-700'],
};
const PER_PAGE = 50;

export default async function MovementsPage({ searchParams }: { searchParams: Promise<{ reason?: string; q?: string; page?: string }> }) {
  const admin = await requirePermission('inventory');
  const sp = await searchParams;
  const { stockMovements: m, variants, products, admins, orders } = schema;
  const where: SQL[] = [];
  if (sp.reason && (STOCK_REASONS as readonly string[]).includes(sp.reason)) where.push(eq(m.reason, sp.reason as never));
  const q = sp.q?.trim().replace(/[%_]/g, '');
  if (q) where.push(or(like(products.title, `%${q}%`), like(m.note, `%${q}%`))!);
  const page = Math.max(1, Number(sp.page) || 1);
  const w = where.length ? and(...where) : undefined;

  const [rows, [{ total }]] = await Promise.all([
    db.select({
      id: m.id, change: m.change, balance: m.balanceAfter, reason: m.reason, note: m.note, unitCost: m.unitCost, orderId: m.orderId, at: m.createdAt,
      title: products.title, productId: products.id, color: variants.color, size: variants.size, admin: admins.name,
    }).from(m).leftJoin(variants, eq(m.variantId, variants.id)).leftJoin(products, eq(m.productId, products.id)).leftJoin(admins, eq(m.adminId, admins.id))
      .where(w).orderBy(desc(m.createdAt), desc(m.id)).limit(PER_PAGE).offset((page - 1) * PER_PAGE),
    db.select({ total: count() }).from(m).leftJoin(products, eq(m.productId, products.id)).where(w),
  ]);
  const orderIds = [...new Set(rows.map((r) => r.orderId).filter((x): x is number => !!x))];
  const orderNos = new Map((orderIds.length ? await db.select({ id: orders.id, number: orders.number }).from(orders).where(inArray(orders.id, orderIds)) : []).map((o) => [o.id, o.number]));
  const qs = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ reason: sp.reason, q: sp.q, ...extra }).filter(([, v]) => v) as [string, string][]);
    return p.size ? `?${p}` : '';
  };
  const seeCosts = can(admin.role, 'costs');

  return (
    <div className="space-y-6">
      <PageHeader back={{ href: '/admin/inventory', label: 'Inventory' }} title="Stock history" description="Every change to stock, newest first" />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Segmented current={sp.reason ?? 'all'} items={[['all', 'All'], ['SALE', 'Sales'], ['RESTOCK', 'Restocks'], ['CANCEL', 'Cancellations'], ['RETURN', 'Returns'], ['DAMAGE', 'Damaged'], ['COUNT', 'Counts'], ['ADJUST', 'Edits']].map(([k, l]) => ({ key: k, label: l, href: `/admin/inventory/movements${qs({ reason: k === 'all' ? undefined : k, page: undefined })}` }))} />
        <form className="flex gap-2">{sp.reason && <input type="hidden" name="reason" value={sp.reason} />}<input name="q" defaultValue={sp.q} placeholder="Product or note" className="ainput w-56" /><button className="abtn abtn-primary">Search</button></form>
      </div>
      <section className="admin-card p-0">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead><tr><th>When</th><th>Product</th><th>What happened</th><th className="text-right">Change</th><th className="text-right">Stock after</th><th>Details</th><th>By</th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const [label, cls] = REASON[r.reason] ?? [r.reason, 'bg-neutral-100'];
                return (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap text-ink/60" title={fmtDateTime(r.at)}>{timeAgo(r.at)}</td>
                    <td><span className="font-medium">{r.title ?? 'Deleted product'}</span><p className="text-xs text-ink/45">{[r.color, r.size].filter(Boolean).join(' / ') || 'One size'}</p></td>
                    <td><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span></td>
                    <td className={`text-right font-semibold tabular ${r.change > 0 ? 'text-emerald-700' : r.change < 0 ? 'text-red-600' : 'text-ink/50'}`}>{r.change > 0 ? '+' : ''}{r.change}</td>
                    <td className="text-right tabular">{r.balance}</td>
                    <td className="text-xs text-ink/60">
                      {r.orderId && orderNos.get(r.orderId) ? <Link href={`/admin/orders/${r.orderId}`} className="font-medium text-ink hover:underline">{orderNos.get(r.orderId)}</Link> : r.note}
                      {seeCosts && r.unitCost ? <span className="block">at {formatBDT(r.unitCost)} each</span> : null}
                    </td>
                    <td className="text-xs text-ink/60">{r.admin ?? (r.reason === 'SALE' ? 'Website' : '—')}</td>
                  </tr>
                );
              })}
              {!rows.length && <tr><td colSpan={7}><EmptyState icon="history" title="No stock changes yet" /></td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      <div className="flex items-center justify-between text-sm">
        <span className="text-ink/50">{Number(total).toLocaleString()} changes</span>
        <div className="flex gap-2">
          {page > 1 && <Link className="abtn abtn-outline abtn-sm" href={`/admin/inventory/movements${qs({ page: String(page - 1) })}`}>Newer</Link>}
          {page * PER_PAGE < Number(total) && <Link className="abtn abtn-outline abtn-sm" href={`/admin/inventory/movements${qs({ page: String(page + 1) })}`}>Older</Link>}
        </div>
      </div>
    </div>
  );
}
