'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Drawer } from '@/components/layout/Header';
import { Icon } from '@/components/ui/Icon';
import { SORTS } from '@/lib/catalog-shared';
import { Swatch } from './Swatch';

type Facets = { sizes: string[]; colors: string[]; maxPrice: number };
type Active = { sizes: string[]; colors: string[]; min?: string; max?: string };

export function CollectionToolbar({ facets, count, sort, active }: { facets: Facets; count: number; sort: string; active: Active }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<Active>(active);
  const activeCount = active.sizes.length + active.colors.length + (active.min || active.max ? 1 : 0);

  const push = (next: Active, nextSort = sort) => {
    const q = new URLSearchParams();
    next.sizes.forEach((s) => q.append('size', s));
    next.colors.forEach((c) => q.append('color', c));
    if (next.min) q.set('min', next.min);
    if (next.max) q.set('max', next.max);
    if (nextSort && nextSort !== 'featured') q.set('sort', nextSort);
    startTransition(() => router.push(`${pathname}${q.toString() ? `?${q}` : ''}`, { scroll: false }));
  };
  const toggle = (key: 'sizes' | 'colors', v: string) => {
    const next = { ...draft, [key]: draft[key].includes(v) ? draft[key].filter((x) => x !== v) : [...draft[key], v] };
    setDraft(next);
    push(next);
  };

  return (
    <>
      <div className="sticky top-0 z-30 -mx-4 mb-8 flex items-center justify-between gap-4 border-b border-ink/10 bg-paper/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10 2xl:-mx-12 2xl:px-12">
        <button className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em]" onClick={() => setOpen(true)}>
          <Icon name="filter" /> Filter
          {activeCount > 0 && <span className="grid h-5 min-w-[1.25rem] place-items-center rounded-full bg-ink px-1 text-[0.65rem] text-paper">{activeCount}</span>}
        </button>
        <p className={`hidden text-xs text-muted transition-opacity md:block ${pending ? 'opacity-40' : ''}`}>{count} {count === 1 ? 'product' : 'products'}</p>
        <div className="flex items-center gap-2">
          <label htmlFor="sort" className="hidden text-xs font-semibold uppercase tracking-[0.18em] sm:block">Sort by</label>
          <select id="sort" aria-label="Sort by" value={sort} onChange={(e) => push(active, e.target.value)} className="form-select border-0 bg-transparent py-1 pl-2 pr-8 text-xs font-semibold uppercase tracking-wider focus:ring-0">
            {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      {activeCount > 0 && (
        <div className="-mt-4 mb-8 flex flex-wrap items-center gap-2">
          {active.sizes.map((s) => <Chip key={`s${s}`} label={`Size: ${s}`} onClick={() => toggle('sizes', s)} />)}
          {active.colors.map((c) => <Chip key={`c${c}`} label={`Color: ${c}`} onClick={() => toggle('colors', c)} />)}
          {(active.min || active.max) && <Chip label={`৳${active.min || 0}–${active.max || '∞'}`} onClick={() => { const n = { ...draft, min: undefined, max: undefined }; setDraft(n); push(n); }} />}
          <button className="link-underline ml-2 text-xs font-semibold uppercase tracking-wider" onClick={() => { const n = { sizes: [], colors: [] }; setDraft(n); push(n); }}>Clear all</button>
        </div>
      )}

      <Drawer open={open} onClose={() => setOpen(false)} side="left" label="Filters" className="inset-y-0 left-0 w-full max-w-sm bg-paper">
        <div className="flex items-center justify-between border-b border-ink/10 px-6 py-5">
          <p className="font-display text-2xl uppercase">Filter</p>
          <button className="-mr-2 p-2" onClick={() => setOpen(false)} aria-label="Close filters"><Icon name="close" className="h-6 w-6" /></button>
        </div>
        <div className="flex-1 space-y-8 overflow-y-auto px-6 py-6">
          {facets.sizes.length > 0 && (
            <fieldset>
              <legend className="mb-3 text-xs font-semibold uppercase tracking-[0.18em]">Size</legend>
              <div className="flex flex-wrap gap-2">
                {facets.sizes.map((s) => <button key={s} className="option-pill" aria-pressed={draft.sizes.includes(s)} onClick={() => toggle('sizes', s)}>{s}</button>)}
              </div>
            </fieldset>
          )}
          {facets.colors.length > 0 && (
            <fieldset>
              <legend className="mb-3 text-xs font-semibold uppercase tracking-[0.18em]">Color</legend>
              <ul className="space-y-3">
                {facets.colors.map((c) => (
                  <li key={c}>
                    <label className="flex cursor-pointer items-center gap-3 text-sm">
                      <input type="checkbox" className="checkbox" checked={draft.colors.includes(c)} onChange={() => toggle('colors', c)} />
                      <Swatch name={c} /> {c}
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          )}
          <fieldset>
            <legend className="mb-3 text-xs font-semibold uppercase tracking-[0.18em]">Price (৳)</legend>
            <form className="flex items-end gap-3" onSubmit={(e) => { e.preventDefault(); push(draft); }}>
              <label className="flex-1 text-xs text-muted">From<input type="number" min={0} className="field mt-1" value={draft.min ?? ''} onChange={(e) => setDraft({ ...draft, min: e.target.value || undefined })} placeholder="0" /></label>
              <label className="flex-1 text-xs text-muted">To<input type="number" min={0} className="field mt-1" value={draft.max ?? ''} onChange={(e) => setDraft({ ...draft, max: e.target.value || undefined })} placeholder={String(Math.ceil(facets.maxPrice / 100))} /></label>
              <button className="btn btn-outline px-4 py-3.5">Go</button>
            </form>
          </fieldset>
        </div>
        <div className="grid grid-cols-2 gap-3 border-t border-ink/10 p-6">
          <button className="btn btn-outline" onClick={() => { const n = { sizes: [], colors: [] }; setDraft(n); push(n); }}>Clear all</button>
          <button className="btn btn-primary" onClick={() => setOpen(false)}>Show {count}</button>
        </div>
      </Drawer>
    </>
  );
}

function Chip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2 border border-ink/20 px-3 py-1.5 text-xs transition-colors hover:border-ink">
      {label} <Icon name="close" className="h-3 w-3" />
    </button>
  );
}
