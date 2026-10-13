import type { Metadata } from 'next';
import { asc, inArray } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requirePermission } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { formatBDT } from '@/lib/money';
import { fmtDate } from '@/lib/dates';
import { logActivity } from '@/lib/activity';
import { PrintButton } from '@/components/admin/PrintButton';

export const metadata: Metadata = { title: 'Print', robots: { index: false } };
export const dynamic = 'force-dynamic';

/** Invoices (doc=invoice) or packing slips (doc=slip) for one or many orders: /admin/print?ids=1,2,3 */
export default async function PrintPage({ searchParams }: { searchParams: Promise<{ ids?: string; doc?: string }> }) {
  const admin = await requirePermission('invoices');
  const sp = await searchParams;
  const slip = sp.doc === 'slip';
  const ids = [...new Set((sp.ids ?? '').split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 100);
  const settings = await getSettings();
  const orders = ids.length ? await db.select().from(schema.orders).where(inArray(schema.orders.id, ids)).orderBy(asc(schema.orders.id)) : [];
  const items = orders.length ? await db.select().from(schema.orderItems).where(inArray(schema.orderItems.orderId, orders.map((o) => o.id))).orderBy(asc(schema.orderItems.id)) : [];
  if (orders.length) await logActivity(admin, slip ? 'print.slip' : 'print.invoice', 'order', orders.length === 1 ? orders[0].number : null, `Printed ${slip ? 'packing slip' : 'invoice'}${orders.length > 1 ? `s for ${orders.length} orders` : ` ${orders[0].number}`}`);

  return (
    <div className="min-h-screen bg-[#e9e9e5] print:bg-white">
      <style>{'@page { size: A4; margin: 12mm; } @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }'}</style>
      <div className="no-print sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-black/10 bg-white/90 px-6 py-3 backdrop-blur">
        <p className="text-sm text-ink/60">{orders.length} {slip ? 'packing slip' : 'invoice'}{orders.length === 1 ? '' : 's'} ready</p>
        <div className="flex gap-2">
          <a href={`/admin/print?ids=${ids.join(',')}${slip ? '' : '&doc=slip'}`} className="abtn abtn-outline">{slip ? 'Show invoices' : 'Show packing slips'}</a>
          <PrintButton />
        </div>
      </div>

      <div className="mx-auto max-w-[210mm] space-y-6 py-8 print:space-y-0 print:py-0">
        {!orders.length && <p className="rounded-2xl bg-white p-10 text-center text-ink/50">No orders selected.</p>}
        {orders.map((o) => {
          const lines = items.filter((i) => i.orderId === o.id);
          const paid = o.paymentStatus === 'PAID';
          return (
            <article key={o.id} className="relative min-h-[260mm] bg-white p-[14mm] text-[13px] text-ink shadow-xl print:min-h-0 print:p-0 print:shadow-none [&:not(:last-child)]:break-after-page">
              <header className="flex items-start justify-between gap-6 border-b-2 border-ink pb-6">
                <div>
                  <p className="font-display text-4xl uppercase leading-none">Never Settle</p>
                  <p className="mt-3 max-w-[60mm] text-xs leading-relaxed text-ink/60">{settings.address}<br />{settings.phone}<br />{settings.email}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-semibold uppercase tracking-[0.2em]">{slip ? 'Packing slip' : 'Invoice'}</p>
                  <dl className="mt-3 space-y-0.5 text-xs">
                    {!slip && <div className="flex justify-end gap-3"><dt className="text-ink/50">Invoice no.</dt><dd className="font-semibold">INV-{o.number}</dd></div>}
                    <div className="flex justify-end gap-3"><dt className="text-ink/50">Order</dt><dd className="font-semibold">{o.number}</dd></div>
                    <div className="flex justify-end gap-3"><dt className="text-ink/50">Date</dt><dd>{fmtDate(o.createdAt)}</dd></div>
                    <div className="flex justify-end gap-3"><dt className="text-ink/50">Payment</dt><dd>Cash on delivery</dd></div>
                  </dl>
                </div>
              </header>

              <section className="grid grid-cols-2 gap-8 py-6">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink/45">{slip ? 'Deliver to' : 'Bill to'}</p>
                  <p className={`mt-2 font-semibold ${slip ? 'text-lg' : ''}`}>{o.customerName}</p>
                  <p className={slip ? 'text-base' : ''}>{o.phone}</p>
                  {o.email && !slip && <p className="text-ink/60">{o.email}</p>}
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink/45">Delivery address</p>
                  <p className={`mt-2 ${slip ? 'text-base' : ''}`}>{o.address}<br />{[o.area, o.city].filter(Boolean).join(', ')}</p>
                  <p className="mt-1 text-xs text-ink/50">{o.zone === 'inside_dhaka' ? 'Inside Dhaka' : 'Outside Dhaka'}</p>
                </div>
              </section>

              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-y border-ink/20 text-left text-[10px] uppercase tracking-[0.15em] text-ink/50">
                    {slip && <th className="w-8 py-2" />}
                    <th className="py-2">#</th><th className="py-2">Item</th><th className="py-2 text-right">Qty</th>
                    {!slip && <><th className="py-2 text-right">Unit price</th><th className="py-2 text-right">Amount</th></>}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={l.id} className="border-b border-ink/10 align-top">
                      {slip && <td className="py-3"><span className="inline-block h-4 w-4 rounded border-2 border-ink/40" /></td>}
                      <td className="py-3 pr-3 text-ink/50">{i + 1}</td>
                      <td className="py-3 pr-3"><span className="font-medium">{l.title}</span>{l.options && <span className="block text-xs text-ink/55">{l.options}</span>}</td>
                      <td className={`py-3 text-right ${slip ? 'text-base font-semibold' : ''}`}>{l.quantity}</td>
                      {!slip && <><td className="py-3 text-right tabular">{formatBDT(l.unitPrice)}</td><td className="py-3 text-right font-medium tabular">{formatBDT(l.unitPrice * l.quantity)}</td></>}
                    </tr>
                  ))}
                </tbody>
              </table>

              {!slip ? (
                <div className="mt-6 flex items-start justify-between gap-8">
                  <div className={`rotate-[-4deg] rounded-xl border-[3px] px-4 py-2 text-center font-semibold uppercase tracking-[0.2em] ${paid ? 'border-emerald-600 text-emerald-700' : 'border-ink/70 text-ink/80'}`}>
                    {paid ? 'Paid' : o.paymentStatus === 'REFUNDED' ? 'Refunded' : 'Cash on delivery'}
                    {!paid && o.paymentStatus !== 'REFUNDED' && <span className="block text-[10px] tracking-[0.15em]">Collect {formatBDT(o.total)}</span>}
                  </div>
                  <dl className="w-64 space-y-1.5">
                    <div className="flex justify-between"><dt className="text-ink/55">Subtotal</dt><dd className="tabular">{formatBDT(o.subtotal)}</dd></div>
                    <div className="flex justify-between"><dt className="text-ink/55">Delivery</dt><dd className="tabular">{o.shippingFee ? formatBDT(o.shippingFee) : 'Free'}</dd></div>
                    <div className="flex justify-between border-t-2 border-ink pt-2 text-base font-semibold"><dt>Total</dt><dd className="tabular">{formatBDT(o.total)}</dd></div>
                    <div className="flex justify-between text-ink/60"><dt>Paid</dt><dd className="tabular">{formatBDT(paid ? o.total : 0)}</dd></div>
                    <div className="flex justify-between font-semibold"><dt>Amount due</dt><dd className="tabular">{formatBDT(paid || o.paymentStatus === 'REFUNDED' ? 0 : o.total)}</dd></div>
                  </dl>
                </div>
              ) : (
                <div className="mt-6 grid grid-cols-2 gap-6">
                  <div className="rounded-xl border border-ink/20 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink/45">Collect from customer</p>
                    <p className="mt-1 text-2xl font-semibold">{o.paymentStatus === 'PAID' ? 'Already paid' : formatBDT(o.total)}</p>
                  </div>
                  {o.note && <div className="rounded-xl bg-ink/[0.04] p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink/45">Customer note</p><p className="mt-1">{o.note}</p></div>}
                </div>
              )}

              <footer className="mt-10 border-t border-ink/10 pt-4 text-center text-xs text-ink/50">
                {settings.invoiceNote}
              </footer>
            </article>
          );
        })}
      </div>
    </div>
  );
}
