'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { deleteCategory, moveCategory, saveCategory } from '@/app/admin/(panel)/categories/actions';
import { AdminIcon } from './AdminIcon';
import { MediaField } from './MediaField';
import { Modal } from './Modal';
import { EmptyState } from './ui';
import { toast } from './toast';

export type CategoryRow = { id: number; name: string; slug: string; description: string; image: string; products: number; live: number };
type Draft = { id?: number; name: string; slug: string; description: string; image: string; slugTouched?: boolean };

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 140);

/** The tile as it shows on the homepage. */
function TilePreview({ d }: { d: Draft }) {
  return (
    <div className="relative mx-auto w-full max-w-[260px] overflow-hidden rounded-xl bg-[#d9d6cf] text-white" style={{ aspectRatio: '4 / 5' }}>
      {d.image
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={d.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
        : <p className="absolute inset-0 grid place-items-center px-6 text-center text-xs text-black/40">Upload a picture to see the tile</p>}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0" />
      <div className="absolute inset-x-0 bottom-0 p-4">
        <p className="font-display text-2xl uppercase leading-none">{d.name || 'Category'}</p>
        <p className="mt-1 text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-white/75">Shop now</p>
      </div>
    </div>
  );
}

export function CategoryManager({ categories }: { categories: CategoryRow[] }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<{ field?: string; message: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const set = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const act = (fn: () => Promise<{ ok: boolean; message: string }>) => start(async () => { const r = await fn(); toast(r.message, r.ok ? 'ok' : 'warn'); router.refresh(); });
  const open = (d: Draft) => { setDraft(d); setError(null); };
  const original = draft?.id ? categories.find((c) => c.id === draft.id) : undefined;

  const save = () => {
    if (!draft) return;
    const { id, name, slug, description, image } = draft;
    start(async () => {
      const r = await saveCategory({ id, name, slug, description, image });
      if (!r.ok) { setError({ field: r.field, message: r.message }); return; }
      toast(r.message);
      setDraft(null);
      router.refresh();
    });
  };
  const err = (f: string) => (error?.field === f ? <p className="mt-1.5 text-xs text-red-600">{error.message}</p> : null);

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink/55">{categories.length} {categories.length === 1 ? 'category' : 'categories'} · shown in this order on the homepage</p>
        <button type="button" onClick={() => open({ name: '', slug: '', description: '', image: '' })} className="abtn abtn-primary"><AdminIcon name="plus" className="h-4 w-4" /> Add category</button>
      </div>

      <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <AnimatePresence initial={false}>
          {categories.map((c, i) => (
            <motion.li key={c.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ type: 'spring', stiffness: 380, damping: 34 }}
              className="admin-card flex gap-3 p-3">
              <button type="button" onClick={() => open({ ...c, slugTouched: true })} className="group relative w-24 shrink-0 overflow-hidden rounded-xl bg-black/[0.06]" style={{ aspectRatio: '4 / 5' }} aria-label={`Change the picture for ${c.name}`}>
                {c.image
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={c.image} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  : <span className="grid h-full place-items-center text-ink/30"><AdminIcon name="slides" className="h-6 w-6" /></span>}
                {!c.image && <span className="absolute inset-x-1 bottom-1 rounded-md bg-amber-100 px-1 py-0.5 text-center text-[0.6rem] font-semibold text-amber-800">No picture</span>}
              </button>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start gap-2">
                  <span className="font-display text-lg leading-none text-ink/25">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{c.name}</p>
                    <p className="truncate text-xs text-ink/45">/collections/{c.slug}</p>
                  </div>
                </div>
                <p className="mt-1.5 text-xs text-ink/55">{c.products ? `${c.live} live · ${c.products} product${c.products === 1 ? '' : 's'} in total` : 'No products yet'}</p>
                <div className="mt-auto flex items-center gap-1 pt-2">
                  <button type="button" disabled={pending || i === 0} onClick={() => act(() => moveCategory(c.id, -1))} className="rounded-lg p-1.5 text-ink/50 hover:bg-black/[0.05] hover:text-ink disabled:opacity-25" aria-label={`Move ${c.name} up`}><AdminIcon name="arrow-up" className="h-4 w-4" /></button>
                  <button type="button" disabled={pending || i === categories.length - 1} onClick={() => act(() => moveCategory(c.id, 1))} className="rounded-lg p-1.5 text-ink/50 hover:bg-black/[0.05] hover:text-ink disabled:opacity-25" aria-label={`Move ${c.name} down`}><AdminIcon name="arrow-down" className="h-4 w-4" /></button>
                  <button type="button" onClick={() => open({ ...c, slugTouched: true })} className="abtn abtn-outline abtn-sm ml-auto">Edit</button>
                  <button type="button" disabled={pending}
                    onClick={() => (c.products ? toast(`Move the ${c.products} product${c.products === 1 ? '' : 's'} in “${c.name}” to another category first.`, 'warn') : confirm(`Delete the “${c.name}” category?`) && act(() => deleteCategory(c.id)))}
                    className="rounded-lg p-1.5 text-ink/35 hover:bg-red-50 hover:text-red-600" aria-label={`Delete ${c.name}`}><AdminIcon name="trash" className="h-4 w-4" /></button>
                </div>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      {!categories.length && <div className="admin-card mt-4"><EmptyState icon="products" title="No categories yet">Add a category, then put products in it.</EmptyState></div>}

      <Modal open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? 'Edit category' : 'New category'} description="Changes go live in the store when you save." width="max-w-4xl">
        {draft && (
          <form className="grid gap-6 md:grid-cols-[minmax(0,1fr)_260px]" onSubmit={(e) => { e.preventDefault(); save(); }}>
            <div className="space-y-4">
              <div>
                <label className="alabel" htmlFor="c-name">Name</label>
                <input id="c-name" required maxLength={120} value={draft.name} autoFocus={!draft.id} className="ainput" placeholder="Punjabis"
                  onChange={(e) => set({ name: e.target.value, ...(draft.slugTouched ? {} : { slug: slugify(e.target.value) }) })} />
                {err('name')}
              </div>
              <div>
                <label className="alabel" htmlFor="c-slug">Web address</label>
                <div className="flex items-center rounded-xl border border-black/10 bg-white focus-within:border-ink/40">
                  <span className="pl-3 text-sm text-ink/40">/collections/</span>
                  <input id="c-slug" maxLength={140} value={draft.slug} className="min-w-0 flex-1 bg-transparent py-2.5 pr-3 text-sm outline-none" placeholder="punjabis"
                    onChange={(e) => set({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'), slugTouched: true })} onBlur={() => set({ slug: slugify(draft.slug) })} />
                </div>
                {original && slugify(draft.slug) !== original.slug
                  ? <p className="ahint text-amber-700">Links to the old address (/collections/{original.slug}) will stop working.</p>
                  : <p className="ahint">Letters, numbers and dashes.</p>}
                {err('slug')}
              </div>
              <div>
                <label className="alabel" htmlFor="c-desc">Description <span className="font-normal text-ink/40">(optional)</span></label>
                <textarea id="c-desc" rows={3} maxLength={500} value={draft.description} onChange={(e) => set({ description: e.target.value })} className="ainput resize-none" placeholder="Shown at the top of the category page and in search results." />
                {err('description')}
              </div>
              <MediaField id="c-image" kind="image" purpose="category" optional label="Picture" value={draft.image} onChange={(v) => set({ image: v })}
                hint="Portrait (4 : 5), e.g. 1200 × 1500. JPG or WebP under 10 MB. Shown on the homepage tiles." />
              {err('image')}
              {error && !['name', 'slug', 'description', 'image'].includes(error.field ?? '') && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error.message}</p>}
            </div>
            <div className="space-y-3">
              <p className="alabel">Preview</p>
              <TilePreview d={draft} />
            </div>
            <div className="flex justify-end gap-2 md:col-span-2">
              <button type="button" onClick={() => setDraft(null)} className="abtn abtn-ghost">Cancel</button>
              <button className="abtn abtn-primary" disabled={pending}>{pending ? 'Saving…' : draft.id ? 'Save category' : 'Add category'}</button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
