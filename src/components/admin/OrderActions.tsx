'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useState, useTransition } from 'react';
import type { OrderStatus } from '@/db/schema';
import { addNote, setOrderStatus, setPaymentStatus } from '@/app/admin/(panel)/orders/actions';
import { AdminIcon } from './AdminIcon';
import { toast } from './toast';

const FLOW: { status: OrderStatus; label: string; icon: string }[] = [
  { status: 'PENDING', label: 'Placed', icon: 'orders' },
  { status: 'CONFIRMED', label: 'Confirmed', icon: 'phone' },
  { status: 'PROCESSING', label: 'Packed', icon: 'box' },
  { status: 'SHIPPED', label: 'Shipped', icon: 'truck' },
  { status: 'DELIVERED', label: 'Delivered', icon: 'check' },
];
const NEXT: Partial<Record<OrderStatus, { status: OrderStatus; label: string }>> = {
  PENDING: { status: 'CONFIRMED', label: 'Confirm order' },
  CONFIRMED: { status: 'PROCESSING', label: 'Start packing' },
  PROCESSING: { status: 'SHIPPED', label: 'Hand to courier' },
  SHIPPED: { status: 'DELIVERED', label: 'Mark delivered' },
};

/** Progress tracker: Placed → Confirmed → Packed → Shipped → Delivered. */
export function OrderStepper({ status }: { status: OrderStatus }) {
  const closed = status === 'CANCELLED' || status === 'RETURNED';
  const at = Math.max(0, FLOW.findIndex((f) => f.status === status));
  const progress = closed ? 0 : at / (FLOW.length - 1);
  return (
    <div className="relative px-2 pt-1">
      <div className="absolute left-[calc(10%)] right-[calc(10%)] top-[22px] h-1 rounded-full bg-black/[0.06]">
        <motion.div className="h-full rounded-full bg-ink" initial={{ width: 0 }} animate={{ width: `${progress * 100}%` }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} />
      </div>
      <ol className="relative grid grid-cols-5">
        {FLOW.map((f, i) => {
          const done = !closed && i <= at;
          return (
            <li key={f.status} className="flex flex-col items-center text-center">
              <motion.span
                initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.1 + i * 0.08, type: 'spring', stiffness: 400, damping: 22 }}
                className={`grid h-11 w-11 place-items-center rounded-2xl border-2 ${done ? (i === at ? 'border-ink bg-accent text-ink shadow-[0_0_0_6px_rgba(212,255,58,0.25)]' : 'border-ink bg-ink text-accent') : 'border-black/10 bg-white text-ink/30'}`}
              >
                <AdminIcon name={f.icon} className="h-[18px] w-[18px]" />
              </motion.span>
              <span className={`mt-2 text-xs font-medium ${done ? 'text-ink' : 'text-ink/40'}`}>{f.label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function useAction() {
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (fn: () => Promise<{ ok: boolean; message: string }>) => start(async () => {
    const res = await fn();
    toast(res.message, res.ok ? 'ok' : 'warn');
    router.refresh();
  });
  return [pending, run] as const;
}

export function OrderStatusActions({ id, status, payment }: { id: number; status: OrderStatus; payment: string }) {
  const [pending, run] = useAction();
  const next = NEXT[status];
  const closed = status === 'CANCELLED' || status === 'RETURNED';
  return (
    <div className="space-y-3">
      {next && (
        <button type="button" disabled={pending} onClick={() => run(() => setOrderStatus(id, next.status))} className="abtn abtn-primary w-full py-3">
          {pending ? 'Saving…' : next.label} <AdminIcon name="chevron" className="h-4 w-4" />
        </button>
      )}
      {status === 'DELIVERED' && payment !== 'PAID' && (
        <button type="button" disabled={pending} onClick={() => run(() => setPaymentStatus(id, 'PAID'))} className="abtn abtn-accent w-full py-3"><AdminIcon name="cash" className="h-4 w-4" /> Cash received from courier</button>
      )}
      <div className="grid grid-cols-2 gap-2">
        {payment !== 'PAID' && status !== 'DELIVERED' && !closed && (
          <button type="button" disabled={pending} onClick={() => run(() => setPaymentStatus(id, 'PAID'))} className="abtn abtn-outline"><AdminIcon name="cash" className="h-4 w-4" /> Mark paid</button>
        )}
        {payment === 'PAID' && (
          <button type="button" disabled={pending} onClick={() => confirm('Record a refund of this order’s total?') && run(() => setPaymentStatus(id, 'REFUNDED'))} className="abtn abtn-outline">Refund</button>
        )}
        {payment === 'PAID' && (
          <button type="button" disabled={pending} onClick={() => confirm('Mark as unpaid? Use this only to correct a mistake.') && run(() => setPaymentStatus(id, 'UNPAID'))} className="abtn abtn-ghost">Mark unpaid</button>
        )}
        {status === 'DELIVERED' && (
          <button type="button" disabled={pending} onClick={() => confirm('Mark as returned? The items go back into stock.') && run(() => setOrderStatus(id, 'RETURNED'))} className="abtn abtn-outline">Returned</button>
        )}
        {!closed && status !== 'DELIVERED' && (
          <button type="button" disabled={pending} onClick={() => confirm('Cancel this order? The items go back into stock.') && run(() => setOrderStatus(id, 'CANCELLED'))} className="abtn abtn-ghost text-red-600 hover:bg-red-50 hover:text-red-700">Cancel order</button>
        )}
        {closed && (
          <button type="button" disabled={pending} onClick={() => run(() => setOrderStatus(id, 'PENDING'))} className="abtn abtn-outline col-span-2"><AdminIcon name="refresh" className="h-4 w-4" /> Reopen order</button>
        )}
      </div>
      <details className="group rounded-xl border border-black/[0.06] px-3 py-2 text-sm">
        <summary className="flex items-center justify-between text-ink/60">Set any status <AdminIcon name="chevron-down" className="h-4 w-4 transition group-open:rotate-180" /></summary>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {(['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED'] as OrderStatus[]).filter((s) => s !== status).map((s) => (
            <button key={s} type="button" disabled={pending} onClick={() => run(() => setOrderStatus(id, s))} className="abtn abtn-sm abtn-outline justify-start capitalize">{s === 'PROCESSING' ? 'Packing' : s.toLowerCase()}</button>
          ))}
        </div>
      </details>
    </div>
  );
}

export function OrderNoteForm({ id }: { id: number }) {
  const [note, setNote] = useState('');
  const [pending, run] = useAction();
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => { e.preventDefault(); if (!note.trim()) return; run(async () => { const r = await addNote(id, note); setNote(''); return r; }); }}
    >
      <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={255} placeholder="Add a note (e.g. customer asked to deliver after 5pm)" className="ainput" />
      <button className="abtn abtn-primary" disabled={pending || !note.trim()}>Add</button>
    </form>
  );
}
