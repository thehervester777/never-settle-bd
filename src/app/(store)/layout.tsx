import { CartProvider } from '@/components/cart/CartProvider';
import { CartDrawer } from '@/components/cart/CartDrawer';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { getCategories } from '@/lib/catalog';
import { getSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [categories, settings] = await Promise.all([getCategories().catch(() => []), getSettings()]);
  const cats = categories.map((c) => ({ name: c.name, slug: c.slug }));
  const paymentMethods = settings.paymentLabels.split(',').map((s) => s.trim()).filter(Boolean);
  return (
    <CartProvider>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:bg-ink focus:px-4 focus:py-3 focus:text-paper">Skip to content</a>
      <Header categories={cats} announcements={settings.announcement.split('|').map((s) => s.trim()).filter(Boolean)} />
      <main id="main" className="min-h-[60vh]">{children}</main>
      <Footer settings={settings} categories={cats} paymentMethods={paymentMethods} />
      <CartDrawer freeShippingThreshold={settings.freeShippingThreshold} paymentMethods={paymentMethods} />
    </CartProvider>
  );
}
