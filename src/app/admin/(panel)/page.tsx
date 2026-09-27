import Link from 'next/link';
import { and, count, desc, eq, gte, lte, ne, or, sql, sum } from 'drizzle-orm';
import { db, schema } from '@/db';
import { formatBDT } from '@/lib/money';
import { StatusBadge } from '@/components/admin/StatusBadge';

export const metadata = { title: 'Dashboard' };

export default async function Dashboard() {
  const { orders, variants, products, messages } = schema;
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  // A "real" order is cash on delivery, or an online order that has actually been paid.
  // Unpaid online orders are shoppers who left the payment page; they don't count as sales.
  const real = or(eq(orders.paymentMethod, 'COD'), eq(orders.paymentStatus, 'PAID'));

  const [[rev], [todayCount], [pending], [unread], recent, lowStock] = await Promise.all([
    db.select({ total: sum(orders.total), n: count() }).from(orders).where(and(gte(orders.createdAt, since), ne(orders.status, 'CANCELLED'), ne(orders.status, 'RETURNED'), real)),
    db.select({ n: count() }).from(orders).where(and(gte(orders.createdAt, today), real)),
    db.select({ n: count() }).from(orders).where(and(eq(orders.status, 'PENDING'), real)),
    db.select({ n: count() }).from(messages).where(eq(messages.isRead, false)),
    db.select().from(orders).orderBy(desc(orders.createdAt)).limit(8),
    db.select({ id: variants.id, stock: variants.stock, color: variants.color, size: variants.size, title: products.title, productId: products.id })
      .from(variants).innerJoin(products, eq(variants.productId, products.id))
      .where(and(lte(variants.stock, 3), eq(products.isActive, true))).orderBy(variants.stock).limit(10),
  ]);

  const stats = [
    ['Sales, last 30 days', formatBDT(Number(rev.total ?? 0)), `${rev.n} ${Number(rev.n) === 1 ? 'order' : 'orders'}`],
    ['Orders today', String(todayCount.n), ''],
    ['Waiting for confirmation', String(pending.n), 'Call these customers', '/admin/orders?status=TO_CONFIRM'],
    ['Unread messages', String(unread.n), '', '/admin/messages'],
  ];

  return (
    <div className="space-y-8">
      <h1 className="font-display text-4xl uppercase">Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(([label, value, sub, href]) => {
          const inner = (<><p className="text-xs uppercase tracking-[0.14em] text-muted">{label}</p><p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>{sub && <p className="mt-1 text-xs text-muted">{sub}</p>}</>);
          return href ? <Link key={label} href={href} className="admin-card hover:border-ink">{inner}</Link> : <div key={label} className="admin-card">{inner}</div>;
        })}
      </div>
      <div className="grid gap-6 xl:grid-cols-3 [&>*]:min-w-0">
        <section className="admin-card xl:col-span-2">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Recent orders</h2><Link href="/admin/orders" className="text-sm underline">All orders</Link></div>
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead><tr><th>Order</th><th>Customer</th><th>Status</th><th>Payment</th><th className="text-right">Total</th></tr></thead>
              <tbody>
                {recent.map((o) => (
                  <tr key={o.id}>
                    <td className="whitespace-nowrap"><Link className="font-medium underline" href={`/admin/orders/${o.id}`}>{o.number}</Link><p className="text-xs text-muted">{o.createdAt.toLocaleString('en-GB', { timeZone: 'Asia/Dhaka' })}</p></td>
                    <td>{o.customerName}<p className="text-xs text-muted">{o.phone}</p></td>
                    <td><StatusBadge status={o.status} /></td>
                    <td className="text-xs">COD · <StatusBadge status={o.paymentStatus} /></td>
                    <td className="text-right tabular-nums">{formatBDT(o.total)}</td>
                  </tr>
                ))}
                {!recent.length && <tr><td colSpan={5} className="py-8 text-center text-muted">No orders yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
        <section className="admin-card">
          <h2 className="mb-3 font-semibold">Low stock (3 or fewer)</h2>
          <ul className="divide-y divide-ink/5 text-sm">
            {lowStock.map((v) => (
              <li key={v.id} className="flex justify-between gap-3 py-2">
                <Link href={`/admin/products/${v.productId}`} className="underline">{v.title}<span className="text-muted"> {[v.color, v.size].filter(Boolean).join(' / ')}</span></Link>
                <span className={`tabular-nums ${v.stock === 0 ? 'text-sale' : ''}`}>{v.stock}</span>
              </li>
            ))}
            {!lowStock.length && <li className="py-4 text-muted">Everything is well stocked.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
