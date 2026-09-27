import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { trackSchema } from '@/lib/validation';
import { orderToken } from '@/lib/orders';
import { SplitText } from '@/components/motion/Reveal';

export const metadata: Metadata = { title: 'Track your order' };

async function track(formData: FormData) {
  'use server';
  const parsed = trackSchema.safeParse({ number: formData.get('number'), phone: formData.get('phone') });
  if (!parsed.success) redirect('/track?e=format');
  const number = parsed.data.number.replace(/^NS-?/, 'NS-');
  const [o] = await db.select({ number: schema.orders.number }).from(schema.orders)
    .where(and(eq(schema.orders.number, number), eq(schema.orders.phone, parsed.data.phone))).limit(1);
  if (!o) redirect('/track?e=notfound');
  redirect(`/order/${o.number}?t=${orderToken(o.number)}`);
}

export default async function TrackPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams;
  return (
    <section className="container flex min-h-[70vh] items-center justify-center py-16">
      <div className="w-full max-w-md">
        <SplitText as="h1" text="Track your order" className="font-display text-display-md uppercase" onMount />
        <p className="mt-3 text-sm text-muted">Enter the order number from your confirmation (e.g. NS-10001) and the mobile number you ordered with.</p>
        {e && <p className="mt-6 bg-sale/10 p-3 text-sm text-sale" role="alert">{e === 'notfound' ? "We couldn't find an order with that number and phone." : 'Check the order number and phone number format.'}</p>}
        <form action={track} className="mt-8 space-y-4">
          <div><label htmlFor="number" className="label">Order number</label><input id="number" name="number" required className="field" placeholder="NS-10001" /></div>
          <div><label htmlFor="phone" className="label">Mobile number</label><input id="phone" name="phone" required type="tel" className="field" placeholder="01XXXXXXXXX" /></div>
          <button className="btn btn-primary w-full">Find my order</button>
        </form>
      </div>
    </section>
  );
}
