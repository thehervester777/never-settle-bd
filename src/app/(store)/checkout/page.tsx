import type { Metadata } from 'next';
import { getSettings } from '@/lib/settings';
import { sslcommerzConfigured } from '@/lib/sslcommerz';
import { mockGatewayEnabled } from '@/lib/payments';
import { CheckoutForm } from '@/components/checkout/CheckoutForm';

export const metadata: Metadata = { title: 'Checkout', robots: { index: false } };

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ payment?: string; order?: string }> }) {
  const sp = await searchParams;
  const s = await getSettings();
  const onlineReady = s.sslcommerzEnabled && (sslcommerzConfigured() || mockGatewayEnabled());
  const notice =
    sp.payment === 'failed' ? `Your payment didn't go through${sp.order ? ` (order ${sp.order} was cancelled)` : ''}. Your cart is still here. Try again or choose cash on delivery.`
      : sp.payment === 'cancelled' ? `You cancelled the payment${sp.order ? ` for order ${sp.order}` : ''}. Your cart is still here.`
        : null;
  return (
    <CheckoutForm
      notice={notice}
      shipping={{ inside: s.shippingInsideDhaka, outside: s.shippingOutsideDhaka, freeOver: s.freeShippingThreshold }}
      methods={{ cod: s.codEnabled, online: onlineReady }}
      testMode={process.env.SSLCZ_SANDBOX !== 'false'}
    />
  );
}
