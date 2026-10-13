import Link from 'next/link';
import { notFound } from 'next/navigation';
import { count, eq, inArray, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requirePermission } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { formatBDT } from '@/lib/money';
import { fmtDateTime, timeAgo } from '@/lib/dates';
import { getOrderById } from '@/lib/orders';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { Card, PageHeader } from '@/components/admin/ui';
import { AdminIcon } from '@/components/admin/AdminIcon';
import { OrderNoteForm, OrderStatusActions, OrderStepper } from '@/components/admin/OrderActions';
import { mediumLabel, parseAttribution, sourceLabel } from '@/lib/attribution';

export const metadata = { title: 'Order' };

const EVENT_ICON: Record<string, string> = { CREATED: 'orders', STATUS: 'refresh', PAYMENT: 'cash', NOTE: 'note' };

export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requirePermission('orders.view');
  const id = Number((await params).id);
  const order = Number.isFinite(id) ? await getOrderById(id) : null;
  if (!order) notFound();
  const seeCosts = can(admin.role, 'costs'), canManage = can(admin.role, 'orders.manage');

  const variantIds = order.items.map((i) => i.variantId).filter((v): v is number => !!v);
  const [[history], currentCosts] = await Promise.all([
    db.select({ n: count(), spent: sql<number>`COALESCE(SUM(CASE WHEN ${schema.orders.status} NOT IN ('CANCELLED', 'RETURNED') THEN ${schema.orders.total} END), 0)` })
      .from(schema.orders).where(eq(schema.orders.phone, order.phone)),
    seeCosts && variantIds.length ? db.select({ id: schema.variants.id, cost: schema.variants.cost }).from(schema.variants).where(inArray(schema.variants.id, variantIds)) : Promise.resolve([]),
  ]);
  const costOf = new Map(currentCosts.map((c) => [c.id, c.cost]));
  const lineCost = (it: (typeof order.items)[number]) => (it.unitCost || (it.variantId ? costOf.get(it.variantId) ?? 0 : 0)) * it.quantity;
  const cogs = order.items.reduce((s, it) => s + lineCost(it), 0);
  const profit = order.subtotal - order.discount - cogs;
  const netSales = order.subtotal - order.discount;
  const attr = parseAttribution(order.attribution);
  const clicks = [attr?.fbclid && 'Facebook / Instagram ad click', (attr?.gclid || attr?.wbraid || attr?.gbraid) && 'Google ad click', attr?.ttclid && 'TikTok ad click'].filter(Boolean) as string[];
  const sourceRows: [string, React.ReactNode][] = [
    ['Campaign', order.campaign], ['Ad / post', attr?.ct], ['Keyword', attr?.t], ['Discount code', order.couponCode],
    ['Landing page', attr?.land], ['Referred by', attr?.ref], ['Ad click', clicks.join(', ')],
    ['First visit', attr?.ts ? fmtDateTime(new Date(attr.ts)) : null],
  ].filter(([, v]) => v) as [string, React.ReactNode][];

  return (
    <div>
      <PageHeader
        back={{ href: '/admin/orders', label: 'Orders' }}
        title={order.number}
        description={<span className="inline-flex flex-wrap items-center gap-2">Placed {fmtDateTime(order.createdAt)} <StatusBadge status={order.status} /> <StatusBadge status={order.paymentStatus} /></span>}
        actions={(
          <>
            <a href={`/admin/print?ids=${order.id}&doc=slip`} target="_blank" className="abtn abtn-outline"><AdminIcon name="box" className="h-4 w-4" /> Packing slip</a>
            <a href={`/admin/print?ids=${order.id}`} target="_blank" className="abtn abtn-primary"><AdminIcon name="print" className="h-4 w-4" /> Invoice</a>
          </>
        )}
      />

      {(order.status === 'CANCELLED' || order.status === 'RETURNED') ? (
        <div className="mb-6 flex items-center gap-3 rounded-2xl bg-neutral-100 p-4 text-sm text-neutral-700">
          <AdminIcon name="alert" className="h-5 w-5" /> This order was {order.status.toLowerCase()}. Its items are back in stock.
        </div>
      ) : (
        <div className="admin-card mb-6"><OrderStepper status={order.status} /></div>
      )}

      <div className="grid gap-6 xl:grid-cols-3 [&>*]:min-w-0">
        <div className="space-y-6 xl:col-span-2">
          <Card title="Items" padded={false}>
            <div className="overflow-x-auto">
              <table className="admin-table">
                <thead><tr><th>Product</th><th className="text-right">Qty</th><th className="text-right">Price</th>{seeCosts && <th className="text-right">Cost</th>}<th className="text-right">Total</th></tr></thead>
                <tbody>
                  {order.items.map((it) => (
                    <tr key={it.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {it.image ? <img src={it.image} alt="" className="h-14 w-11 rounded-lg object-cover" /> : <span className="h-14 w-11 rounded-lg bg-[#f4f4f1]" />}
                          <div>
                            {it.productId && can(admin.role, 'products') ? <Link href={`/admin/products/${it.productId}`} className="font-medium hover:underline">{it.title}</Link> : <span className="font-medium">{it.title}</span>}
                            <p className="text-xs text-ink/45">{it.options || 'One size'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="text-right tabular">{it.quantity}</td>
                      <td className="text-right tabular">{formatBDT(it.unitPrice)}</td>
                      {seeCosts && <td className="text-right tabular text-ink/55">{formatBDT(lineCost(it) / it.quantity)}</td>}
                      <td className="text-right font-medium tabular">{formatBDT(it.unitPrice * it.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap justify-between gap-6 border-t border-black/[0.05] p-5">
              {seeCosts ? (
                <div className="rounded-xl bg-[#f7f7f4] px-4 py-3 text-sm">
                  <p className="text-ink/55">Profit on this order</p>
                  <p className={`text-xl font-semibold ${profit >= 0 ? '' : 'text-red-600'}`}>{formatBDT(profit)}</p>
                  <p className="text-xs text-ink/45">{netSales > 0 ? `${((profit / netSales) * 100).toFixed(1)}% margin on products${order.discount ? ' after discount' : ''}` : ''}</p>
                </div>
              ) : <span />}
              <dl className="w-full max-w-xs space-y-1.5 text-sm">
                <div className="flex justify-between"><dt className="text-ink/55">Subtotal</dt><dd className="tabular">{formatBDT(order.subtotal)}</dd></div>
                {order.discount > 0 && <div className="flex justify-between"><dt className="text-ink/55">Discount{order.couponCode ? ` (${order.couponCode})` : ''}</dt><dd className="tabular text-red-600">−{formatBDT(order.discount)}</dd></div>}
                <div className="flex justify-between"><dt className="text-ink/55">Delivery ({order.zone === 'inside_dhaka' ? 'inside Dhaka' : 'outside Dhaka'})</dt><dd className="tabular">{order.shippingFee ? formatBDT(order.shippingFee) : 'Free'}</dd></div>
                <div className="flex justify-between border-t border-black/[0.06] pt-2 text-base font-semibold"><dt>Total</dt><dd className="tabular">{formatBDT(order.total)}</dd></div>
              </dl>
            </div>
          </Card>

          <Card title="Timeline" description="Everything that happened to this order">
            <ol className="relative space-y-5 border-l border-black/[0.07] pl-6">
              {[...order.events].reverse().map((e) => (
                <li key={e.id} className="relative">
                  <span className="absolute -left-[37px] grid h-7 w-7 place-items-center rounded-full border border-black/[0.06] bg-white text-ink/60 shadow-sm"><AdminIcon name={EVENT_ICON[e.type] ?? 'activity'} className="h-3.5 w-3.5" /></span>
                  <p className={`text-sm ${e.type === 'NOTE' ? 'rounded-xl bg-amber-50 px-3 py-2 text-amber-900' : ''}`}>{e.message}</p>
                  <p className="mt-0.5 text-xs text-ink/40">{e.adminName ?? 'Customer'} · {fmtDateTime(e.createdAt)}{Date.now() - e.createdAt.getTime() < 7 * 86_400_000 ? ` · ${timeAgo(e.createdAt)}` : ''}</p>
                </li>
              ))}
              {!order.events.length && <li className="text-sm text-ink/45">Placed {fmtDateTime(order.createdAt)}. History is recorded from now on.</li>}
            </ol>
            <div className="mt-5"><OrderNoteForm id={order.id} /></div>
          </Card>
        </div>

        <div className="space-y-6">
          {canManage && (
            <Card title="Actions">
              <OrderStatusActions id={order.id} status={order.status} payment={order.paymentStatus} />
            </Card>
          )}
          <Card title="Customer" actions={can(admin.role, 'customers') ? <Link href={`/admin/customers/${encodeURIComponent(order.phone)}`} className="text-xs font-medium text-ink/55 hover:text-ink">Profile</Link> : undefined}>
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-[#f4f4f1] text-sm font-semibold">{order.customerName.split(' ').map((w) => w[0]).slice(0, 2).join('')}</span>
              <div>
                <p className="font-medium">{order.customerName}</p>
                <p className="text-xs text-ink/50">{Number(history.n)} order{Number(history.n) === 1 ? '' : 's'}{can(admin.role, 'sales') ? ` · ${formatBDT(Number(history.spent ?? 0))} lifetime` : ''}</p>
              </div>
            </div>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li className="flex gap-2.5"><AdminIcon name="phone" className="mt-0.5 h-4 w-4 shrink-0 text-ink/40" /><a href={`tel:${order.phone}`} className="hover:underline">{order.phone}</a></li>
              {order.email && <li className="flex gap-2.5"><AdminIcon name="mail" className="mt-0.5 h-4 w-4 shrink-0 text-ink/40" /><a href={`mailto:${order.email}`} className="break-all hover:underline">{order.email}</a></li>}
              <li className="flex gap-2.5"><AdminIcon name="pin" className="mt-0.5 h-4 w-4 shrink-0 text-ink/40" /><span>{order.address}<br />{[order.area, order.city].filter(Boolean).join(', ')}</span></li>
            </ul>
            {order.note && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><span className="font-medium">Customer note:</span> {order.note}</p>}
          </Card>
          <Card title="Source" description="How this shopper found the store" actions={order.source ? <Link href={`/admin/orders?source=${encodeURIComponent(order.source)}`} className="text-xs font-medium text-ink/55 hover:text-ink">Similar orders</Link> : undefined}>
            {order.source ? (
              <>
                <p className="flex items-center gap-2">
                  <span className="rounded-full bg-sky-50 px-2.5 py-1 text-sm font-semibold text-sky-800">{sourceLabel(order.source)}</span>
                  {order.medium && order.medium !== '(none)' && <span className="text-sm text-ink/55">{mediumLabel(order.medium)}</span>}
                </p>
                {sourceRows.length > 0 && (
                  <dl className="mt-4 space-y-2 text-sm">
                    {sourceRows.map(([k, v]) => <div key={k} className="flex justify-between gap-4"><dt className="shrink-0 text-ink/55">{k}</dt><dd className="min-w-0 break-all text-right">{v}</dd></div>)}
                  </dl>
                )}
              </>
            ) : (
              <p className="text-sm text-ink/55">{order.couponCode ? <>Discount code <strong>{order.couponCode}</strong>. </> : null}Not recorded: this order was placed before campaign tracking was added.</p>
            )}
          </Card>
          <Card title="Payment">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-ink/55">Method</dt><dd>Cash on delivery</dd></div>
              <div className="flex justify-between"><dt className="text-ink/55">Status</dt><dd><StatusBadge status={order.paymentStatus} /></dd></div>
              {order.paidAt && <div className="flex justify-between"><dt className="text-ink/55">Received</dt><dd>{fmtDateTime(order.paidAt)}</dd></div>}
              {order.deliveredAt && <div className="flex justify-between"><dt className="text-ink/55">Delivered</dt><dd>{fmtDateTime(order.deliveredAt)}</dd></div>}
              <div className="flex justify-between border-t border-black/[0.06] pt-2 font-semibold"><dt>{order.paymentStatus === 'PAID' ? 'Collected' : 'To collect'}</dt><dd className="tabular">{formatBDT(order.total)}</dd></div>
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
