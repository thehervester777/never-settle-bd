import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { ORDER_STATUSES, type OrderStatus } from '@/db/schema';
import { requireAdmin } from '@/lib/auth';
import { formatBDT } from '@/lib/money';
import { getOrderById, releaseStock } from '@/lib/orders';
import { StatusBadge } from '@/components/admin/StatusBadge';

export const metadata = { title: 'Order' };

async function updateOrder(formData: FormData) {
  'use server';
  await requireAdmin();
  const id = Number(formData.get('id'));
  const status = String(formData.get('status')) as OrderStatus;
  const paymentStatus = String(formData.get('paymentStatus'));
  if (!ORDER_STATUSES.includes(status)) return;
  const [o] = await db.select().from(schema.orders).where(eq(schema.orders.id, id));
  if (!o) return;
  const update: Partial<typeof schema.orders.$inferInsert> = { status };
  // Admins can mark cash-on-delivery orders paid/refunded; online payments are set by the gateway.
  if (o.paymentMethod === 'COD' && ['UNPAID', 'PAID', 'REFUNDED'].includes(paymentStatus)) update.paymentStatus = paymentStatus as 'UNPAID' | 'PAID' | 'REFUNDED';
  if (o.paymentMethod === 'SSLCOMMERZ' && paymentStatus === 'REFUNDED' && o.paymentStatus === 'PAID') update.paymentStatus = 'REFUNDED';
  await db.update(schema.orders).set(update).where(eq(schema.orders.id, id));
  if (status === 'CANCELLED' || status === 'RETURNED') await releaseStock(id);
  revalidatePath(`/admin/orders/${id}`);
  redirect(`/admin/orders/${id}?saved=1`);
}

export default async function OrderDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const id = Number((await params).id);
  const { saved } = await searchParams;
  const order = Number.isFinite(id) ? await getOrderById(id) : null;
  if (!order) notFound();
  const phone = order.phone;

  return (
    <div className="space-y-6">
      <Link href="/admin/orders" className="text-sm underline">← Orders</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-4xl uppercase">{order.number}</h1>
        <StatusBadge status={order.status} /><StatusBadge status={order.paymentStatus} />
      </div>
      <p className="text-sm text-muted">Placed {order.createdAt.toLocaleString('en-GB', { timeZone: 'Asia/Dhaka', dateStyle: 'full', timeStyle: 'short' })}</p>
      {saved && <p className="bg-emerald-100 p-3 text-sm text-emerald-900">Saved.</p>}

      <div className="grid gap-6 xl:grid-cols-3 [&>*]:min-w-0">
        <div className="space-y-6 xl:col-span-2">
          <section className="admin-card">
            <h2 className="mb-3 font-semibold">Items</h2>
            <div className="overflow-x-auto"><table className="admin-table">
              <thead><tr><th>Product</th><th>Qty</th><th className="text-right">Price</th><th className="text-right">Total</th></tr></thead>
              <tbody>
                {order.items.map((it) => (
                  <tr key={it.id}>
                    <td><div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {it.image && <img src={it.image} alt="" className="h-14 w-11 object-cover" />}
                      <div>{it.title}<p className="text-xs text-muted">{it.options}</p></div>
                    </div></td>
                    <td className="tabular-nums">{it.quantity}</td>
                    <td className="text-right tabular-nums">{formatBDT(it.unitPrice)}</td>
                    <td className="text-right tabular-nums">{formatBDT(it.unitPrice * it.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
            <dl className="ml-auto mt-4 max-w-xs space-y-1 text-sm">
              <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatBDT(order.subtotal)}</dd></div>
              <div className="flex justify-between"><dt>Delivery</dt><dd>{formatBDT(order.shippingFee)}</dd></div>
              <div className="flex justify-between border-t border-ink/10 pt-2 font-semibold"><dt>Total</dt><dd>{formatBDT(order.total)}</dd></div>
            </dl>
          </section>

          {order.payments.length > 0 && (
            <section className="admin-card">
              <h2 className="mb-3 font-semibold">Online payment attempts</h2>
              <div className="overflow-x-auto"><table className="admin-table">
                <thead><tr><th>Transaction</th><th>Status</th><th>Method</th><th>Bank ref.</th><th className="text-right">Amount</th></tr></thead>
                <tbody>
                  {order.payments.map((p) => (
                    <tr key={p.id}><td className="font-mono text-xs">{p.tranId}</td><td><StatusBadge status={p.status} /></td><td className="text-xs">{p.cardType ?? '—'}</td><td className="font-mono text-xs">{p.bankTranId ?? '—'}</td><td className="text-right tabular-nums">{formatBDT(p.amount)}</td></tr>
                  ))}
                </tbody>
              </table></div>
            </section>
          )}
        </div>

        <div className="space-y-6">
          <section className="admin-card">
            <h2 className="mb-3 font-semibold">Update order</h2>
            <form action={updateOrder} className="space-y-4">
              <input type="hidden" name="id" value={order.id} />
              <div>
                <label htmlFor="status" className="label">Order status</label>
                <select id="status" name="status" defaultValue={order.status} className="field-select bg-white">
                  {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
                </select>
                <p className="mt-1 text-xs text-muted">Cancelled or returned puts the items back in stock.</p>
              </div>
              <div>
                <label htmlFor="paymentStatus" className="label">Payment</label>
                <select id="paymentStatus" name="paymentStatus" defaultValue={order.paymentStatus} className="field-select bg-white">
                  {(order.paymentMethod === 'COD' ? ['UNPAID', 'PAID', 'REFUNDED'] : [order.paymentStatus, ...(order.paymentStatus === 'PAID' ? ['REFUNDED'] : [])]).map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
                </select>
                {order.paymentMethod === 'SSLCOMMERZ' && <p className="mt-1 text-xs text-muted">Online payments are confirmed by SSLCOMMERZ. Issue refunds from your SSLCOMMERZ merchant panel, then mark refunded here.</p>}
              </div>
              <button className="btn btn-primary w-full">Save</button>
            </form>
          </section>
          <section className="admin-card text-sm">
            <h2 className="mb-3 font-semibold">Customer</h2>
            <p className="font-medium">{order.customerName}</p>
            <p><a href={`tel:${phone}`} className="underline">{phone}</a></p>
            {order.email && <p><a href={`mailto:${order.email}`} className="underline">{order.email}</a></p>}
            <h3 className="mb-1 mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-muted">Delivery</h3>
            <p>{order.address}<br />{[order.area, order.city].filter(Boolean).join(', ')}<br />{order.zone === 'inside_dhaka' ? 'Inside Dhaka' : 'Outside Dhaka'}</p>
            {order.note && <><h3 className="mb-1 mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-muted">Note</h3><p>{order.note}</p></>}
            <h3 className="mb-1 mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-muted">Payment method</h3>
            <p>{order.paymentMethod === 'COD' ? 'Cash on delivery' : 'Online (SSLCOMMERZ)'}</p>
          </section>
        </div>
      </div>
    </div>
  );
}
