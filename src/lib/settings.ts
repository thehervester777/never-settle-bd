import 'server-only';
import { cache } from 'react';
import { db, schema } from '@/db';
import { sql } from 'drizzle-orm';
import { cached } from '@/lib/store-cache';

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
};

async function readSettings(): Promise<StoreSettings> {
  const rows = await db.select().from(schema.settings);
  const stored = Object.fromEntries(rows.map((r) => [r.key, JSON.parse(r.value)]));
  // Only known keys, with the right type, so nothing unexpected in the table ever reaches a page.
  const out = { ...DEFAULT_SETTINGS } as Record<string, unknown>;
  for (const key of Object.keys(DEFAULT_SETTINGS)) if (key in stored && typeof stored[key] === typeof out[key]) out[key] = stored[key];
  return out as StoreSettings;
}

/** Settings as the store shows them, cached briefly (see store-cache). */
export const getSettings = cache(async (): Promise<StoreSettings> => {
  try {
    return await cached('settings', readSettings);
  } catch {
    return DEFAULT_SETTINGS;
  }
});

/** Straight from the database: for the settings form and for pricing an order. */
export const getFreshSettings = cache(async (): Promise<StoreSettings> => {
  try {
    return await readSettings();
  } catch {
    return DEFAULT_SETTINGS;
  }
});

export async function saveSettings(values: Partial<StoreSettings>) {
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
