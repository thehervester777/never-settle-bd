import Link from 'next/link';
import type { StoreSettings } from '@/lib/settings';
import { PaymentChips } from '@/components/cart/CartDrawer';
import { NewsletterForm } from './NewsletterForm';
import { FitText } from './FitText';
import { SplitText } from '@/components/motion/Reveal';

export function Footer({ settings, categories, paymentMethods }: { settings: StoreSettings; categories: { name: string; slug: string }[]; paymentMethods: string[] }) {
  const socials = [
    ['Instagram', settings.instagram], ['Facebook', settings.facebook], ['TikTok', settings.tiktok],
  ].filter(([, url]) => url) as [string, string][];
  const year = new Date().getFullYear();

  return (
    <>
      <section className="bg-accent text-ink">
        <div className="container grid items-end gap-10 py-16 md:grid-cols-2 md:py-24">
          <div>
            <p className="eyebrow mb-4">Join the crew</p>
            <SplitText as="h2" text="First to the drop. Always." className="font-display text-display-md uppercase" />
          </div>
          <div>
            <p className="mb-6 max-w-md text-sm opacity-80">Early access to new releases, restocks and members-only offers. No spam.</p>
            <NewsletterForm />
          </div>
        </div>
      </section>

      <footer className="overflow-hidden bg-ink text-paper">
        <div className="container grid gap-12 pb-10 pt-16 md:grid-cols-12 md:pt-24">
          <div className="md:col-span-5 lg:col-span-4">
            <p className="font-display text-3xl uppercase">NEVER SETTLE</p>
            <p className="mt-4 max-w-sm text-sm text-paper/70">T-shirts, pants, punjabis, kurtas, shoes and wallets for people who keep raising the bar. Designed in Dhaka.</p>
            {socials.length > 0 && (
              <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold uppercase tracking-[0.16em]">
                {socials.map(([label, url]) => <li key={label}><a href={url} target="_blank" rel="noopener" className="link-underline">{label} ↗</a></li>)}
              </ul>
            )}
          </div>
          <div className="md:col-span-3 lg:col-span-2">
            <p className="eyebrow mb-5 text-paper/50">Shop</p>
            <ul className="space-y-3 text-sm">
              <li><Link href="/collections/new-in" className="link-underline">New in</Link></li>
              {categories.map((c) => <li key={c.slug}><Link href={`/collections/${c.slug}`} className="link-underline">{c.name}</Link></li>)}
              <li><Link href="/collections/sale" className="link-underline">Sale</Link></li>
            </ul>
          </div>
          <div className="md:col-span-4 lg:col-span-3">
            <p className="eyebrow mb-5 text-paper/50">Help</p>
            <ul className="space-y-3 text-sm">
              {[['Track your order', '/track'], ['Contact us', '/contact'], ['FAQ', '/faq'], ['Size guide', '/size-guide'], ['About us', '/about'], ['Exchange & returns', '/policies/returns'], ['Privacy policy', '/policies/privacy'], ['Terms of service', '/policies/terms']].map(([l, h]) => (
                <li key={h}><Link href={h} className="link-underline">{l}</Link></li>
              ))}
            </ul>
          </div>
          <div className="md:col-span-4 lg:col-span-3">
            <p className="eyebrow mb-5 text-paper/50">Get in touch</p>
            <ul className="space-y-3 text-sm">
              <li><a href={`tel:${settings.phone.replace(/[^\d+]/g, '')}`} className="link-underline">{settings.phone}</a></li>
              <li><a href={`mailto:${settings.email}`} className="link-underline">{settings.email}</a></li>
              <li className="text-paper/70">{settings.address}</li>
              <li className="text-paper/70">{settings.hours}</li>
            </ul>
          </div>
        </div>

        <div className="container select-none" aria-hidden="true">
          <FitText className="whitespace-nowrap text-center font-display uppercase leading-[0.8]">NEVER SETTLE</FitText>
        </div>

        <div className="container mt-8 flex flex-col-reverse items-start justify-between gap-6 border-t border-paper/15 py-6 text-xs text-paper/60 md:flex-row md:items-center">
          <p>© {year} NEVER SETTLE. All rights reserved.</p>
          <PaymentChips methods={paymentMethods} dark />
        </div>
      </footer>
    </>
  );
}
