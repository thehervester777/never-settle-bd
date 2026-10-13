import 'server-only';
import crypto from 'crypto';
import { and, eq, inArray, lt, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { getSettings, shippingFor } from './settings';
import { recordMovement } from './inventory';
import { checkCoupon } from './coupons';
import { normalizeCode } from './attribution';
import type { CheckoutInput } from './validation';

const { orders, orderItems, variants, products, productImages } = schema;

export class CheckoutError extends Error {
  constructor(message: string, public field?: string) { super(message); }
}

/** HMAC token so order confirmation links can't be guessed by changing the number. */
export function orderToken(number: string) {
  return crypto.createHmac('sha256', process.env.AUTH_SECRET || 'dev').update(`order:${number}`).digest('hex').slice(0, 24);
}
export const verifyOrderToken = (number: string, token: string | null | undefined) =>
  !!token && /^[a-f0-9]{24}$/.test(token) && crypto.timingSafeEqual(Buffer.from(orderToken(number)), Buffer.from(token));

/** Where the order came from (see lib/attribution). Saved with the order for the marketing report. */
export type OrderSource = { source: string; medium: string; campaign: string | null; attribution: string | null };

/**
 * Creates an order from cart lines. Prices, stock, shipping and discounts always come from the
 * database, never from the browser. Stock is reserved (decremented) and a discount code's use is
 * counted inside the same transaction.
 */
export async function createOrder(input: CheckoutInput, from?: OrderSource) {
  const settings = await getSettings();
  if (input.paymentMethod === 'COD' && !settings.codEnabled) throw new CheckoutError('Cash on delivery is not available right now.', 'paymentMethod');

  // Merge duplicate lines for the same variant.
  const qty = new Map<number, number>();
  for (const i of input.items) qty.set(i.variantId, (qty.get(i.variantId) ?? 0) + i.quantity);
  const ids = [...qty.keys()];

  return db.transaction(async (tx) => {
    const rows = await tx
      .select({
        variantId: variants.id, stock: variants.stock, cost: variants.cost, color: variants.color, size: variants.size,
        productId: products.id, title: products.title, price: products.price, isActive: products.isActive,
      })
      .from(variants)
      .innerJoin(products, eq(variants.productId, products.id))
      .where(inArray(variants.id, ids))
      .for('update');

    if (rows.length !== ids.length) throw new CheckoutError('Some items in your cart are no longer available. Please review your cart.');

    const lines = rows.map((r) => {
      const q = qty.get(r.variantId)!;
      if (!r.isActive) throw new CheckoutError(`${r.title} is no longer available.`);
      if (r.stock < q) {
        const opts = [r.color, r.size].filter(Boolean).join(' / ');
        throw new CheckoutError(
          r.stock > 0 ? `Only ${r.stock} left of ${r.title}${opts ? ` (${opts})` : ''}. Please update your cart.` : `${r.title}${opts ? ` (${opts})` : ''} just sold out.`,
        );
      }
      return { ...r, quantity: q, options: [r.color, r.size].filter(Boolean).join(' / ') };
    });

    const images = await tx
      .select({ productId: productImages.productId, url: productImages.url, sortOrder: productImages.sortOrder })
      .from(productImages)
      .where(inArray(productImages.productId, lines.map((l) => l.productId)));
    const firstImage = (pid: number) => images.filter((i) => i.productId === pid).sort((a, b) => a.sortOrder - b.sortOrder)[0]?.url ?? null;

    const subtotal = lines.reduce((s, l) => s + l.price * l.quantity, 0);

    let discount = 0, couponCode: string | null = null, freeShipping = false;
    const code = normalizeCode(input.couponCode);
    if (code) {
      const [locked] = await tx.select().from(schema.coupons).where(eq(schema.coupons.code, code)).for('update');
      const check = await checkCoupon(code, { subtotal, phone: input.phone }, tx, locked);
      if (!check.ok) throw new CheckoutError(check.error, 'couponCode');
      discount = check.discount;
      freeShipping = check.freeShipping;
      couponCode = check.code;
      await tx.update(schema.coupons).set({ usedCount: sql`${schema.coupons.usedCount} + 1` }).where(eq(schema.coupons.id, check.coupon.id));
    }

    const shippingFee = freeShipping ? 0 : shippingFor(input.zone, subtotal, settings);
    const total = subtotal - discount + shippingFee;

    const tempNumber = `TMP-${crypto.randomBytes(6).toString('hex')}`;
    const [res] = await tx.insert(orders).values({
      number: tempNumber,
      paymentMethod: input.paymentMethod,
      customerName: input.customerName,
      phone: input.phone,
      email: input.email || null,
      address: input.address,
      city: input.city,
      area: input.area || null,
      zone: input.zone,
      note: input.note || null,
      subtotal, shippingFee, total, discount, couponCode,
      source: from?.source ?? null, medium: from?.medium ?? null, campaign: from?.campaign ?? null, attribution: from?.attribution ?? null,
    });
    const orderId = Number(res.insertId);
    const number = `NS-${10000 + orderId}`;
    await tx.update(orders).set({ number }).where(eq(orders.id, orderId));

    await tx.insert(orderItems).values(lines.map((l) => ({
      orderId, productId: l.productId, variantId: l.variantId, title: l.title, options: l.options,
      image: firstImage(l.productId), unitPrice: l.price, unitCost: l.cost, quantity: l.quantity,
    })));

    for (const l of lines) {
      await tx.update(variants).set({ stock: sql`${variants.stock} - ${l.quantity}` }).where(eq(variants.id, l.variantId));
      // The rows are locked (FOR UPDATE above), so the new balance is exact.
      await recordMovement(tx, { variantId: l.variantId, productId: l.productId, change: -l.quantity, balanceAfter: l.stock - l.quantity, reason: 'SALE', orderId, note: number });
    }
    await tx.insert(schema.orderEvents).values({ orderId, type: 'CREATED', message: `Order placed on the website (cash on delivery)${couponCode ? ` with code ${couponCode}` : ''}` });

    return { id: orderId, number, total, subtotal, shippingFee, discount, couponCode, lines };
  });
}

/** Puts reserved stock back (cancelled / returned orders). Safe to call more than once. */
export async function releaseStock(orderId: number, reason: 'CANCEL' | 'RETURN' = 'CANCEL', adminId: number | null = null) {
  await db.transaction(async (tx) => {
    const [o] = await tx.select().from(orders).where(eq(orders.id, orderId)).for('update');
    if (!o || o.stockReleased) return;
    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    for (const it of items) {
      if (!it.variantId) continue;
      const [v] = await tx.select().from(variants).where(eq(variants.id, it.variantId)).for('update');
      if (!v) continue; // the variant was deleted since; nothing to put back
      await tx.update(variants).set({ stock: v.stock + it.quantity }).where(eq(variants.id, v.id));
      await recordMovement(tx, { variantId: v.id, productId: v.productId, change: it.quantity, balanceAfter: v.stock + it.quantity, reason, orderId, note: o.number, adminId });
    }
    await tx.update(orders).set({ stockReleased: true }).where(eq(orders.id, orderId));
  });
}

/** Takes stock again when a cancelled or returned order is reopened. Fails without changes if anything is short. */
export async function reserveStockAgain(orderId: number, adminId: number | null = null): Promise<string | null> {
  return db.transaction(async (tx) => {
    const [o] = await tx.select().from(orders).where(eq(orders.id, orderId)).for('update');
    if (!o || !o.stockReleased) return null;
    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    const locked = [];
    for (const it of items) {
      if (!it.variantId) continue;
      const [v] = await tx.select().from(variants).where(eq(variants.id, it.variantId)).for('update');
      if (!v) return `${it.title} (${it.options || 'item'}) no longer exists, so this order can't be reopened.`;
      if (v.stock < it.quantity) return `Only ${v.stock} of ${it.title}${it.options ? ` (${it.options})` : ''} in stock, so this order can't be reopened.`;
      locked.push({ v, it });
    }
    for (const { v, it } of locked) {
      await tx.update(variants).set({ stock: v.stock - it.quantity }).where(eq(variants.id, v.id));
      await recordMovement(tx, { variantId: v.id, productId: v.productId, change: -it.quantity, balanceAfter: v.stock - it.quantity, reason: 'SALE', orderId, note: `${o.number} reopened`, adminId });
    }
    await tx.update(orders).set({ stockReleased: false }).where(eq(orders.id, orderId));
    return null;
  });
}

/**
 * Loads an order with its items. Uses plain queries (no LATERAL joins)
 * so it works on both MySQL 8 and MariaDB, which most cPanel hosts run.
 */
async function loadOrder(where: ReturnType<typeof eq>) {
  const [o] = await db.select().from(orders).where(where).limit(1);
  if (!o) return null;
  const [items, events] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, o.id)).orderBy(orderItems.id),
    db.select().from(schema.orderEvents).where(eq(schema.orderEvents.orderId, o.id)).orderBy(schema.orderEvents.id),
  ]);
  return { ...o, items, events };
}

export const getOrderByNumber = (number: string) => loadOrder(eq(orders.number, number));
export const getOrderById = (id: number) => loadOrder(eq(orders.id, id));
