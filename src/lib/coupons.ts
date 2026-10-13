import 'server-only';
import { and, eq, inArray, notInArray } from 'drizzle-orm';
import { db, schema } from '@/db';
import type { CouponType } from '@/db/schema';
import { formatBDT } from '@/lib/money';
import { normalizeCode } from '@/lib/attribution';

export type Coupon = typeof schema.coupons.$inferSelect;
export type CouponCheck =
  | { ok: true; coupon: Coupon; code: string; discount: number; freeShipping: boolean; summary: string }
  | { ok: false; error: string };

type Runner = Pick<typeof db, 'select'>;

export const COUPON_TYPE_LABEL: Record<CouponType, string> = { PERCENT: 'Percentage off', FIXED: 'Fixed amount off', FREE_SHIPPING: 'Free delivery' };

/** "20% off (up to ৳500) on orders over ৳1,500" */
export function couponSummary(c: Pick<Coupon, 'type' | 'value' | 'maxDiscount' | 'minSubtotal'>) {
  const main = c.type === 'PERCENT' ? `${c.value}% off${c.maxDiscount ? ` (up to ${formatBDT(c.maxDiscount)})` : ''}` : c.type === 'FIXED' ? `${formatBDT(c.value)} off` : 'Free delivery';
  return c.minSubtotal > 0 ? `${main} on orders over ${formatBDT(c.minSubtotal)}` : main;
}

export type CouponState = 'active' | 'scheduled' | 'expired' | 'paused' | 'used-up';
export function couponState(c: Coupon, now = new Date()): CouponState {
  if (!c.isActive) return 'paused';
  if (c.startsAt && c.startsAt > now) return 'scheduled';
  if (c.endsAt && c.endsAt <= now) return 'expired';
  if (c.usageLimit != null && c.usedCount >= c.usageLimit) return 'used-up';
  return 'active';
}

const STATE_ERROR: Record<Exclude<CouponState, 'active'>, string> = {
  paused: "This code isn't valid.",
  scheduled: "This code isn't active yet.",
  expired: 'This code has expired.',
  'used-up': 'This code has been fully used.',
};

/** The discount on the products (poisha), never more than the subtotal. */
export function discountFor(c: Pick<Coupon, 'type' | 'value' | 'maxDiscount'>, subtotal: number) {
  if (c.type === 'PERCENT') {
    const d = Math.round((subtotal * Math.min(100, Math.max(0, c.value))) / 100);
    return Math.min(subtotal, c.maxDiscount ? Math.min(d, c.maxDiscount) : d);
  }
  if (c.type === 'FIXED') return Math.min(subtotal, Math.max(0, c.value));
  return 0;
}

/**
 * Checks a code against the cart. `phone` enables the once-per-customer rule (cancelled orders
 * don't count). Pass the transaction as `runner` when the coupon row is locked for an order.
 */
export async function checkCoupon(rawCode: unknown, cart: { subtotal: number; phone?: string }, runner: Runner = db, locked?: Coupon): Promise<CouponCheck> {
  const code = normalizeCode(rawCode);
  if (!code) return { ok: false, error: 'Enter a discount code.' };
  const coupon = locked ?? (await runner.select().from(schema.coupons).where(eq(schema.coupons.code, code)).limit(1))[0];
  if (!coupon) return { ok: false, error: "This code isn't valid." };
  const state = couponState(coupon);
  if (state !== 'active') return { ok: false, error: STATE_ERROR[state] };
  if (cart.subtotal < coupon.minSubtotal) return { ok: false, error: `Add ${formatBDT(coupon.minSubtotal - cart.subtotal)} more to use this code (orders over ${formatBDT(coupon.minSubtotal)}).` };
  if (coupon.oncePerCustomer && cart.phone) {
    const [used] = await runner.select({ id: schema.orders.id }).from(schema.orders)
      .where(and(eq(schema.orders.couponCode, coupon.code), eq(schema.orders.phone, cart.phone), notInArray(schema.orders.status, ['CANCELLED'])))
      .limit(1);
    if (used) return { ok: false, error: 'This code can be used once per customer, and this number has already used it.' };
  }
  return { ok: true, coupon, code: coupon.code, discount: discountFor(coupon, cart.subtotal), freeShipping: coupon.type === 'FREE_SHIPPING', summary: couponSummary(coupon) };
}

/** Prices cart lines from the database, the same way checkout does, for a code preview. */
export async function cartSubtotal(items: { variantId: number; quantity: number }[]) {
  const ids = [...new Set(items.map((i) => i.variantId))];
  if (!ids.length) return 0;
  const rows = await db.select({ id: schema.variants.id, price: schema.products.price })
    .from(schema.variants).innerJoin(schema.products, eq(schema.variants.productId, schema.products.id))
    .where(and(inArray(schema.variants.id, ids), eq(schema.products.isActive, true)));
  const price = new Map(rows.map((r) => [r.id, r.price]));
  return items.reduce((s, i) => s + (price.get(i.variantId) ?? 0) * i.quantity, 0);
}
