import Link from 'next/link';
import { notFound } from 'next/navigation';
import { desc, eq, inArray, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requirePermission } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { formatBDT } from '@/lib/money';
import { fmtDate, fmtDateTime, timeAgo } from '@/lib/dates';
import { Card, PageHeader } from '@/components/admin/ui';
import { StatTile } from '@/components/admin/StatTile';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { BarList } from '@/components/admin/charts';
import { AdminIcon } from '@/components/admin/AdminIcon';

export const metadata = { title: 'Customer' };

export default async function CustomerProfile({ params }: { params: Promise<{ phone: string }> }) {
  const admin = await requirePermission('customers');
  const phone = decodeURIComponent((await params).phone);
  const orders = await db.select().from(schema.orders).where(eq(schema.orders.phone, phone)).orderBy(desc(schema.orders.createdAt)).limit(200);
  if (!orders.length) notFound();
  const seeSales = can(admin.role, 'sales');
  const live = orders.filter((o) => o.status !== 'CANCELLED' && o.status !== 'RETURNED');
  const spent = live.reduce((s, o) => s + o.total, 0);
  const latest = orders[0];
  const favourites = await db
    .select({ title: schema.orderItems.title, units: sql<number>`SUM(${schema.orderItems.quantity})` })
    .from(schema.orderItems).where(inArray(schema.orderItems.orderId, live.map((o) => o.id).concat(0)))
    .groupBy(schema.orderItems.title).orderBy(sql`2 DESC`).limit(5);
  const addresses = [...new Map(orders.map((o) => [`${o.address}|${o.city}`, o])).values()].slice(0, 3);

  return (
    <div className="space-y-6">
      <PageHeader back={{ href: '/admin/customers', label: 'Customers' }} title={latest.customerName} description={`Customer since ${fmtDate(orders[orders.length - 1].createdAt)}`} />
      <div className={`grid gap-4 sm:grid-cols-2 ${seeSales ? 'xl:grid-cols-4' : 'xl:grid-cols-3'}`}>
        <StatTile label="Orders" value={orders.length} hint={`${live.length} completed or open`} icon="orders" />
        {seeSales && <StatTile tone="accent" label="Lifetime value" value={spent} format="bdt" icon="sparkle" />}
        {seeSales && <StatTile label="Average order" value={live.length ? spent / live.length : 0} format="bdt" icon="cash" />}
        <StatTile label="Cancelled or returned" value={orders.length - live.length} hint={orders.length - live.length ? 'Check before confirming new orders' : 'Reliable customer'} icon="alert" />
      </div>
      <div className="grid gap-6 xl:grid-cols-3 [&>*]:min-w-0">
        <Card className="xl:col-span-2" padded={false} title="Order history">
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead><tr><th>Order</th><th>Date</th><th>Status</th><th>Payment</th><th className="text-right">Total</th></tr></thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>{can(admin.role, 'orders.view') ? <Link href={`/admin/orders/${o.id}`} className="font-semibold hover:underline">{o.number}</Link> : o.number}</td>
                    <td className="whitespace-nowrap text-ink/60" title={fmtDateTime(o.createdAt)}>{timeAgo(o.createdAt)}</td>
                    <td><StatusBadge status={o.status} /></td>
                    <td><StatusBadge status={o.paymentStatus} /></td>
                    <td className="text-right font-medium tabular">{formatBDT(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <div className="space-y-6">
          <Card title="Contact">
            <ul className="space-y-2.5 text-sm">
              <li className="flex gap-2.5"><AdminIcon name="phone" className="mt-0.5 h-4 w-4 text-ink/40" /><a className="hover:underline" href={`tel:${phone}`}>{phone}</a></li>
              {latest.email && <li className="flex gap-2.5"><AdminIcon name="mail" className="mt-0.5 h-4 w-4 text-ink/40" /><a className="break-all hover:underline" href={`mailto:${latest.email}`}>{latest.email}</a></li>}
              {addresses.map((a) => <li key={a.id} className="flex gap-2.5"><AdminIcon name="pin" className="mt-0.5 h-4 w-4 shrink-0 text-ink/40" /><span>{a.address}, {[a.area, a.city].filter(Boolean).join(', ')}</span></li>)}
            </ul>
          </Card>
          <Card title="Favourite products">
            <BarList format="int" rows={favourites.map((f) => ({ label: f.title, value: Number(f.units), sub: 'units' }))} empty="No completed orders yet." />
          </Card>
        </div>
      </div>
    </div>
  );
}
