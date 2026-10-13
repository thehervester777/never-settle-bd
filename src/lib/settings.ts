import 'server-only';
import { cache } from 'react';
import { db, schema } from '@/db';
import { sql } from 'drizzle-orm';

/** Store settings the admin can change. Money values are in poisha. */
export type StoreSettings = {
  shippingInsideDhaka: number;
  shippingOutsideDhaka: number;
  freeShippingThreshold: number; // 0 = off
  codEnabled: boolean;
  announcement: string; // "|" separated messages
  phone: string;
  email: string;
  address: string;
  hours: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  paymentLabels: string; // comma separated, shown to shoppers
  lowStockThreshold: number; // units; at or below this a variant counts as low stock
  invoiceNote: string; // printed at the bottom of invoices
  // Ads & tracking. All IDs are public (they end up in the page source anyway).
  metaPixelId: string;
  tiktokPixelId: string;
  ga4Id: string; // G-XXXXXXX
  googleAdsId: string; // AW-123456789
  googleAdsPurchaseLabel: string; // conversion label of the Google Ads "Purchase" action
  metaDomainVerification: string;
  googleSiteVerification: string;
  whatsappNumber: string; // digits with country code, e.g. 8801712345678
  messengerPage: string; // facebook page username for m.me links
};

/** Kept server-side only: never returned by getSettings(), so they can't end up in a page. */
export type SecretSettings = {
  metaCapiToken: string;
  metaTestEventCode: string;
};

export const DEFAULT_SETTINGS: StoreSettings = {
  shippingInsideDhaka: 7000,
  shippingOutsideDhaka: 13000,
  freeShippingThreshold: 300000,
  codEnabled: true,
  announcement: 'Free delivery on orders over ৳3,000|7-day easy exchange on all orders|Cash on delivery across Bangladesh',
  phone: '+880 1XXX-XXXXXX',
  email: 'hello@yourdomain.com',
  address: 'Dhaka, Bangladesh',
  hours: 'Sat–Thu, 10am–8pm',
  instagram: '',
  facebook: '',
  tiktok: '',
  paymentLabels: 'Cash on delivery',
  lowStockThreshold: 3,
  invoiceNote: 'Thank you for shopping with NEVER SETTLE. Exchanges within 7 days with tags attached.',
  metaPixelId: '',
  tiktokPixelId: '',
  ga4Id: '',
  googleAdsId: '',
  googleAdsPurchaseLabel: '',
  metaDomainVerification: '',
  googleSiteVerification: '',
  whatsappNumber: '',
  messengerPage: '',
};

async function storedValues(): Promise<Record<string, unknown>> {
  const rows = await db.select().from(schema.settings);
  return Object.fromEntries(rows.map((r) => [r.key, JSON.parse(r.value)]));
}

/** Public store settings. Only known keys are returned, so secrets and internal values never leak into pages. */
export const getSettings = cache(async (): Promise<StoreSettings> => {
  try {
    const stored = await storedValues();
    const out = { ...DEFAULT_SETTINGS } as Record<string, unknown>;
    for (const key of Object.keys(DEFAULT_SETTINGS)) if (key in stored && typeof stored[key] === typeof out[key]) out[key] = stored[key];
    return out as StoreSettings;
  } catch {
    return DEFAULT_SETTINGS;
  }
});

/** Server-side credentials. An environment variable wins over the value saved in the admin. */
export const getSecretSettings = cache(async (): Promise<SecretSettings> => {
  let stored: Record<string, unknown> = {};
  try { stored = await storedValues(); } catch { /* database unavailable */ }
  const str = (k: string) => (typeof stored[k] === 'string' ? (stored[k] as string) : '');
  return {
    metaCapiToken: process.env.META_CAPI_TOKEN || str('metaCapiToken'),
    metaTestEventCode: process.env.META_TEST_EVENT_CODE || str('metaTestEventCode'),
  };
});

export const secretFromEnv = (key: keyof SecretSettings) => !!process.env[key === 'metaCapiToken' ? 'META_CAPI_TOKEN' : 'META_TEST_EVENT_CODE'];

export async function saveSettings(values: Partial<StoreSettings & SecretSettings>) {
  for (const [key, value] of Object.entries(values)) {
    await db
      .insert(schema.settings)
      .values({ key, value: JSON.stringify(value) })
      .onDuplicateKeyUpdate({ set: { value: sql`VALUES(\`value\`)` } });
  }
}

export function shippingFor(zone: string, subtotal: number, s: StoreSettings): number {
  if (s.freeShippingThreshold > 0 && subtotal >= s.freeShippingThreshold) return 0;
  return zone === 'inside_dhaka' ? s.shippingInsideDhaka : s.shippingOutsideDhaka;
}

/** Internal values (keys start with "_"), e.g. the last Conversions API result. Never shown in the store. */
export async function getInternalValue<T>(key: `_${string}`): Promise<T | null> {
  try {
    const stored = await storedValues();
    return (stored[key] as T) ?? null;
  } catch {
    return null;
  }
}

export async function setInternalValue(key: `_${string}`, value: unknown) {
  await db.insert(schema.settings).values({ key, value: JSON.stringify(value) }).onDuplicateKeyUpdate({ set: { value: sql`VALUES(\`value\`)` } });
}
