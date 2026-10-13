import { NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimit } from '@/lib/rate-limit';
import { bdPhone } from '@/lib/validation';
import { cartSubtotal, checkCoupon } from '@/lib/coupons';

const body = z.object({
  code: z.string().max(60),
  items: z.array(z.object({ variantId: z.number().int().positive(), quantity: z.number().int().min(1).max(20) })).min(1).max(50),
  phone: z.string().max(20).optional(),
});

/** Previews a discount code for the cart. The order itself re-checks everything when it is placed. */
export async function POST(req: Request) {
  if (!rateLimit(req, 'coupon', 20)) return NextResponse.json({ error: 'Too many tries. Please wait a minute.' }, { status: 429 });
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Enter a discount code.' }, { status: 400 });
  const phone = parsed.data.phone ? bdPhone.safeParse(parsed.data.phone) : null;
  const subtotal = await cartSubtotal(parsed.data.items);
  const check = await checkCoupon(parsed.data.code, { subtotal, phone: phone?.success ? phone.data : undefined });
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 422 });
  return NextResponse.json({ ok: true, code: check.code, discount: check.discount, freeShipping: check.freeShipping, summary: check.summary, subtotal });
}
