import Link from 'next/link';
import { count, desc, inArray, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requirePermission } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { formatBDT } from '@/lib/money';
import { fmtDateTime, timeAgo } from '@/lib/dates';
import { orderWhere, type OrderFilters } from '@/lib/order-filters';
import { OrdersTable } from '@/components/admin/OrdersTable';
import { PageHeader } from '@/components/admin/ui';
import { AdminIcon } from '@/components/admin/AdminIcon';

export const metadata = { title: 'Orders' };
const PER_PAGE = 30;

const TABS: [string | undefined, string][] = [
  [undefined, 'All'], ['TO_CONFIRM', 'To confirm'], ['TO_SHIP', 'To ship'], ['SHIPPED', 'Shipped'], ['DELIVERED', 'Delivered'], ['CANCELLED', 'Cancelled'], ['RETURNED', 'Returned'],
];

export default async function OrdersPage({ searchParams }: { searchParams: Promise<OrderFilters> }) {
  const admin = await requirePermission('orders.view');
  const sp = await searchParams;
  const { orders, orderItems } = schema;
  const page = Math.max(1, Number(sp.page) || 1);
  const where = orderWhere(sp);

  const [rows, [{ total }], statusCounts] = await Promise.all([
    db.select().from(orders).where(where).orderBy(desc(orders.createdAt)).limit(PER_PAGE).offset((page - 1) * PER_PAGE),
    db.select({ total: count() }).from(orders).where(where),
    db.select({ status: orders.status, n: count() }).from(orders).where(orderWhere(sp, { ignoreStatus: true })).groupBy(orders.status),
  ]);
  const itemCounts = rows.length
    ? await db.select({ orderId: orderItems.orderId, n: sql<number>`SUM(${orderItems.quantity})` }).from(orderItems).where(inArray(orderItems.orderId, rows.map((r) => r.id))).groupBy(orderItems.orderId)
    : [];
  const items = new Map(itemCounts.map((c) => [c.orderId, Number(c.n)]));
  const counts = new Map(statusCounts.map((c) => [c.status, Number(c.n)]));
  const tabCount = (k?: string) => k === undefined ? [...counts.values()].reduce((a, b) => a + b, 0)
    : k === 'TO_CONFIRM' ? counts.get('PENDING') ?? 0
      : k === 'TO_SHIP' ? (counts.get('CONFIRMED') ?? 0) + (counts.get('PROCESSING') ?? 0)
        : counts.get(k as never) ?? 0;

  const qs = (extra: Partial<OrderFilters>) => {
    const p = new URLSearchParams(Object.entries({ status: sp.status, q: sp.q, from: sp.from, to: sp.to, pay: sp.pay, ...extra }).filter(([, v]) => v) as [string, string][]);
    return p.size ? `?${p}` : '';
  };
  const pages = Math.max(1, Math.ceil(Number(total) / PER_PAGE));

  return (
    <div>
      <PageHeader
        title="Orders"
        description={`${Number(total).toLocaleString()} order${Number(total) === 1 ? '' : 's'}${sp.q ? ` matching “${sp.q}”` : ''}`}
        actions={<a href={`/admin/orders/export${qs({ page: undefined })}`} className="abtn abtn-outline"><AdminIcon name="download" className="h-4 w-4" /> Export CSV</a>}
      />

      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-black/[0.06] scrollbar-none">
        {TABS.map(([k, label]) => {
          const active = (sp.status ?? undefined) === k;
          return (
            <Link key={label} href={`/admin/orders${qs({ status: k, page: undefined })}`} scroll={false}
              className={`relative flex shrink-0 items-center gap-2 px-3 pb-3 pt-1 text-sm font-medium transition-colors ${active ? 'text-ink' : 'text-ink/50 hover:text-ink'}`}>
              {label}
              <span className={`rounded-full px-1.5 py-0.5 text-[0.65rem] tabular ${active ? 'bg-ink text-white' : 'bg-black/[0.05] text-ink/60'}`}>{tabCount(k)}</span>
              {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-ink" />}
            </Link>
          );
        })}
      </div>

      <form className="mb-4 flex flex-wrap items-end gap-2">
        {sp.status && <input type="hidden" name="status" value={sp.status} />}
        <div className="min-w-[14rem] flex-1"><label className="alabel" htmlFor="q">Search</label><input id="q" name="q" defaultValue={sp.q} placeholder="Order no., phone, name or city" className="ainput" /></div>
        <div><label className="alabel" htmlFor="from">From</label><input id="from" name="from" type="date" defaultValue={sp.from} className="ainput" /></div>
        <div><label className="alabel" htmlFor="to">To</label><input id="to" name="to" type="date" defaultValue={sp.to} className="ainput" /></div>
        <div><label className="alabel" htmlFor="pay">Payment</label>
          <select id="pay" name="pay" defaultValue={sp.pay ?? ''} className="aselect"><option value="">Any</option><option value="UNPAID">Unpaid</option><option value="PAID">Paid</option><option value="REFUNDED">Refunded</option></select>
        </div>
        <button className="abtn abtn-primary">Apply</button>
        {(sp.q || sp.from || sp.to || sp.pay) && <Link href={`/admin/orders${qs({ q: undefined, from: undefined, to: undefined, pay: undefined, page: undefined })}`} className="abtn abtn-ghost">Clear</Link>}
      </form>

      <section className="admin-card p-0">
        <OrdersTable
          canManage={can(admin.role, 'orders.manage')}
          rows={rows.map((o) => ({
            id: o.id, number: o.number, when: fmtDateTime(o.createdAt), ago: timeAgo(o.createdAt), customer: o.customerName, phone: o.phone,
            city: o.city, zone: o.zone === 'inside_dhaka' ? 'Inside Dhaka' : 'Outside Dhaka', items: items.get(o.id) ?? 0,
            status: o.status, payment: o.paymentStatus, total: formatBDT(o.total),
          }))}
        />
      </section>

      {pages > 1 && (
        <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Pages">
          <span className="text-ink/50">Page {page} of {pages}</span>
          <div className="flex gap-2">
            {page > 1 && <Link className="abtn abtn-outline abtn-sm" href={`/admin/orders${qs({ page: String(page - 1) })}`}>Newer</Link>}
            {page < pages && <Link className="abtn abtn-outline abtn-sm" href={`/admin/orders${qs({ page: String(page + 1) })}`}>Older</Link>}
          </div>
        </nav>
      )}
    </div>
  );
}
