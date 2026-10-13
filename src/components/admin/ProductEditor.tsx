'use client';

import { useState, useTransition } from 'react';
import { saveProduct, uploadImage, deleteProduct } from '@/app/admin/(panel)/products/actions';
import { AdminIcon } from './AdminIcon';

type Variant = { id?: number; color: string; size: string; sku: string; stock: number; cost: string };
type Img = { url: string; alt: string };
type Initial = {
  id: number | null; title: string; slug: string; categoryId: number | ''; price: string; compareAt: string;
  description: string; details: string; tags: string; isActive: boolean; isFeatured: boolean; variants: Variant[]; images: Img[];
};

export function ProductEditor({ initial, categories, canCost }: { initial: Initial; categories: { id: number; name: string }[]; canCost: boolean }) {
  const [p, setP] = useState(initial);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [pending, start] = useTransition();
  const set = <K extends keyof Initial>(k: K, v: Initial[K]) => setP((x) => ({ ...x, [k]: v }));
  const setVar = (i: number, patch: Partial<Variant>) => set('variants', p.variants.map((v, j) => (j === i ? { ...v, ...patch } : v)));
  const totalStock = p.variants.reduce((s, v) => s + (Number(v.stock) || 0), 0);
  const costs = p.variants.map((v) => Number(v.cost)).filter((c) => c > 0);
  const avgCost = costs.length ? costs.reduce((a, b) => a + b, 0) / costs.length : 0;
  const price = Number(p.price) || 0;
  const margin = price && avgCost ? (price - avgCost) / price : null;

  async function onUpload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true); setError('');
    const added: Img[] = [];
    for (const f of Array.from(files)) {
      // Checked here too: hosts like Vercel reject large request bodies before the server sees them.
      if (f.size > 4 * 1024 * 1024) { setError(`${f.name} is larger than 4 MB. Please resize it.`); break; }
      const fd = new FormData(); fd.set('file', f);
      const r = await uploadImage(fd);
      if (r.error) { setError(r.error); break; }
      if (r.url) added.push({ url: r.url, alt: p.title });
    }
    setP((x) => ({ ...x, images: [...x.images, ...added] }));
    setUploading(false);
  }

  function addSizeRun(sizes: string[]) {
    const last = p.variants.at(-1);
    set('variants', [...p.variants.filter((v) => v.color || v.size || v.stock), ...sizes.map((s) => ({ color: last?.color ?? '', size: s, sku: '', stock: 0, cost: last?.cost ?? '' }))]);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    start(async () => {
      const res = await saveProduct(p.id, {
        ...p,
        compareAt: p.compareAt === '' ? '' : p.compareAt,
        variants: p.variants.map((v) => ({ ...v, stock: Number(v.stock) || 0, ...(canCost ? {} : { cost: undefined }) })),
      });
      if (res?.error) setError(res.error);
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-6 xl:grid-cols-3 [&>*]:min-w-0">
      <div className="space-y-6 xl:col-span-2">
        {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 ring-1 ring-inset ring-red-200" role="alert">{error}</p>}
        <section className="admin-card space-y-4">
          <div><label className="alabel" htmlFor="title">Product name</label><input id="title" className="ainput text-base" value={p.title} onChange={(e) => set('title', e.target.value)} required /></div>
          <div><label className="alabel" htmlFor="description">Description</label><textarea id="description" rows={5} className="atextarea" value={p.description} onChange={(e) => set('description', e.target.value)} placeholder="Fabric, fit and what makes it good. Basic HTML like <p> and <strong> is allowed." /></div>
          <div><label className="alabel" htmlFor="details">Details & care</label><textarea id="details" rows={3} className="atextarea" value={p.details} onChange={(e) => set('details', e.target.value)} /></div>
        </section>

        <section className="admin-card">
          <h2 className="admin-card-title mb-4">Photos</h2>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {p.images.map((im, i) => (
              <div key={im.url + i} className="group relative overflow-hidden rounded-xl bg-[#f4f4f1]" style={{ aspectRatio: '4 / 5' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={im.url} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                <div className="absolute inset-x-1 bottom-1 flex justify-between rounded-lg bg-ink/75 p-1 text-[0.65rem] text-white opacity-0 backdrop-blur transition group-hover:opacity-100 group-focus-within:opacity-100">
                  <button type="button" disabled={i === 0} onClick={() => { const a = [...p.images]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; set('images', a); }} className="px-1.5 disabled:opacity-30" aria-label="Move left">←</button>
                  <button type="button" onClick={() => set('images', p.images.filter((_, j) => j !== i))} className="px-1.5">Remove</button>
                  <button type="button" disabled={i === p.images.length - 1} onClick={() => { const a = [...p.images]; [a[i + 1], a[i]] = [a[i], a[i + 1]]; set('images', a); }} className="px-1.5 disabled:opacity-30" aria-label="Move right">→</button>
                </div>
                {i === 0 && <span className="absolute left-1.5 top-1.5 rounded-md bg-accent px-1.5 text-[0.6rem] font-semibold">Main</span>}
              </div>
            ))}
            <label className="grid cursor-pointer place-items-center rounded-xl border-2 border-dashed border-black/15 text-center text-xs text-ink/50 transition hover:border-ink hover:text-ink" style={{ aspectRatio: '4 / 5' }}>
              <span className="flex flex-col items-center gap-1"><AdminIcon name="plus" className="h-5 w-5" />{uploading ? 'Uploading…' : 'Add photos'}</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => onUpload(e.target.files)} />
            </label>
          </div>
          <p className="ahint">JPG, PNG or WebP, up to 4 MB each. Portrait 4:5 photos (e.g. 1200 × 1500) look best. The first photo is the main one.</p>
        </section>

        <section className="admin-card p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 pb-3 pt-5">
            <div>
              <h2 className="admin-card-title">Sizes, colours & stock</h2>
              <p className="mt-0.5 text-xs text-ink/50">{totalStock} units in total{canCost ? ' · cost is what you pay per unit' : ''}</p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-ink/45">Quick add:</span>
              {[['S–XXL', ['S', 'M', 'L', 'XL', 'XXL']], ['28–36', ['28', '30', '32', '34', '36']], ['EU 39–44', ['39', '40', '41', '42', '43', '44']]].map(([l, sizes]) => (
                <button key={l as string} type="button" className="abtn abtn-sm abtn-outline" onClick={() => addSizeRun(sizes as string[])}>{l as string}</button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead><tr><th>Colour</th><th>Size</th><th>SKU</th>{canCost && <th>Cost (৳)</th>}<th>Stock</th><th /></tr></thead>
              <tbody>
                {p.variants.map((v, i) => (
                  <tr key={i}>
                    <td><input aria-label="Colour" className="ainput py-2" value={v.color} onChange={(e) => setVar(i, { color: e.target.value })} placeholder="e.g. Black" /></td>
                    <td><input aria-label="Size" className="ainput w-24 py-2" value={v.size} onChange={(e) => setVar(i, { size: e.target.value })} placeholder="e.g. M" /></td>
                    <td><input aria-label="SKU" className="ainput py-2" value={v.sku} onChange={(e) => setVar(i, { sku: e.target.value })} /></td>
                    {canCost && <td><input aria-label="Cost per unit" type="number" min={0} step="0.01" className="ainput w-28 py-2" value={v.cost} onChange={(e) => setVar(i, { cost: e.target.value })} placeholder="0" /></td>}
                    <td><input aria-label="Stock" type="number" min={0} className="ainput w-24 py-2" value={v.stock} onChange={(e) => setVar(i, { stock: Number(e.target.value) })} /></td>
                    <td className="text-right"><button type="button" className="rounded-lg p-2 text-ink/40 transition hover:bg-red-50 hover:text-red-600" onClick={() => set('variants', p.variants.filter((_, j) => j !== i))} aria-label="Remove row"><AdminIcon name="trash" className="h-4 w-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 pb-5 pt-3">
            <button type="button" className="abtn abtn-outline" onClick={() => set('variants', [...p.variants, { color: p.variants.at(-1)?.color ?? '', size: '', sku: '', stock: 0, cost: p.variants.at(-1)?.cost ?? '' }])}><AdminIcon name="plus" className="h-4 w-4" /> Add row</button>
            <p className="text-xs text-ink/45">One-size items (wallets): keep one row with colour and size empty. Stock changes are saved to the stock history.</p>
          </div>
        </section>
      </div>

      <div className="space-y-6">
        <section className="admin-card space-y-4 xl:sticky xl:top-24">
          <label className="flex items-center justify-between gap-2 rounded-xl bg-[#f7f7f4] px-3 py-2.5 text-sm"><span>Visible in store</span><input type="checkbox" className="acheck" checked={p.isActive} onChange={(e) => set('isActive', e.target.checked)} /></label>
          <label className="flex items-center justify-between gap-2 rounded-xl bg-[#f7f7f4] px-3 py-2.5 text-sm"><span>Show in Best sellers</span><input type="checkbox" className="acheck" checked={p.isFeatured} onChange={(e) => set('isFeatured', e.target.checked)} /></label>
          <div>
            <label className="alabel" htmlFor="cat">Category</label>
            <select id="cat" className="aselect" value={p.categoryId} onChange={(e) => set('categoryId', Number(e.target.value))} required>
              <option value="">Choose…</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="alabel" htmlFor="price">Price (৳)</label><input id="price" type="number" min={1} step="1" className="ainput" value={p.price} onChange={(e) => set('price', e.target.value)} required /></div>
            <div><label className="alabel" htmlFor="compare">Was (৳)</label><input id="compare" type="number" min={0} step="1" className="ainput" value={p.compareAt} onChange={(e) => set('compareAt', e.target.value)} placeholder="optional" /></div>
          </div>
          {canCost && (
            <div className="rounded-xl border border-black/[0.06] p-3 text-sm">
              <div className="flex justify-between"><span className="text-ink/55">Average cost</span><span className="font-medium tabular">{avgCost ? `৳${Math.round(avgCost).toLocaleString()}` : 'Not set'}</span></div>
              <div className="mt-1 flex justify-between"><span className="text-ink/55">Margin</span><span className={`font-semibold tabular ${margin !== null && margin < 0.2 ? 'text-amber-600' : 'text-emerald-700'}`}>{margin === null ? '—' : `${(margin * 100).toFixed(1)}%`}</span></div>
            </div>
          )}
          <div><label className="alabel" htmlFor="tags">Tags</label><input id="tags" className="ainput" value={p.tags} onChange={(e) => set('tags', e.target.value)} placeholder="new, eid" /><p className="ahint">Add “new” to show the product in New in.</p></div>
          <div><label className="alabel" htmlFor="slug">URL name</label><input id="slug" className="ainput" value={p.slug} onChange={(e) => set('slug', e.target.value)} placeholder="made from the name" /></div>
          <button className="abtn abtn-primary w-full py-3" disabled={pending || uploading}>{pending ? 'Saving…' : 'Save product'}</button>
          {p.slug && p.id && <a href={`/products/${p.slug}`} target="_blank" className="flex items-center justify-center gap-1 text-xs text-ink/55 hover:text-ink">View in store <AdminIcon name="external" className="h-3.5 w-3.5" /></a>}
        </section>
        {p.id && (
          <section className="admin-card">
            <h2 className="admin-card-title">Remove product</h2>
            <p className="mb-3 mt-1 text-xs text-ink/50">Products with orders are hidden instead of deleted, so order history stays intact.</p>
            <DeleteButton id={p.id} />
          </section>
        )}
      </div>
    </form>
  );
}

function DeleteButton({ id }: { id: number }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  if (!confirm) return <button type="button" className="abtn abtn-outline w-full text-red-600 hover:border-red-200 hover:bg-red-50" onClick={() => setConfirm(true)}><AdminIcon name="trash" className="h-4 w-4" /> Delete product</button>;
  return (
    <div className="flex gap-2">
      <button type="button" className="abtn abtn-danger w-full" disabled={pending} onClick={() => start(() => deleteProduct(id))}>{pending ? 'Deleting…' : 'Yes, delete'}</button>
      <button type="button" className="abtn abtn-outline w-full" onClick={() => setConfirm(false)}>Keep</button>
    </div>
  );
}
