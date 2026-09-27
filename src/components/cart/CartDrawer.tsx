'use client';

import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { useCart } from './CartProvider';
import { Drawer } from '@/components/layout/Header';
import { Icon } from '@/components/ui/Icon';
import { formatBDT } from '@/lib/money';
import { EASE } from '@/components/motion/Reveal';

export function CartDrawer({ freeShippingThreshold, paymentMethods }: { freeShippingThreshold: number; paymentMethods: string[] }) {
  const { lines, isOpen, close, setQty, remove, subtotal, count } = useCart();
  const remaining = freeShippingThreshold - subtotal;
  const pct = freeShippingThreshold > 0 ? Math.min(100, Math.round((subtotal / freeShippingThreshold) * 100)) : 0;

  return (
    <Drawer open={isOpen} onClose={close} side="right" label="Your cart" className="inset-y-0 right-0 w-full max-w-md bg-paper">
      <div className="flex items-center justify-between border-b border-ink/10 px-6 py-5">
        <p className="font-display text-2xl uppercase">Your cart <span className="align-top text-sm">({count})</span></p>
        <button className="-mr-2 p-2" onClick={close} aria-label="Close cart"><Icon name="close" className="h-6 w-6" /></button>
      </div>

      {lines.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <p className="font-display text-4xl uppercase">Your cart is empty</p>
          <p className="mt-3 text-sm text-muted">Nothing here yet. Go make some moves.</p>
          <Link href="/collections/all" onClick={close} className="btn btn-primary mt-8">Continue shopping</Link>
        </div>
      ) : (
        <>
          {freeShippingThreshold > 0 && (
            <div className="border-b border-ink/10 px-6 py-4">
              <p className="mb-2.5 text-xs">
                {remaining > 0 ? <>You&apos;re {formatBDT(remaining)} away from free delivery</> : <span className="font-semibold">You&apos;ve unlocked free delivery</span>}
              </p>
              <div className="h-1 w-full overflow-hidden bg-ink/10">
                <motion.div className="h-full bg-ink" initial={false} animate={{ width: `${pct}%` }} transition={{ duration: 0.7, ease: EASE }} />
              </div>
            </div>
          )}
          <ul className="flex-1 divide-y divide-ink/10 overflow-y-auto px-6">
            <AnimatePresence initial={false}>
              {lines.map((l) => (
                <motion.li key={l.variantId} layout initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.4, ease: EASE }} className="flex gap-4 py-5">
                  <Link href={`/products/${l.slug}`} onClick={close} className="relative block w-24 shrink-0 overflow-hidden bg-bone" style={{ aspectRatio: '4 / 5' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {l.image && <img src={l.image} alt={l.title} className="absolute inset-0 h-full w-full object-cover" />}
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link href={`/products/${l.slug}`} onClick={close} className="text-sm font-medium leading-snug hover:underline">{l.title}</Link>
                        {l.options && <p className="mt-1 text-xs text-muted">{l.options}</p>}
                      </div>
                      <p className="text-right text-sm font-semibold">{formatBDT(l.price * l.quantity)}</p>
                    </div>
                    <div className="mt-auto flex items-center justify-between pt-3">
                      <QtyControl value={l.quantity} max={l.maxQty} onChange={(q) => setQty(l.variantId, q)} />
                      <button className="link-underline text-xs text-muted hover:text-ink" onClick={() => remove(l.variantId)}>Remove</button>
                    </div>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          <div className="border-t border-ink/10 px-6 pb-6 pt-5">
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-semibold uppercase tracking-[0.18em]">Subtotal</span>
              <span className="text-lg font-semibold">{formatBDT(subtotal)}</span>
            </div>
            <p className="mt-1 text-xs text-muted">Delivery calculated at checkout</p>
            <div className="mt-5 grid gap-2">
              <Link href="/checkout" onClick={close} className="btn btn-primary w-full py-5">Checkout <Icon name="arrow-right" className="h-4 w-4" /></Link>
              <Link href="/cart" onClick={close} className="py-2 text-center text-xs font-semibold uppercase tracking-[0.18em] hover:underline">View cart</Link>
            </div>
            <PaymentChips methods={paymentMethods} className="mt-3 justify-center" />
          </div>
        </>
      )}
    </Drawer>
  );
}

export function QtyControl({ value, max, onChange }: { value: number; max: number; onChange: (n: number) => void }) {
  return (
    <div className="inline-flex items-center border border-ink/20">
      <button type="button" className="grid h-9 w-9 place-items-center" onClick={() => onChange(value - 1)} aria-label="Decrease quantity"><Icon name="minus" className="h-3.5 w-3.5" /></button>
      <span className="w-8 text-center text-sm tabular-nums" aria-live="polite">{value}</span>
      <button type="button" className="grid h-9 w-9 place-items-center disabled:opacity-30" disabled={value >= max} onClick={() => onChange(value + 1)} aria-label="Increase quantity"><Icon name="plus" className="h-3.5 w-3.5" /></button>
    </div>
  );
}

export function PaymentChips({ methods, className = '', dark = false }: { methods: string[]; className?: string; dark?: boolean }) {
  if (!methods.length) return null;
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      <span className={`mr-1 flex items-center gap-1 text-[0.65rem] font-semibold uppercase tracking-[0.16em] ${dark ? 'text-paper/50' : 'text-muted'}`}>
        <Icon name="shield" className="h-3.5 w-3.5" /> We accept
      </span>
      {methods.map((m) => (
        <span key={m} className={`border px-2 py-1 text-[0.7rem] font-semibold ${dark ? 'border-paper/25 text-paper/80' : 'border-ink/15 text-ink/70'}`}>{m}</span>
      ))}
    </div>
  );
}
