import type { Metadata } from 'next';
import { getSettings } from '@/lib/settings';
import { ContactForm } from '@/components/forms/ContactForm';
import { SplitText } from '@/components/motion/Reveal';

export const metadata: Metadata = { title: 'Contact us', description: 'Questions about sizing, an order or an exchange? Message the NEVER SETTLE team.' };

export default async function ContactPage() {
  const s = await getSettings();
  return (
    <section className="container pb-24 pt-10 md:pt-16">
      <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5">
          <p className="eyebrow mb-4 text-muted">We&apos;re here to help</p>
          <SplitText as="h1" text="Contact us" className="font-display text-display-lg uppercase" onMount />
          <p className="mt-6 max-w-md text-muted">Questions about sizing, an order or an exchange? Send a message and we&apos;ll reply within one working day.</p>
          <dl className="mt-10 space-y-6 border-t border-ink/10 pt-8 text-sm">
            <div><dt className="eyebrow mb-2 text-muted">Phone</dt><dd><a href={`tel:${s.phone.replace(/[^\d+]/g, '')}`} className="link-underline">{s.phone}</a></dd></div>
            <div><dt className="eyebrow mb-2 text-muted">Email</dt><dd><a href={`mailto:${s.email}`} className="link-underline">{s.email}</a></dd></div>
            <div><dt className="eyebrow mb-2 text-muted">Address</dt><dd>{s.address}</dd></div>
            <div><dt className="eyebrow mb-2 text-muted">Hours</dt><dd>{s.hours}</dd></div>
          </dl>
        </div>
        <div className="lg:col-span-7"><ContactForm /></div>
      </div>
    </section>
  );
}
