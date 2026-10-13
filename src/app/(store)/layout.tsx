import { CartProvider } from '@/components/cart/CartProvider';
import { CartDrawer } from '@/components/cart/CartDrawer';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { getCategories } from '@/lib/catalog';
import { getSettings } from '@/lib/settings';
import type { Metadata } from 'next';
import { Tracking } from '@/components/marketing/Tracking';
import { AttributionCapture } from '@/components/marketing/AttributionCapture';
import { ChatButtons } from '@/components/marketing/ChatButtons';

export const dynamic = 'force-dynamic';

/** Domain verification for Meta Business (needed for ads and the catalog) and Google Search Console. */
export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  const other: Record<string, string> = {};
  if (s.metaDomainVerification) other['facebook-domain-verification'] = s.metaDomainVerification;
  return { verification: { ...(s.googleSiteVerification ? { google: s.googleSiteVerification } : {}), other } };
}

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [categories, settings] = await Promise.all([getCategories().catch(() => []), getSettings()]);
  const cats = categories.map((c) => ({ name: c.name, slug: c.slug }));
  const paymentMethods = settings.paymentLabels.split(',').map((s) => s.trim()).filter(Boolean);
  return (
    <CartProvider>
      {/* First, so the tags are loaded before any page sends its events */}
      <Tracking config={{
        metaPixelId: settings.metaPixelId, tiktokPixelId: settings.tiktokPixelId, ga4Id: settings.ga4Id,
        googleAdsId: settings.googleAdsId, googleAdsPurchaseLabel: settings.googleAdsPurchaseLabel,
      }} />
      <AttributionCapture />
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:bg-ink focus:px-4 focus:py-3 focus:text-paper">Skip to content</a>
      <Header categories={cats} announcements={settings.announcement.split('|').map((s) => s.trim()).filter(Boolean)} />
      <main id="main" className="min-h-[60vh]">{children}</main>
      <Footer settings={settings} categories={cats} paymentMethods={paymentMethods} />
      <CartDrawer freeShippingThreshold={settings.freeShippingThreshold} paymentMethods={paymentMethods} />
      <ChatButtons whatsapp={settings.whatsappNumber} messenger={settings.messengerPage} storeName={process.env.NEXT_PUBLIC_STORE_NAME || 'NEVER SETTLE'} />
    </CartProvider>
  );
}
