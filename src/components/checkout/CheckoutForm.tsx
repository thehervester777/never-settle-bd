'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useCart } from '@/components/cart/CartProvider';
import { Icon } from '@/components/ui/Icon';
import { formatBDT } from '@/lib/money';

type Props = {
  shipping: { inside: number; outside: number; freeOver: number };
  codEnabled: boolean;
};

export function CheckoutForm({ shipping, codEnabled }: Props) {
  const router = useRouter();
  const { lines, subtotal, ready, clear } = useCart();
  const [zone, setZone] = useState<'inside_dhaka' | 'outside_dhaka'>('inside_dhaka');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const free = shipping.freeOver > 0 && subtotal >= shipping.freeOver;
  const fee = free ? 0 : zone === 'inside_dhaka' ? shipping.inside : shipping.outside;
  const total = subtotal + fee;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setErrors({});
    setFormError('');
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...f, zone, paymentMethod: 'COD', items: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })) }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setSubmitting(false);
      if (data.errors) setErrors(data.errors);
      setFormError(data.error || (data.errors ? 'Please check the highlighted fields.' : 'Something went wrong. Please try again.'));
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    clear();
    router.push(data.redirect);
  }

  if (!ready) return <div className="container py-24" />;
  if (!lines.length) {
    return (
      <div className="container py-24 text-center">
        <h1 className="font-display text-display-md uppercase">Your cart is empty</h1>
        <Link href="/collections/all" className="btn btn-primary mt-8">Continue shopping</Link>
      </div>
    );
  }

  const field = (name: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label htmlFor={name} className="label">{label}{props.required && <span aria-hidden="true"> *</span>}</label>
      <input id={name} name={name} className={`field ${errors[name] ? 'border-sale' : ''}`} aria-invalid={!!errors[name]} aria-describedby={errors[name] ? `${name}-err` : undefined} {...props} />
      {errors[name] && <p id={`${name}-err`} className="mt-1.5 text-xs text-sale">{errors[name]}</p>}
    </div>
  );

  return (
    <div className="container pb-24 pt-10 md:pt-14">
      <h1 className="font-display text-display-md uppercase">Checkout</h1>
      {formError && <p className="mt-6 max-w-2xl bg-sale/10 p-4 text-sm text-sale" role="alert">{formError}</p>}

      <form onSubmit={onSubmit} className="mt-10 grid gap-12 lg:grid-cols-12" noValidate>
        <div className="space-y-10 lg:col-span-7">
          <section>
            <h2 className="eyebrow mb-5">1. Your details</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">{field('customerName', 'Full name', { required: true, autoComplete: 'name' })}</div>
              {field('phone', 'Mobile number', { required: true, type: 'tel', inputMode: 'tel', autoComplete: 'tel', placeholder: '01XXXXXXXXX' })}
              {field('email', 'Email (for order updates)', { type: 'email', autoComplete: 'email' })}
            </div>
          </section>

          <section>
            <h2 className="eyebrow mb-5">2. Delivery</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {([['inside_dhaka', 'Inside Dhaka', shipping.inside, '1–2 working days'], ['outside_dhaka', 'Outside Dhaka', shipping.outside, '2–4 working days']] as const).map(([v, l, price, eta]) => (
                <label key={v} className={`flex cursor-pointer items-start gap-3 border p-4 transition-colors ${zone === v ? 'border-ink bg-bone/60' : 'border-ink/15 hover:border-ink/40'}`}>
                  <input type="radio" className="radio mt-0.5" name="zoneChoice" checked={zone === v} onChange={() => setZone(v)} />
                  <span className="flex-1">
                    <span className="flex justify-between text-sm font-semibold"><span>{l}</span><span>{free ? 'Free' : formatBDT(price)}</span></span>
                    <span className="mt-1 block text-xs text-muted">{eta}</span>
                  </span>
                </label>
              ))}
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">{field('address', 'Full address (house, road, area)', { required: true, autoComplete: 'street-address' })}</div>
              {/* Keyed wrapper so the default city resets when the delivery zone changes */}
              <div key={zone}>{field('city', 'City / District', { required: true, autoComplete: 'address-level2', defaultValue: zone === 'inside_dhaka' ? 'Dhaka' : '' })}</div>
              {field('area', 'Area / Thana', { autoComplete: 'address-level3' })}
              <div className="sm:col-span-2">
                <label htmlFor="note" className="label">Order note</label>
                <textarea id="note" name="note" rows={3} className="field-area" placeholder="Anything we should know about delivery?" maxLength={500} />
              </div>
            </div>
          </section>

          <section>
            <h2 className="eyebrow mb-5">3. Payment</h2>
            {errors.paymentMethod && <p className="mb-3 text-sm text-sale">{errors.paymentMethod}</p>}
            {codEnabled ? (
              <div className="flex items-start gap-3 border border-ink bg-bone/60 p-4">
                <Icon name="check" className="mt-0.5 h-4 w-4" />
                <span><span className="block text-sm font-semibold">Cash on delivery</span><span className="mt-1 block text-xs text-muted">Pay the courier in cash when your order arrives.</span></span>
              </div>
            ) : (
              <p className="text-sm text-sale">Ordering is paused right now. Please contact us to order.</p>
            )}
          </section>
        </div>

        <aside className="lg:col-span-5">
          <div className="bg-bone p-6 lg:sticky lg:top-24">
            <h2 className="eyebrow mb-4">Order summary</h2>
            <ul className="divide-y divide-ink/10">
              {lines.map((l) => (
                <li key={l.variantId} className="flex gap-3 py-3 text-sm">
                  <span className="relative block w-14 shrink-0 overflow-hidden bg-paper" style={{ aspectRatio: '4 / 5' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {l.image && <img src={l.image} alt="" className="absolute inset-0 h-full w-full object-cover" />}
                    <span className="absolute -right-1 -top-1 grid h-5 min-w-[1.25rem] place-items-center rounded-full bg-ink px-1 text-[0.65rem] text-paper">{l.quantity}</span>
                  </span>
                  <span className="flex-1"><span className="block font-medium">{l.title}</span>{l.options && <span className="text-xs text-muted">{l.options}</span>}</span>
                  <span className="font-semibold">{formatBDT(l.price * l.quantity)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-4 space-y-2 border-t border-ink/10 pt-4 text-sm">
              <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatBDT(subtotal)}</dd></div>
              <div className="flex justify-between"><dt>Delivery</dt><dd>{fee === 0 ? 'Free' : formatBDT(fee)}</dd></div>
              <div className="flex justify-between border-t border-ink pt-3 text-base font-semibold"><dt>Total</dt><dd>{formatBDT(total)}</dd></div>
            </dl>
            <button className="btn btn-primary mt-6 w-full py-5" disabled={submitting || !codEnabled}>
              {submitting ? 'Placing order…' : 'Place order'} {!submitting && <Icon name="arrow-right" className="h-4 w-4" />}
            </button>
            <p className="mt-3 text-center text-xs text-muted">Final prices and stock are confirmed when you place the order.</p>
          </div>
        </aside>
      </form>
    </div>
  );
}
