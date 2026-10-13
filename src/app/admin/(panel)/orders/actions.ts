'use server';

import { revalidatePath } from 'next/cache';
import { ORDER_STATUSES, type OrderStatus } from '@/db/schema';
import { requirePermission } from '@/lib/auth';
import { addOrderNote, changeOrderStatus, changePaymentStatus } from '@/lib/order-admin';

export type BulkOp = { kind: 'status'; status: OrderStatus } | { kind: 'payment'; status: 'PAID' | 'UNPAID' };
export type ActionResult = { ok: boolean; message: string };

/** Applies one change to many orders; reports which ones couldn't change (e.g. not enough stock to reopen). */
export async function bulkUpdateOrders(ids: number[], op: BulkOp): Promise<ActionResult> {
  const admin = await requirePermission('orders.manage');
  const clean = [...new Set(ids.filter((n) => Number.isInteger(n) && n > 0))].slice(0, 200);
  if (op.kind === 'status' && !ORDER_STATUSES.includes(op.status)) return { ok: false, message: 'Unknown status.' };
  const problems: string[] = [];
  for (const id of clean) {
    const err = op.kind === 'status' ? await changeOrderStatus(id, op.status, admin) : await changePaymentStatus(id, op.status, admin);
    if (err) problems.push(err);
  }
  revalidatePath('/admin', 'layout');
  const done = clean.length - problems.length;
  return problems.length
    ? { ok: done > 0, message: `${done} updated, ${problems.length} skipped: ${problems[0]}` }
    : { ok: true, message: `${done} order${done === 1 ? '' : 's'} updated` };
}

export async function setOrderStatus(id: number, status: OrderStatus): Promise<ActionResult> {
  const admin = await requirePermission('orders.manage');
  const err = await changeOrderStatus(id, status, admin);
  revalidatePath('/admin', 'layout');
  return err ? { ok: false, message: err } : { ok: true, message: 'Order updated' };
}

export async function setPaymentStatus(id: number, status: 'UNPAID' | 'PAID' | 'REFUNDED'): Promise<ActionResult> {
  const admin = await requirePermission('orders.manage');
  const err = await changePaymentStatus(id, status, admin);
  revalidatePath('/admin', 'layout');
  return err ? { ok: false, message: err } : { ok: true, message: status === 'PAID' ? 'Cash received recorded' : 'Payment updated' };
}

export async function addNote(id: number, note: string): Promise<ActionResult> {
  const admin = await requirePermission('orders.view');
  await addOrderNote(id, note, admin);
  revalidatePath(`/admin/orders/${id}`);
  return { ok: true, message: 'Note added' };
}
