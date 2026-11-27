'use client';

import { useMemo, useState } from 'react';
import { AdminIcon } from './AdminIcon';

export type PickProduct = { id: number; title: string; categoryId: number; isActive: boolean; price: number; image: string };
type Cat = { id: number; name: string };

const taka = (poisha: number) => `৳${Math.round(poisha / 100).toLocaleString('en-US')}`;

/**
 * Tick the products that belong in this category. A product is always in exactly one category, so
 * unticking one that's in this category asks where it should go instead.
 */
export function ProductPicker({ products, categories, categoryId, members, moveTo, onChange }: {
  products: PickProduct[];
  categories: Cat[];
  categoryId?: number;
  members: number[];
  moveTo: Record<number, number>;
  onChange: (members: number[], moveTo: Record<number, number>) => void;
}) {
  const [q, setQ] = useState('');
  const [show, setShow] = useState<'all' | 'in' | 'out'>('all');
  const picked = useMemo(() => new Set(members), [members]);
  const others = categories.filter((c) => c.id !== categoryId);
  const name = (id: number) => categories.find((c) => c.id === id)?.name ?? 'another category';

  const list = products.filter((p) => {
    if (q && !p.title.toLowerCase().includes(q.trim().toLowerCase())) return false;
    // Products moving out stay under "In it" until saved, so their "Move to" choice stays in view.
    const leaving = p.categoryId === categoryId && !picked.has(p.id);
    if (show === 'in') return picked.has(p.id) || leaving;
    if (show === 'out') return !picked.has(p.id) && !leaving;
    return true;
  });

  const toggle = (p: PickProduct) => {
    const isOriginal = p.categoryId === categoryId;
    if (picked.has(p.id)) {
      if (isOriginal && !others.length) return; // nowhere else to put it
      const next = members.filter((id) => id !== p.id);
      onChange(next, isOriginal ? { ...moveTo, [p.id]: moveTo[p.id] ?? others[0].id } : moveTo);
    } else {
      const { [p.id]: _, ...rest } = moveTo;
      onChange([...members, p.id], rest);
    }
  };
  const allShown = list.length > 0 && list.every((p) => picked.has(p.id));
  const tickAllShown = () => {
    if (allShown) return;
    const add = list.filter((p) => !picked.has(p.id)).map((p) => p.id);
    const rest = { ...moveTo };
    for (const id of add) delete rest[id];
    onChange([...members, ...add], rest);
  };

  const added = members.filter((id) => products.find((p) => p.id === id)?.categoryId !== categoryId).length;
  const leaving = Object.keys(moveTo).length;

  return (
    <div className="rounded-2xl border border-black/[0.08]" data-product-picker>
      <div className="flex flex-wrap items-center gap-2 border-b border-black/[0.06] p-3">
        <div className="relative min-w-[12rem] flex-1">
          <AdminIcon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" aria-label="Search products" className="ainput pl-9" />
        </div>
        <div className="seg">
          {([['all', 'All'], ['in', `In it (${members.length})`], ['out', 'Not in it']] as const).map(([k, l]) => (
            <button key={k} type="button" aria-current={show === k ? 'true' : undefined} onClick={() => setShow(k)}>{l}</button>
          ))}
        </div>
        <button type="button" onClick={tickAllShown} disabled={allShown} className="abtn abtn-outline abtn-sm">Tick all shown</button>
      </div>

      <ul data-lenis-prevent className="max-h-80 divide-y divide-black/[0.05] overflow-y-auto overscroll-contain">
        {list.map((p) => {
          const on = picked.has(p.id);
          const isOriginal = p.categoryId === categoryId;
          const locked = on && isOriginal && !others.length;
          return (
            <li key={p.id} className={`flex flex-wrap items-center gap-3 px-3 py-2 ${on ? 'bg-[#f7f7f4]' : ''}`}>
              <label className={`flex min-w-0 flex-1 items-center gap-3 ${locked ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                <input type="checkbox" className="acheck" checked={on} disabled={locked} onChange={() => toggle(p)} aria-label={p.title} />
                <span className="h-10 w-8 shrink-0 overflow-hidden rounded-md bg-black/[0.06]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.image && <img src={p.image} alt="" loading="lazy" className="h-full w-full object-cover" />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{p.title}</span>
                  <span className="block truncate text-xs text-ink/50">
                    {taka(p.price)}{!p.isActive && ' · hidden'}
                    {!isOriginal && (on ? <span className="text-emerald-700"> · moving here from {name(p.categoryId)}</span> : ` · in ${name(p.categoryId)}`)}
                  </span>
                </span>
              </label>
              {isOriginal && !on && (
                <label className="flex items-center gap-1.5 whitespace-nowrap text-xs text-amber-800">
                  Move to
                  <select className="aselect h-8 py-0 text-xs" value={moveTo[p.id] ?? others[0]?.id} onChange={(e) => onChange(members, { ...moveTo, [p.id]: Number(e.target.value) })} aria-label={`Move ${p.title} to`}>
                    {others.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
              )}
            </li>
          );
        })}
        {!list.length && <li className="px-3 py-8 text-center text-sm text-ink/50">{products.length ? 'No products match.' : 'No products yet. Add products first, then pick them here.'}</li>}
      </ul>

      <p className="border-t border-black/[0.06] px-3 py-2 text-xs text-ink/55">
        {members.length} product{members.length === 1 ? '' : 's'} in this category
        {added > 0 && <span className="text-emerald-700"> · {added} being added</span>}
        {leaving > 0 && <span className="text-amber-800"> · {leaving} moving out</span>}
        {!others.length && categoryId !== undefined && ' · this is your only category, so its products stay here'}
      </p>
    </div>
  );
}

