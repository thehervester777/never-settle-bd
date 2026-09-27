import 'server-only';
import { and, eq, ne } from 'drizzle-orm';
import { db, schema } from '@/db';
import { validate, verifySign, type Validation } from './sslcommerz';
import { releaseStock, getOrderByNumber } from './orders';
import { sendOrderEmails } from './mailer';

const { orders, payments } = schema;

/** Local testing only: the stand-in gateway is available when BOTH sandbox and mock are switched on. */
export const mockGatewayEnabled = () => process.env.SSLCZ_SANDBOX !== 'false' && process.env.SSLCZ_MOCK === 'true';

async function validateAny(valId: string, tranId: string): Promise<Validation> {
  if (mockGatewayEnabled() && valId.startsWith('MOCK-')) {
    const [p] = await db.select().from(payments).where(eq(payments.tranId, tranId)).limit(1);
    return { valid: !!p, status: p ? 'VALID' : 'INVALID_TRANSACTION', tranId, amount: p?.amount, currency: 'BDT', cardType: 'MOCK-TEST', raw: { mock: true } };
  }
  return validate(valId);
}

/**
 * Confirms an SSLCOMMERZ payment. Only marks the order paid when the validation API says VALID
 * and the transaction id, amount and currency all match what we stored. Idempotent.
 */
export async function confirmPayment(fields: Record<string, string>) {
  const tranId = fields.tran_id;
  const valId = fields.val_id;
  if (!tranId || !valId) return { ok: false as const, reason: 'missing fields' };

  const [payment] = await db.select().from(payments).where(eq(payments.tranId, tranId)).limit(1);
  if (!payment) return { ok: false as const, reason: 'unknown transaction' };
  const [order] = await db.select().from(orders).where(eq(orders.id, payment.orderId)).limit(1);
  if (!order) return { ok: false as const, reason: 'unknown order' };
  if (payment.status === 'VALID') return { ok: true as const, order };

  if (fields.verify_sign && !verifySign(fields) && !valId.startsWith('MOCK-')) {
    console.warn(`[sslcommerz] verify_sign mismatch for ${tranId}; relying on validation API`);
  }

  const v = await validateAny(valId, tranId);
  const matches = v.valid && v.tranId === tranId && v.amount === order.total && (v.currency ?? 'BDT') === 'BDT';
  if (!matches) {
    await db.update(payments).set({ status: 'FAILED', valId, raw: JSON.stringify(v.raw ?? null).slice(0, 60000) }).where(eq(payments.id, payment.id));
    return { ok: false as const, reason: `validation ${v.status}`, order };
  }

  await db.update(payments).set({ status: 'VALID', valId, cardType: v.cardType ?? null, bankTranId: v.bankTranId ?? null, raw: JSON.stringify(v.raw ?? null).slice(0, 60000) }).where(eq(payments.id, payment.id));
  // Rare case: the order was auto-cancelled (and its stock released) while the shopper was still paying.
  // Keep the money-side correct (PAID), put the order back to PENDING and leave a note for the admin to check stock.
  const wasCancelled = order.status === 'CANCELLED';
  await db.update(orders).set({
    paymentStatus: 'PAID',
    status: wasCancelled ? 'PENDING' : 'CONFIRMED',
    ...(wasCancelled ? { note: `${order.note ? order.note + '\n\n' : ''}[System] Payment arrived after this order was auto-cancelled. Check stock before confirming.` } : {}),
  }).where(eq(orders.id, order.id));

  getOrderByNumber(order.number)
    .then((full) => full && sendOrderEmails({ ...full, paymentMethod: 'SSLCOMMERZ' }))
    .catch((e) => console.error('Order email failed', e));
  return { ok: true as const, order: { ...order, paymentStatus: 'PAID' as const } };
}

/** Shopper cancelled or the payment failed: cancel the unpaid order and put its stock back. */
export async function abandonPayment(tranId: string, status: 'FAILED' | 'CANCELLED') {
  const [payment] = await db.select().from(payments).where(eq(payments.tranId, tranId)).limit(1);
  if (!payment || payment.status === 'VALID') return null;
  await db.update(payments).set({ status }).where(eq(payments.id, payment.id));
  const [order] = await db.select().from(orders).where(eq(orders.id, payment.orderId)).limit(1);
  if (order && order.paymentStatus !== 'PAID') {
    await db.update(orders).set({ status: 'CANCELLED', paymentStatus: 'FAILED' }).where(and(eq(orders.id, order.id), ne(orders.paymentStatus, 'PAID')));
    await releaseStock(order.id);
  }
  return order ?? null;
}

export async function readForm(req: Request): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  try {
    const fd = await req.formData();
    fd.forEach((v, k) => { out[k] = String(v); });
  } catch { /* not a form post */ }
  const url = new URL(req.url);
  url.searchParams.forEach((v, k) => { if (!(k in out)) out[k] = v; });
  return out;
}
