import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getSettings } from '@/lib/settings';

type Policy = { title: string; body: (s: { email: string; phone: string }) => string };

/* Starting templates. Have them reviewed for your business before launch. */
const POLICIES: Record<string, Policy> = {
  returns: {
    title: 'Exchange & returns',
    body: (s) => `
      <p>You can exchange any item within <strong>7 days of delivery</strong> if it is unworn, unwashed and has its original tags attached.</p>
      <h2>How to request an exchange</h2>
      <ol><li>Contact us at ${s.phone} or ${s.email} with your order number.</li><li>We arrange a pickup or tell you where to send the item.</li><li>Once we receive and check it, we send the new size or item.</li></ol>
      <h2>Refunds</h2>
      <p>If an item arrives damaged or wrong, we replace it or refund you in full, including delivery. Refunds are sent by bKash, Nagad or bank transfer.</p>
      <h2>Not eligible</h2>
      <p>Items marked final sale, and items that have been worn, washed or altered.</p>`,
  },
  shipping: {
    title: 'Shipping policy',
    body: () => `
      <p>We deliver across Bangladesh through trusted courier partners. We call to confirm every order before dispatch.</p>
      <ul><li>Inside Dhaka: 1–2 working days</li><li>Outside Dhaka: 2–4 working days</li></ul>
      <p>Delivery fees are shown at checkout before you place your order.</p>`,
  },
  privacy: {
    title: 'Privacy policy',
    body: (s) => `
      <p>We collect only what we need to deliver your order: your name, phone number, delivery address and, if you give it, your email.</p>
      <p>We share your delivery details only with our courier partner for that order. We do not sell your data.</p>
      <p>To see or delete the information we hold about you, contact ${s.email}.</p>`,
  },
  terms: {
    title: 'Terms of service',
    body: () => `
      <p>By placing an order you agree to these terms. Prices are in Bangladeshi Taka (BDT) and include VAT where applicable.</p>
      <p>We confirm every order by phone. We may cancel an order if an item is out of stock or we cannot reach you; any payment is refunded in full.</p>
      <p>Colours may look slightly different on screen than in person.</p>`,
  },
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = POLICIES[(await params).slug];
  return p ? { title: p.title } : {};
}

export default async function PolicyPage({ params }: { params: Promise<{ slug: string }> }) {
  const p = POLICIES[(await params).slug];
  if (!p) notFound();
  const s = await getSettings();
  return (
    <section className="container max-w-3xl pb-24 pt-10 md:pt-16">
      <h1 className="font-display text-display-md uppercase">{p.title}</h1>
      <div className="rte mt-10" dangerouslySetInnerHTML={{ __html: p.body(s) }} />
    </section>
  );
}
