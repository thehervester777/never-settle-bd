import { NextResponse } from 'next/server';
import { readJson } from '@/lib/body';
import { checkoutSchema, fieldErrors } from '@/lib/validation';
import { CheckoutError, createOrder, getOrderByNumber, orderToken } from '@/lib/orders';
import { sendOrderEmails } from '@/lib/mailer';
import { rateLimit } from '@/lib/rate-limit';
import { refreshStore } from '@/lib/store-cache';

export async function POST(req: Request) {
  if (!rateLimit(req, 'checkout', 10)) return NextResponse.json({ error: 'Too many attempts. Please wait a minute and try again.' }, { status: 429 });

  let body: unknown;
  try { body = await readJson(req); } catch { return NextResponse.json({ error: 'Request too large.' }, { status: 413 }); }
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ errors: fieldErrors(parsed.error) }, { status: 400 });
  const input = parsed.data;

  let order;
  try {
    order = await createOrder(input);
  } catch (e) {
    if (e instanceof CheckoutError) return NextResponse.json({ error: e.message, errors: e.field ? { [e.field]: e.message } : undefined }, { status: 409 });
    console.error('Checkout failed', e);
    return NextResponse.json({ error: 'We could not place your order. Please try again.' }, { status: 500 });
  }

  // A size just sold out: the store stops offering it straight away.
  if (order.lines.some((l) => l.stock - l.quantity <= 0)) refreshStore();

  // The order is saved; emails run in the background and never block or fail the checkout.
  getOrderByNumber(order.number).then((full) => full && sendOrderEmails(full)).catch((e) => console.error('Order email failed', e));
  return NextResponse.json({ ok: true, redirect: `/order/${order.number}?t=${orderToken(order.number)}`, number: order.number });
}
