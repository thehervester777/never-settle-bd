'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { useState, useTransition } from 'react';
import { bulkUpdateOrders, type BulkOp } from '@/app/admin/(panel)/orders/actions';
import { AdminIcon } from './AdminIcon';
import { StatusBadge } from './StatusBadge';
import { EmptyState } from './ui';
import { toast } from './toast';

export type OrderRow = {
  id: number; number: string; when: string; ago: string; customer: string; phone: string; city: string; zone: string;
  items: number; status: string; payment: string; total: string; via?: string | null; coupon?: string | null;
};

const ACTIONS: { label: string; op: BulkOp; icon: string }[] = [
  { label: 'Confirm', op: { kind: 'status', status: 'CONFIRMED' }, icon: 'check' },
  { label: 'Packing', op: { kind: 'status', status: 'PROCESSING' }, icon: 'box' },
  { label: 'Shipped', op: { kind: 'status', status: 'SHIPPED' }, icon: 'truck' },
  { label: 'Delivered', op: { kind: 'status', status: 'DELIVERED' }, icon: 'check' },
  { label: 'Cash received', op: { kind: 'payment', status: 'PAID' }, icon: 'cash' },
];

export function OrdersTable({ rows, canManage }: { rows: OrderRow[]; canManage: boolean }) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [pending, start] = useTransition();
  const router = useRouter();
  const all = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggle = (id: number) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const run = (op: BulkOp, label: string) => {
    if (op.kind === 'status' && op.status === 'CANCELLED' && !confirm(`Cancel ${selected.size} order(s)? Their items go back into stock.`)) return;
    start(async () => {
      const res = await bulkUpdateOrders([...selected], op);
      toast(res.message || label, res.ok ? 'ok' : 'warn');
      setSelected(new Set());
      router.refresh();
    });
  };

  return (
    <div className="relative">
      <div className="overflow-x-auto">
        <table className="admin-table">
          <thead>
            <tr>
              {canManage && (
                <th className="w-10">
                  <input type="checkbox" className="acheck" aria-label="Select all orders on this page" checked={all}
                    onChange={() => setSelected(all ? new Set() : new Set(rows.map((r) => r.id)))} />
                </th>
              )}
              <th>Order</th><th>Customer</th><th>Delivery</th><th>Status</th><th>Payment</th><th className="text-right">Total</th><th className="w-20 text-right">Invoice</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o, i) => (
              <motion.tr key={o.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: Math.min(i, 15) * 0.02 }}
                className={selected.has(o.id) ? '!bg-accent/15' : ''}>
                {canManage && <td><input type="checkbox" className="acheck" aria-label={`Select ${o.number}`} checked={selected.has(o.id)} onChange={() => toggle(o.id)} /></td>}
                <td className="whitespace-nowrap">
                  <Link className="font-semibold hover:underline" href={`/admin/orders/${o.id}`}>{o.number}</Link>
                  <p className="text-xs text-ink/45" title={o.when}>{o.ago} · {o.items} item{o.items === 1 ? '' : 's'}</p>
                  {(o.via || o.coupon) && (
                    <p className="mt-1 flex flex-wrap gap-1 text-[0.65rem] font-medium">
                      {o.via && <span className="rounded-full bg-sky-50 px-1.5 py-0.5 text-sky-800">via {o.via}</span>}
                      {o.coupon && <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-amber-800">{o.coupon}</span>}
                    </p>
                  )}
                </td>
                <td>{o.customer}<p className="text-xs text-ink/45">{o.phone}</p></td>
                <td className="text-xs">{o.city}<p className="text-ink/45">{o.zone}</p></td>
                <td><StatusBadge status={o.status} /></td>
                <td><StatusBadge status={o.payment} /></td>
                <td className="text-right font-semibold tabular">{o.total}</td>
                <td className="text-right">
                  <a href={`/admin/print?ids=${o.id}`} target="_blank" className="inline-flex rounded-lg p-1.5 text-ink/45 transition hover:bg-black/[0.05] hover:text-ink" aria-label={`Print invoice ${o.number}`}><AdminIcon name="print" className="h-4 w-4" /></a>
                </td>
              </motion.tr>
            ))}
            {!rows.length && <tr><td colSpan={canManage ? 8 : 7}><EmptyState icon="orders" title="No orders match">Try another tab or clear the filters.</EmptyState></td></tr>}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            className="fixed inset-x-3 bottom-5 z-40 mx-auto flex max-w-4xl flex-wrap items-center gap-2 rounded-2xl bg-ink p-2.5 pl-4 text-white shadow-2xl lg:left-[264px]"
          >
            <span className="mr-1 text-sm font-medium">{selected.size} selected</span>
            <span className="mx-1 hidden h-5 w-px bg-white/15 sm:block" />
            {ACTIONS.map((a) => (
              <button key={a.label} type="button" disabled={pending} onClick={() => run(a.op, a.label)} className="abtn abtn-sm bg-white/10 text-white hover:bg-white/20">
                <AdminIcon name={a.icon} className="h-3.5 w-3.5" /> {a.label}
              </button>
            ))}
            <a href={`/admin/print?ids=${[...selected].join(',')}`} target="_blank" className="abtn abtn-sm bg-accent text-ink hover:brightness-95"><AdminIcon name="print" className="h-3.5 w-3.5" /> Print invoices</a>
            <button type="button" disabled={pending} onClick={() => run({ kind: 'status', status: 'CANCELLED' }, 'Cancelled')} className="abtn abtn-sm text-red-300 hover:bg-red-500/20">Cancel</button>
            <button type="button" onClick={() => setSelected(new Set())} className="ml-auto rounded-lg p-1.5 text-white/60 hover:bg-white/10" aria-label="Clear selection"><AdminIcon name="close" className="h-4 w-4" /></button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
