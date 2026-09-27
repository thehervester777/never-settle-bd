'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';

type Chart = { title: string; head: string[]; rows: string[][]; note: string };

export function SizeTabs({ charts }: { charts: Chart[] }) {
  const [i, setI] = useState(0);
  const c = charts[i];
  return (
    <>
      <div className="mt-10 flex flex-wrap gap-2" role="tablist" aria-label="Size charts">
        {charts.map((ch, idx) => (
          <button
            key={ch.title} role="tab" aria-selected={idx === i}
            onClick={() => setI(idx)}
            onKeyDown={(e) => { if (e.key === 'ArrowRight') setI((idx + 1) % charts.length); if (e.key === 'ArrowLeft') setI((idx - 1 + charts.length) % charts.length); }}
            className={`border px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] transition-colors ${idx === i ? 'border-ink bg-ink text-paper' : 'border-ink/20 hover:border-ink'}`}
          >{ch.title}</button>
        ))}
      </div>
      <motion.div key={c.title} role="tabpanel" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="mt-8">
        <div className="overflow-x-auto border border-ink/15">
          <table className="w-full min-w-[32rem] border-collapse text-left text-sm tabular-nums">
            <thead className="bg-ink text-paper"><tr>{c.head.map((h) => <th key={h} scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em]">{h}</th>)}</tr></thead>
            <tbody>{c.rows.map((r) => <tr key={r[0]} className="border-t border-ink/10 odd:bg-bone/50">{r.map((cell, ci) => ci === 0 ? <th key={ci} scope="row" className="px-4 py-3 font-semibold">{cell}</th> : <td key={ci} className="px-4 py-3">{cell}</td>)}</tr>)}</tbody>
          </table>
        </div>
        {c.note && <p className="mt-4 text-sm text-muted">{c.note}</p>}
      </motion.div>
    </>
  );
}
