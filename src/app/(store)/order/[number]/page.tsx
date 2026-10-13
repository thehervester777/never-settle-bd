import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getOrderByNumber, verifyOrderToken } from '@/lib/orders';
import { formatBDT } from '@/lib/money';
import { ClearCartOnMount } from '@/components/cart/ClearCartOnMount';
import { SplitText } from '@/components/motion/Reveal';
import { Icon } from '@/components/ui/Icon';

export const metadata: Metadata = { title: 'Order confirmed', robots: { index: false } };

const STATUS_TEXT: Record<string, string> = {
  PENDING: 'Received — we will call you to confirm',
  CONFIRMED: 'Confirmed — being prepared',
  PROCESSING: 'Being packed',
  SHIPPED: 'On the way',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  RETURNED: 'Returned',
};

export default async function OrderPage({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<{ t?: string }> }) {
  const { number } = await params;
  const { t } = await searchParams;
  if (!verifyOrderToken(number, t)) notFound();
  const order = await getOrderByNumber(number);
  if (!order) notFound();
  const isPaid = order.paymentStatus === 'PAID';

  return (
    <section className="container max-w-4xl pb-24 pt-12 md:pt-16">
      <ClearCartOnMount />
      <p className="eyebrow mb-4 inline-flex items-center gap-2 text-muted"><Icon name="check" className="h-4 w-4 text-ink" /> Order {order.number}</p>
      <SplitText as="h1" text={'Order placed.\nThank you!'} className="font-display text-display-lg uppercase" onMount />
      <p className="mt-6 max-w-xl text-muted">
        We&apos;ll call {order.phone} to confirm before we dispatch. Keep {formatBDT(order.total)} ready for the courier.
      </p>

      <div className="mt-12 grid gap-10 md:grid-cols-5">
        <div className="md:col-span-3">
          <h2 className="eyebrow mb-4">Items</h2>
          <ul className="divide-y divide-ink/10 border-y border-ink/10">
            {order.items.map((it) => (
              <li key={it.id} className="flex gap-4 py-4 text-sm">
                <span className="relative block w-16 shrink-0 overflow-hidden bg-bone" style={{ aspectRatio: '4 / 5' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {it.image && <img src={it.image} alt="" className="absolute inset-0 h-full w-full object-cover" />}
                </span>
                <span className="flex-1"><span className="block font-medium">{it.title}</span><span className="text-xs text-muted">{it.options}{it.options ? ' · ' : ''}Qty {it.quantity}</span></span>
                <span className="font-semibold">{formatBDT(it.unitPrice * it.quantity)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatBDT(order.subtotal)}</dd></div>
            <div className="flex justify-between"><dt>Delivery</dt><dd>{order.shippingFee ? formatBDT(order.shippingFee) : 'Free'}</dd></div>
            <div className="flex justify-between border-t border-ink pt-3 text-base font-semibold"><dt>Total</dt><dd>{formatBDT(order.total)}</dd></div>
          </dl>
        </div>
        <aside className="space-y-6 text-sm md:col-span-2">
          <div className="bg-bone p-5">
            <h2 className="eyebrow mb-2">Status</h2>
            <p className="font-semibold">{STATUS_TEXT[order.status]}</p>
            <p className="mt-1 text-muted">Payment: Cash on delivery · {isPaid ? 'Paid' : 'Unpaid'}</p>
          </div>
          <div className="bg-bone p-5">
            <h2 className="eyebrow mb-2">Delivering to</h2>
            <p>{order.customerName}<br />{order.address}<br />{[order.area, order.city].filter(Boolean).join(', ')}<br />{order.phone}</p>
          </div>
          <Link href="/track" className="link-underline text-xs font-semibold uppercase tracking-[0.18em]">Track this order later</Link>
        </aside>
      </div>
      <Link href="/collections/all" className="btn btn-primary mt-12">Continue shopping <Icon name="arrow-right" className="h-4 w-4" /></Link>
    </section>
  );
}
