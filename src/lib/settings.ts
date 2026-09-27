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
};

export const getSettings = cache(async (): Promise<StoreSettings> => {
  try {
    const rows = await db.select().from(schema.settings);
    const stored = Object.fromEntries(rows.map((r) => [r.key, JSON.parse(r.value)]));
    return { ...DEFAULT_SETTINGS, ...stored };
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
