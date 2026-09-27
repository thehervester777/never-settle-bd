import type { Metadata } from 'next';
import Link from 'next/link';
import { getSettings } from '@/lib/settings';
import { formatBDT } from '@/lib/money';
import { SplitText } from '@/components/motion/Reveal';
import { Accordion } from '@/components/ui/Accordion';

export const metadata: Metadata = { title: 'FAQ', description: 'Delivery times, cash on delivery, exchanges, sizing and care at NEVER SETTLE.' };

export default async function FaqPage() {
  const s = await getSettings();
  const faqs = [
    { q: 'How long does delivery take?', a: 'Inside Dhaka: 1–2 working days. Outside Dhaka: 2–4 working days. We call to confirm your order before dispatch.' },
    { q: 'How much is delivery?', a: `Inside Dhaka ${formatBDT(s.shippingInsideDhaka)}, outside Dhaka ${formatBDT(s.shippingOutsideDhaka)}.${s.freeShippingThreshold ? ` Free on orders over ${formatBDT(s.freeShippingThreshold)}.` : ''}` },
    { q: 'Can I pay cash on delivery?', a: 'Yes. Cash on delivery is available across Bangladesh. Pay the courier in cash when your order arrives.' },
    { q: 'How do exchanges work?', a: 'Exchange any item within 7 days of delivery if it is unworn, unwashed and has its tags attached. Contact us with your order number and we will arrange it.' },
    { q: 'How do I find my size?', a: 'Use our size guide. T-shirts, punjabis and kurtas run true to size, pants use waist sizes, and shoes use EU sizes.' },
    { q: 'Can I change or cancel my order?', a: 'Yes, as long as it has not been handed to the courier. Contact us as soon as possible with your order number.' },
  ];
  const jsonLd = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) };
  return (
    <section className="container pb-20 pt-10 md:pb-28 md:pt-16">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-4">
          <p className="eyebrow mb-4 text-muted">Help centre</p>
          <SplitText as="h1" text="Frequently asked questions" className="font-display text-display-md uppercase" onMount />
          <p className="mt-6 text-muted">Can&apos;t find your answer? We reply within one working day.</p>
          <Link href="/contact" className="btn btn-outline mt-8">Contact us</Link>
        </div>
        <div className="border-t border-ink/15 lg:col-span-8">
          {faqs.map((f, i) => <Accordion key={f.q} title={f.q} defaultOpen={i === 0}><p>{f.a}</p></Accordion>)}
        </div>
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </section>
  );
}
