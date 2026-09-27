import 'server-only';
import crypto from 'crypto';
import { and, eq, inArray, lt, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { getSettings, shippingFor } from './settings';
import type { CheckoutInput } from './validation';

const { orders, orderItems, variants, products, productImages, payments } = schema;

export class CheckoutError extends Error {
  constructor(message: string, public field?: string) { super(message); }
}

/** HMAC token so order confirmation links can't be guessed by changing the number. */
export function orderToken(number: string) {
  return crypto.createHmac('sha256', process.env.AUTH_SECRET || 'dev').update(`order:${number}`).digest('hex').slice(0, 24);
}
export const verifyOrderToken = (number: string, token: string | null | undefined) =>
  !!token && /^[a-f0-9]{24}$/.test(token) && crypto.timingSafeEqual(Buffer.from(orderToken(number)), Buffer.from(token));

/**
 * Creates an order from cart lines. Prices, stock and shipping always come from the database,
 * never from the browser. Stock is reserved (decremented) inside the same transaction.
 */
export async function createOrder(input: CheckoutInput) {
  const settings = await getSettings();
  if (input.paymentMethod === 'COD' && !settings.codEnabled) throw new CheckoutError('Cash on delivery is not available right now.', 'paymentMethod');
  if (input.paymentMethod === 'SSLCOMMERZ' && !settings.sslcommerzEnabled) throw new CheckoutError('Online payment is not available right now.', 'paymentMethod');

  // Merge duplicate lines for the same variant.
  const qty = new Map<number, number>();
  for (const i of input.items) qty.set(i.variantId, (qty.get(i.variantId) ?? 0) + i.quantity);
  const ids = [...qty.keys()];

  return db.transaction(async (tx) => {
    const rows = await tx
      .select({
        variantId: variants.id, stock: variants.stock, color: variants.color, size: variants.size,
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
    const shippingFee = shippingFor(input.zone, subtotal, settings);
    const total = subtotal + shippingFee;

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
      subtotal, shippingFee, total,
    });
    const orderId = Number(res.insertId);
    const number = `NS-${10000 + orderId}`;
    await tx.update(orders).set({ number }).where(eq(orders.id, orderId));

    await tx.insert(orderItems).values(lines.map((l) => ({
      orderId, productId: l.productId, variantId: l.variantId, title: l.title, options: l.options,
      image: firstImage(l.productId), unitPrice: l.price, quantity: l.quantity,
    })));

    for (const l of lines) {
      await tx.update(variants).set({ stock: sql`${variants.stock} - ${l.quantity}` }).where(eq(variants.id, l.variantId));
    }

    return { id: orderId, number, total, subtotal, shippingFee, lines };
  });
}

/** Puts reserved stock back (cancelled / failed / returned orders). Safe to call more than once. */
export async function releaseStock(orderId: number) {
  await db.transaction(async (tx) => {
    const [o] = await tx.select().from(orders).where(eq(orders.id, orderId)).for('update');
    if (!o || o.stockReleased) return;
    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    for (const it of items) {
      if (it.variantId) await tx.update(variants).set({ stock: sql`${variants.stock} + ${it.quantity}` }).where(eq(variants.id, it.variantId));
    }
    await tx.update(orders).set({ stockReleased: true }).where(eq(orders.id, orderId));
  });
}

/** Online-payment orders that were never paid within 60 minutes are cancelled and their stock released. */
export async function releaseStaleOrders() {
  const cutoff = new Date(Date.now() - 60 * 60 * 1000);
  const stale = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.paymentMethod, 'SSLCOMMERZ'), eq(orders.paymentStatus, 'UNPAID'), eq(orders.status, 'PENDING'), lt(orders.createdAt, cutoff)));
  for (const s of stale) {
    await db.update(orders).set({ status: 'CANCELLED' }).where(eq(orders.id, s.id));
    await releaseStock(s.id);
  }
  return stale.length;
}

/**
 * Loads an order with its items and payments. Uses plain queries (no LATERAL joins)
 * so it works on both MySQL 8 and MariaDB, which most cPanel hosts run.
 */
async function loadOrder(where: ReturnType<typeof eq>) {
  const [o] = await db.select().from(orders).where(where).limit(1);
  if (!o) return null;
  const [items, pays] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, o.id)).orderBy(orderItems.id),
    db.select().from(payments).where(eq(payments.orderId, o.id)).orderBy(payments.id),
  ]);
  return { ...o, items, payments: pays };
}

export const getOrderByNumber = (number: string) => loadOrder(eq(orders.number, number));
export const getOrderById = (id: number) => loadOrder(eq(orders.id, id));

export async function recordPayment(values: typeof payments.$inferInsert) {
  await db.insert(payments).values(values);
}
