'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useState, useTransition } from 'react';
import { adjustStockAction } from '@/app/admin/(panel)/inventory/actions';
import type { AdjustMode } from '@/lib/inventory';
import { AdminIcon } from './AdminIcon';
import { Modal } from './Modal';
import { StatusBadge } from './StatusBadge';
import { EmptyState } from './ui';
import { toast } from './toast';

export type InventoryRow = {
  id: number; productId: number; title: string; variant: string; sku: string; image: string | null;
  stock: number; cost: string | null; costRaw: number; price: string; value: string | null; state: 'IN_STOCK' | 'LOW' | 'OUT';
};

const MODES: { key: AdjustMode; label: string; help: string; icon: string }[] = [
  { key: 'RESTOCK', label: 'Restock', help: 'New units arrived from your supplier.', icon: 'plus' },
  { key: 'DAMAGE', label: 'Remove', help: 'Damaged, lost or used as a sample.', icon: 'minus' },
  { key: 'COUNT', label: 'Stock count', help: 'You counted the shelf: set the exact number.', icon: 'check' },
];

function AdjustForm({ row, canCost, onDone }: { row: InventoryRow; canCost: boolean; onDone: () => void }) {
  const [mode, setMode] = useState<AdjustMode>('RESTOCK');
  const [qty, setQty] = useState('');
  const [cost, setCost] = useState('');
  const [note, setNote] = useState('');
  const [pending, start] = useTransition();
  const router = useRouter();
  const n = Number(qty);
  const after = qty === '' || !Number.isFinite(n) ? null : mode === 'RESTOCK' ? row.stock + n : mode === 'DAMAGE' ? row.stock - n : n;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await adjustStockAction({ variantId: row.id, mode, quantity: Math.trunc(n), unitCostTaka: mode === 'RESTOCK' ? cost : undefined, note });
          toast(res.message, res.ok ? 'ok' : 'warn');
          if (res.ok) { onDone(); router.refresh(); }
        });
      }}
    >
      <div className="grid grid-cols-3 gap-2">
        {MODES.map((m) => (
          <button key={m.key} type="button" onClick={() => setMode(m.key)}
            className={`flex flex-col items-center gap-1 rounded-2xl border p-3 text-sm font-medium transition ${mode === m.key ? 'border-ink bg-ink text-white' : 'border-black/10 hover:border-black/25'}`}>
            <AdminIcon name={m.icon} className="h-4 w-4" />{m.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-ink/55">{MODES.find((m) => m.key === mode)!.help}</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="alabel" htmlFor="qty">{mode === 'COUNT' ? 'Units on the shelf' : 'Units'}</label>
          <input id="qty" type="number" min={0} step={1} required autoFocus value={qty} onChange={(e) => setQty(e.target.value)} className="ainput text-lg font-semibold" />
        </div>
        <div className="rounded-2xl bg-[#f7f7f4] p-3 text-sm">
          <p className="text-xs text-ink/50">Stock now → after</p>
          <p className="mt-1 text-lg font-semibold tabular">{row.stock} <span className="text-ink/30">→</span> <span className={after !== null && after < 0 ? 'text-red-600' : ''}>{after ?? '…'}</span></p>
        </div>
      </div>
      {mode === 'RESTOCK' && canCost && (
        <div>
          <label className="alabel" htmlFor="cost">Purchase price per unit (৳, optional)</label>
          <input id="cost" type="number" min={0} step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} placeholder={row.cost ? `Current cost ${row.cost}` : 'e.g. 420'} className="ainput" />
          <p className="ahint">The item’s cost becomes the average of old and new units, so profit stays accurate.</p>
        </div>
      )}
      <div>
        <label className="alabel" htmlFor="note">Note (optional)</label>
        <input id="note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={255} placeholder={mode === 'RESTOCK' ? 'Supplier, invoice no.' : 'What happened'} className="ainput" />
      </div>
      <button className="abtn abtn-primary w-full py-3" disabled={pending || qty === '' || (after !== null && after < 0)}>{pending ? 'Saving…' : 'Save stock change'}</button>
    </form>
  );
}

export function InventoryTable({ rows, canCost, canProducts }: { rows: InventoryRow[]; canCost: boolean; canProducts: boolean }) {
  const [active, setActive] = useState<InventoryRow | null>(null);
  const maxStock = Math.max(10, ...rows.map((r) => r.stock));
  return (
    <>
      <div className="overflow-x-auto">
        <table className="admin-table">
          <thead>
            <tr><th>Product</th><th>SKU</th>{canCost && <th className="text-right">Cost</th>}<th className="text-right">Price</th><th className="w-48">In stock</th>{canCost && <th className="text-right">Stock value</th>}<th /></tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <motion.tr key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i, 20) * 0.015 }}>
                <td>
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {r.image ? <img src={r.image} alt="" className="h-11 w-9 rounded-lg object-cover" /> : <span className="h-11 w-9 rounded-lg bg-[#f4f4f1]" />}
                    <div className="min-w-0">
                      {canProducts ? <Link href={`/admin/products/${r.productId}`} className="font-medium hover:underline">{r.title}</Link> : <span className="font-medium">{r.title}</span>}
                      <p className="text-xs text-ink/45">{r.variant}</p>
                    </div>
                  </div>
                </td>
                <td className="text-xs text-ink/50">{r.sku || '—'}</td>
                {canCost && <td className={`text-right tabular ${r.costRaw ? '' : 'text-amber-600'}`}>{r.costRaw ? r.cost : 'Not set'}</td>}
                <td className="text-right tabular">{r.price}</td>
                <td>
                  <div className="flex items-center gap-3">
                    <span className="w-10 text-right text-base font-semibold tabular">{r.stock}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/[0.05]">
                      <motion.div className={`h-full rounded-full ${r.state === 'OUT' ? 'bg-red-500' : r.state === 'LOW' ? 'bg-amber-500' : 'bg-emerald-500'}`}
                        initial={{ width: 0 }} animate={{ width: `${Math.max(r.stock > 0 ? 4 : 0, (r.stock / maxStock) * 100)}%` }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} />
                    </div>
                  </div>
                  {r.state !== 'IN_STOCK' && <div className="mt-1 pl-[3.25rem]"><StatusBadge status={r.state} /></div>}
                </td>
                {canCost && <td className="text-right tabular text-ink/70">{r.value}</td>}
                <td className="text-right"><button type="button" onClick={() => setActive(r)} className="abtn abtn-sm abtn-outline">Adjust</button></td>
              </motion.tr>
            ))}
            {!rows.length && <tr><td colSpan={7}><EmptyState icon="inventory" title="Nothing here">No items match this filter.</EmptyState></td></tr>}
          </tbody>
        </table>
      </div>
      <Modal open={!!active} onClose={() => setActive(null)} title={active ? `Adjust stock · ${active.title}` : ''} description={active?.variant}>
        {active && <AdjustForm row={active} canCost={canCost} onDone={() => setActive(null)} />}
      </Modal>
    </>
  );
}
