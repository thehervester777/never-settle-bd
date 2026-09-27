import Link from 'next/link';
import { and, desc, eq, like, or, type SQL } from 'drizzle-orm';
import { db, schema } from '@/db';
import { ORDER_STATUSES } from '@/db/schema';
import { formatBDT } from '@/lib/money';
import { StatusBadge } from '@/components/admin/StatusBadge';

export const metadata = { title: 'Orders' };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; page?: string }> }) {
  const sp = await searchParams;
  const { orders } = schema;
  const where: SQL[] = [];
  if (sp.status === 'TO_CONFIRM') {
    // New orders to call and confirm: cash on delivery, or paid online. Skips shoppers who abandoned online payment.
    where.push(eq(orders.status, 'PENDING'), or(eq(orders.paymentMethod, 'COD'), eq(orders.paymentStatus, 'PAID'))!);
  } else if (sp.status && (ORDER_STATUSES as readonly string[]).includes(sp.status)) where.push(eq(orders.status, sp.status as (typeof ORDER_STATUSES)[number]));
  if (sp.q) where.push(or(like(orders.number, `%${sp.q}%`), like(orders.phone, `%${sp.q}%`), like(orders.customerName, `%${sp.q}%`))!);
  const page = Math.max(1, Number(sp.page) || 1);
  const rows = await db.select().from(orders).where(where.length ? and(...where) : undefined).orderBy(desc(orders.createdAt)).limit(51).offset((page - 1) * 50);
  const hasMore = rows.length > 50;

  const qs = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ status: sp.status, q: sp.q, ...extra }).filter(([, v]) => v) as [string, string][]);
    return p.toString() ? `?${p}` : '';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-4xl uppercase">Orders</h1>
        <form className="flex w-full gap-2 sm:w-auto">
          {sp.status && <input type="hidden" name="status" value={sp.status} />}
          <input name="q" defaultValue={sp.q} placeholder="Order no., phone or name" className="field min-w-0 flex-1 bg-white py-2 sm:w-64 sm:flex-none" />
          <button className="btn btn-primary py-2">Search</button>
        </form>
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        <Link href={`/admin/orders${qs({ status: undefined, page: undefined })}`} className={`border px-3 py-1.5 ${!sp.status ? 'border-ink bg-ink text-paper' : 'border-ink/20 bg-white'}`}>All</Link>
        <Link href={`/admin/orders${qs({ status: 'TO_CONFIRM', page: undefined })}`} className={`border px-3 py-1.5 ${sp.status === 'TO_CONFIRM' ? 'border-ink bg-ink text-paper' : 'border-accent bg-accent/40'}`}>To confirm</Link>
        {ORDER_STATUSES.map((s) => (
          <Link key={s} href={`/admin/orders${qs({ status: s, page: undefined })}`} className={`border px-3 py-1.5 capitalize ${sp.status === s ? 'border-ink bg-ink text-paper' : 'border-ink/20 bg-white'}`}>{s.toLowerCase()}</Link>
        ))}
      </div>
      <div className="admin-card overflow-x-auto p-0">
        <table className="admin-table">
          <thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Area</th><th>Status</th><th>Payment</th><th className="text-right">Total</th></tr></thead>
          <tbody>
            {rows.slice(0, 50).map((o) => (
              <tr key={o.id} className="hover:bg-bone/40">
                <td className="whitespace-nowrap"><Link className="font-medium underline" href={`/admin/orders/${o.id}`}>{o.number}</Link></td>
                <td className="whitespace-nowrap text-xs">{o.createdAt.toLocaleString('en-GB', { timeZone: 'Asia/Dhaka', dateStyle: 'medium', timeStyle: 'short' })}</td>
                <td>{o.customerName}<p className="text-xs text-muted">{o.phone}</p></td>
                <td className="text-xs">{o.city}<p className="text-muted">{o.zone === 'inside_dhaka' ? 'Inside Dhaka' : 'Outside Dhaka'}</p></td>
                <td><StatusBadge status={o.status} /></td>
                <td className="text-xs">{o.paymentMethod === 'COD' ? 'COD' : 'Online'}<br /><StatusBadge status={o.paymentStatus} /></td>
                <td className="text-right tabular-nums">{formatBDT(o.total)}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={7} className="py-10 text-center text-muted">No orders found.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex gap-3 text-sm">
        {page > 1 && <Link href={`/admin/orders${qs({ page: String(page - 1) })}`} className="underline">← Newer</Link>}
        {hasMore && <Link href={`/admin/orders${qs({ page: String(page + 1) })}`} className="underline">Older →</Link>}
      </div>
    </div>
  );
}
