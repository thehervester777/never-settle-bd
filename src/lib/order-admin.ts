import 'server-only';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { ORDER_STATUSES, type OrderStatus } from '@/db/schema';
import type { AdminSession } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { releaseStock, reserveStockAgain } from '@/lib/orders';
import { formatBDT } from '@/lib/money';

export const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: 'Pending', CONFIRMED: 'Confirmed', PROCESSING: 'Packing', SHIPPED: 'Shipped', DELIVERED: 'Delivered', CANCELLED: 'Cancelled', RETURNED: 'Returned',
};
export const PAYMENT_LABEL: Record<string, string> = { UNPAID: 'Unpaid', PAID: 'Paid', REFUNDED: 'Refunded', FAILED: 'Failed' };

const CLOSED: OrderStatus[] = ['CANCELLED', 'RETURNED'];

async function event(orderId: number, type: string, message: string, admin: AdminSession) {
  await db.insert(schema.orderEvents).values({ orderId, type, message: message.slice(0, 255), adminId: admin.id, adminName: admin.name });
}

/** Changes an order's status with its side effects: stock back on cancel/return, stock taken again on reopen, delivery date. */
export async function changeOrderStatus(orderId: number, status: OrderStatus, admin: AdminSession): Promise<string | null> {
  if (!ORDER_STATUSES.includes(status)) return 'Unknown status.';
  const [o] = await db.select().from(schema.orders).where(eq(schema.orders.id, orderId)).limit(1);
  if (!o) return 'Order not found.';
  if (o.status === status) return null;

  if (CLOSED.includes(status)) {
    await releaseStock(orderId, status === 'RETURNED' ? 'RETURN' : 'CANCEL', admin.id);
  } else if (o.stockReleased) {
    const problem = await reserveStockAgain(orderId, admin.id);
    if (problem) return problem;
  }

  await db.update(schema.orders).set({
    status,
    deliveredAt: status === 'DELIVERED' ? o.deliveredAt ?? new Date() : status === 'RETURNED' ? o.deliveredAt : null,
  }).where(eq(schema.orders.id, orderId));
  const msg = `Status: ${STATUS_LABEL[o.status]} → ${STATUS_LABEL[status]}`;
  await event(orderId, 'STATUS', msg, admin);
  await logActivity(admin, 'order.status', 'order', o.number, `${o.number} · ${msg}`);
  return null;
}

/**
 * Cash on delivery money: marking an order paid records the cash received; refunds and corrections
 * are recorded as money going back out, so the transactions ledger always adds up.
 */
export async function changePaymentStatus(orderId: number, next: 'UNPAID' | 'PAID' | 'REFUNDED', admin: AdminSession): Promise<string | null> {
  if (!['UNPAID', 'PAID', 'REFUNDED'].includes(next)) return 'Unknown payment status.';
  const [o] = await db.select().from(schema.orders).where(eq(schema.orders.id, orderId)).limit(1);
  if (!o) return 'Order not found.';
  const prev = o.paymentStatus;
  if (prev === next) return null;
  if (next === 'REFUNDED' && prev !== 'PAID') return 'Only a paid order can be refunded.';

  const entry = (status: string, amount: number) => db.insert(schema.payments).values({
    orderId, provider: 'cod', tranId: `COD-${o.number}-${Date.now().toString(36)}${crypto.randomBytes(2).toString('hex')}`, amount, status,
  });
  if (next === 'PAID') await entry('VALID', o.total);
  else if (prev === 'PAID') await entry(next === 'REFUNDED' ? 'REFUNDED' : 'REVERSED', -o.total);

  await db.update(schema.orders).set({ paymentStatus: next, paidAt: next === 'PAID' ? new Date() : next === 'UNPAID' ? null : o.paidAt }).where(eq(schema.orders.id, orderId));
  const msg = next === 'PAID' ? `Cash received: ${formatBDT(o.total)}` : next === 'REFUNDED' ? `Refunded ${formatBDT(o.total)}` : 'Payment marked as unpaid (correction)';
  await event(orderId, 'PAYMENT', msg, admin);
  await logActivity(admin, 'order.payment', 'order', o.number, `${o.number} · ${msg}`);
  return null;
}

export async function addOrderNote(orderId: number, note: string, admin: AdminSession) {
  const text = note.trim().slice(0, 255);
  if (!text) return;
  await event(orderId, 'NOTE', text, admin);
}
