import type { Metadata, Viewport } from 'next';
import '@fontsource/anton/400.css';
import '@fontsource-variable/inter';
import './globals.css';
import { MotionProvider } from '@/components/motion/MotionProvider';

const site = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: { default: 'NEVER SETTLE — T-shirts, Pants, Punjabis, Kurtas, Shoes & Wallets', template: '%s — NEVER SETTLE' },
  description: 'Everyday T-shirts and pants, punjabis and kurtas for every occasion, plus shoes and wallets. Designed in Dhaka. Cash on delivery across Bangladesh.',
  openGraph: { siteName: 'NEVER SETTLE', type: 'website', locale: 'en_BD' },
  twitter: { card: 'summary_large_image' },
};

export const viewport: Viewport = { themeColor: '#0B0B0C', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" style={{ ['--font-display' as string]: "'Anton'", ['--font-body' as string]: "'Inter Variable'" }}>
      <body>
        {/* Without JavaScript, show content that would otherwise wait for its scroll animation */}
        <noscript>
          <style>{'[style*="opacity:0"]{opacity:1!important}[style*="translateY"],[style*="clip-path"]{transform:none!important;clip-path:none!important}'}</style>
        </noscript>
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
