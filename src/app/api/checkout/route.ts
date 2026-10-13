import { NextResponse, after } from 'next/server';
import { cookies } from 'next/headers';
import { checkoutSchema, fieldErrors } from '@/lib/validation';
import { CheckoutError, createOrder, getOrderByNumber, orderToken } from '@/lib/orders';
import { sendOrderEmails } from '@/lib/mailer';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import { ATTR_COOKIE, deriveSource, parseAttribution } from '@/lib/attribution';
import { metaCookies, sendPurchaseToMeta } from '@/lib/meta-capi';

export async function POST(req: Request) {
  if (!rateLimit(req, 'checkout', 10)) return NextResponse.json({ error: 'Too many attempts. Please wait a minute and try again.' }, { status: 429 });

  const parsed = checkoutSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ errors: fieldErrors(parsed.error) }, { status: 400 });
  const input = parsed.data;

  // Which ad, post or site the shopper came from (saved by the browser on arrival).
  const jar = await cookies();
  const userAgent = req.headers.get('user-agent') ?? '';
  const attr = parseAttribution(jar.get(ATTR_COOKIE)?.value);
  const { source, medium, campaign } = deriveSource(attr, userAgent);

  let order;
  try {
    order = await createOrder(input, { source, medium, campaign, attribution: attr ? JSON.stringify(attr) : null });
  } catch (e) {
    if (e instanceof CheckoutError) return NextResponse.json({ error: e.message, errors: e.field ? { [e.field]: e.message } : undefined }, { status: 409 });
    console.error('Checkout failed', e);
    return NextResponse.json({ error: 'We could not place your order. Please try again.' }, { status: 500 });
  }

  const ip = clientIp(req);
  const capi = {
    ip: ip === 'local' ? undefined : ip,
    userAgent,
    url: req.headers.get('referer') ?? undefined,
    ...metaCookies((n) => jar.get(n)?.value, attr?.fbclid, attr?.ts),
  };
  const placed = order;
  // The order is saved; emails and the Meta Conversions API run after the response and never block or fail the checkout.
  after(async () => {
    await Promise.allSettled([
      getOrderByNumber(placed.number).then((full) => full && sendOrderEmails(full)).catch((e) => console.error('Order email failed', e)),
      sendPurchaseToMeta({
        number: placed.number, total: placed.total, shippingFee: placed.shippingFee, email: input.email || null, phone: input.phone,
        customerName: input.customerName, city: input.city, lines: placed.lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity, price: l.price })),
      }, capi),
    ]);
  });
  return NextResponse.json({ ok: true, redirect: `/order/${order.number}?t=${orderToken(order.number)}`, number: order.number });
}
