import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { checkoutSchema, fieldErrors } from '@/lib/validation';
import { CheckoutError, createOrder, getOrderByNumber, orderToken, releaseStaleOrders, releaseStock } from '@/lib/orders';
import { initSession, newTranId, sslcommerzConfigured } from '@/lib/sslcommerz';
import { mockGatewayEnabled } from '@/lib/payments';
import { sendOrderEmails } from '@/lib/mailer';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(req: Request) {
  if (!rateLimit(req, 'checkout', 10)) return NextResponse.json({ error: 'Too many attempts. Please wait a minute and try again.' }, { status: 429 });

  const parsed = checkoutSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ errors: fieldErrors(parsed.error) }, { status: 400 });
  const input = parsed.data;

  if (input.paymentMethod === 'SSLCOMMERZ' && !sslcommerzConfigured() && !mockGatewayEnabled()) {
    return NextResponse.json({ errors: { paymentMethod: 'Online payment is not set up yet. Please choose cash on delivery.' } }, { status: 400 });
  }

  releaseStaleOrders().catch(() => {});

  let order;
  try {
    order = await createOrder(input);
  } catch (e) {
    if (e instanceof CheckoutError) return NextResponse.json({ error: e.message, errors: e.field ? { [e.field]: e.message } : undefined }, { status: 409 });
    console.error('Checkout failed', e);
    return NextResponse.json({ error: 'We could not place your order. Please try again.' }, { status: 500 });
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin).replace(/\/$/, '');
  const confirmUrl = `/order/${order.number}?t=${orderToken(order.number)}`;

  if (input.paymentMethod === 'COD') {
    // The order is saved; emails run in the background and never block or fail the checkout.
    getOrderByNumber(order.number).then((full) => full && sendOrderEmails(full)).catch((e) => console.error('Order email failed', e));
    return NextResponse.json({ ok: true, redirect: confirmUrl, number: order.number });
  }

  // Online payment through SSLCOMMERZ
  const tranId = newTranId(order.number);
  await db.insert(schema.payments).values({ orderId: order.id, provider: 'sslcommerz', tranId, amount: order.total, status: 'INITIATED' });

  if (mockGatewayEnabled()) {
    return NextResponse.json({ ok: true, redirect: `/dev/sslcommerz?tran_id=${encodeURIComponent(tranId)}&amount=${order.total}`, number: order.number });
  }

  const session = await initSession({
    tranId, amount: order.total, orderNumber: order.number, siteUrl, itemCount: order.lines.reduce((s, l) => s + l.quantity, 0),
    productNames: order.lines.map((l) => l.title).join(', '),
    customer: { name: input.customerName, email: input.email, phone: input.phone, address: input.address, city: input.city },
  });

  if (!session.ok) {
    await db.update(schema.payments).set({ status: 'FAILED' }).where(eq(schema.payments.tranId, tranId));
    await db.update(schema.orders).set({ status: 'CANCELLED', paymentStatus: 'FAILED' }).where(eq(schema.orders.id, order.id));
    await releaseStock(order.id);
    return NextResponse.json({ error: `${session.error} You can try again or choose cash on delivery.` }, { status: 502 });
  }
  return NextResponse.json({ ok: true, redirect: session.url, number: order.number });
}
