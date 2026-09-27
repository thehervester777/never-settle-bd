import type { Metadata } from 'next';
import { getSettings } from '@/lib/settings';
import { CheckoutForm } from '@/components/checkout/CheckoutForm';

export const metadata: Metadata = { title: 'Checkout', robots: { index: false } };

export default async function CheckoutPage() {
  const s = await getSettings();
  return (
    <CheckoutForm
      shipping={{ inside: s.shippingInsideDhaka, outside: s.shippingOutsideDhaka, freeOver: s.freeShippingThreshold }}
      codEnabled={s.codEnabled}
    />
  );
}
