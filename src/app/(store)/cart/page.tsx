'use client';

import Link from 'next/link';
import { useCart } from '@/components/cart/CartProvider';
import { QtyControl } from '@/components/cart/CartDrawer';
import { Icon } from '@/components/ui/Icon';
import { formatBDT } from '@/lib/money';

export default function CartPage() {
  const { lines, subtotal, setQty, remove, ready } = useCart();
  if (!ready) return <div className="container py-24" />;
  return (
    <section className="container pb-24 pt-10 md:pt-16">
      <h1 className="mb-10 font-display text-display-lg uppercase">Your cart</h1>
      {lines.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-muted">Nothing here yet. Go make some moves.</p>
          <Link href="/collections/all" className="btn btn-primary mt-8">Continue shopping</Link>
        </div>
      ) : (
        <div className="grid gap-12 lg:grid-cols-12">
          <ul className="divide-y divide-ink/10 border-y border-ink/10 lg:col-span-8">
            {lines.map((l) => (
              <li key={l.variantId} className="flex gap-4 py-5">
                <Link href={`/products/${l.slug}`} className="relative block w-24 shrink-0 overflow-hidden bg-bone md:w-32" style={{ aspectRatio: '4 / 5' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {l.image && <img src={l.image} alt={l.title} className="absolute inset-0 h-full w-full object-cover" />}
                </Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div><Link href={`/products/${l.slug}`} className="text-sm font-medium hover:underline">{l.title}</Link>{l.options && <p className="mt-1 text-xs text-muted">{l.options}</p>}<p className="mt-1 text-xs text-muted">{formatBDT(l.price)} each</p></div>
                    <p className="text-sm font-semibold">{formatBDT(l.price * l.quantity)}</p>
                  </div>
                  <div className="mt-auto flex items-center justify-between pt-3">
                    <QtyControl value={l.quantity} max={l.maxQty} onChange={(q) => setQty(l.variantId, q)} />
                    <button className="link-underline text-xs text-muted hover:text-ink" onClick={() => remove(l.variantId)}>Remove</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <aside className="lg:col-span-4">
            <div className="bg-bone p-6 lg:sticky lg:top-24">
              <div className="flex items-baseline justify-between"><span className="text-xs font-semibold uppercase tracking-[0.18em]">Subtotal</span><span className="text-xl font-semibold">{formatBDT(subtotal)}</span></div>
              <p className="mt-1 text-xs text-muted">Delivery calculated at checkout</p>
              <Link href="/checkout" className="btn btn-primary mt-6 w-full py-5">Checkout <Icon name="arrow-right" className="h-4 w-4" /></Link>
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}
