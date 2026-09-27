'use client';

import { useState, useTransition } from 'react';
import { saveProduct, uploadImage, deleteProduct } from '@/app/admin/(panel)/products/actions';

type Variant = { id?: number; color: string; size: string; sku: string; stock: number };
type Img = { url: string; alt: string };
type Initial = {
  id: number | null; title: string; slug: string; categoryId: number | ''; price: string; compareAt: string;
  description: string; details: string; tags: string; isActive: boolean; isFeatured: boolean; variants: Variant[]; images: Img[];
};

export function ProductEditor({ initial, categories }: { initial: Initial; categories: { id: number; name: string }[] }) {
  const [p, setP] = useState(initial);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [pending, start] = useTransition();
  const set = <K extends keyof Initial>(k: K, v: Initial[K]) => setP((x) => ({ ...x, [k]: v }));
  const setVar = (i: number, patch: Partial<Variant>) => set('variants', p.variants.map((v, j) => (j === i ? { ...v, ...patch } : v)));

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
    const color = p.variants[0]?.color ?? '';
    set('variants', [...p.variants.filter((v) => v.color || v.size || v.stock), ...sizes.map((s) => ({ color, size: s, sku: '', stock: 0 }))]);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    start(async () => {
      const res = await saveProduct(p.id, {
        ...p,
        categoryId: p.categoryId,
        compareAt: p.compareAt === '' ? '' : p.compareAt,
        variants: p.variants.map((v) => ({ ...v, stock: Number(v.stock) || 0 })),
      });
      if (res?.error) setError(res.error);
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-6 xl:grid-cols-3 [&>*]:min-w-0">
      <div className="space-y-6 xl:col-span-2">
        {error && <p className="bg-red-100 p-3 text-sm text-red-900" role="alert">{error}</p>}
        <section className="admin-card space-y-4">
          <div><label className="label" htmlFor="title">Name</label><input id="title" className="field bg-white" value={p.title} onChange={(e) => set('title', e.target.value)} required /></div>
          <div><label className="label" htmlFor="description">Description</label><textarea id="description" rows={5} className="field-area bg-white" value={p.description} onChange={(e) => set('description', e.target.value)} placeholder="Fabric, fit and what makes it good. Basic HTML like <p> and <strong> is allowed." /></div>
          <div><label className="label" htmlFor="details">Details & care</label><textarea id="details" rows={3} className="field-area bg-white" value={p.details} onChange={(e) => set('details', e.target.value)} /></div>
        </section>

        <section className="admin-card">
          <h2 className="mb-3 font-semibold">Photos</h2>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {p.images.map((im, i) => (
              <div key={im.url + i} className="group relative bg-bone" style={{ aspectRatio: '4 / 5' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={im.url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 flex justify-between bg-ink/70 p-1 text-[0.65rem] text-paper">
                  <button type="button" disabled={i === 0} onClick={() => { const a = [...p.images]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; set('images', a); }} className="px-1 disabled:opacity-30">←</button>
                  <button type="button" onClick={() => set('images', p.images.filter((_, j) => j !== i))} className="px-1">Remove</button>
                  <button type="button" disabled={i === p.images.length - 1} onClick={() => { const a = [...p.images]; [a[i + 1], a[i]] = [a[i], a[i + 1]]; set('images', a); }} className="px-1 disabled:opacity-30">→</button>
                </div>
                {i === 0 && <span className="absolute left-1 top-1 bg-accent px-1.5 text-[0.6rem] font-semibold">Main</span>}
              </div>
            ))}
            <label className="grid cursor-pointer place-items-center border-2 border-dashed border-ink/20 text-center text-xs text-muted hover:border-ink" style={{ aspectRatio: '4 / 5' }}>
              {uploading ? 'Uploading…' : '+ Add photos'}
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => onUpload(e.target.files)} />
            </label>
          </div>
          <p className="mt-2 text-xs text-muted">JPG, PNG or WebP, up to 4 MB each. Portrait 4:5 photos (e.g. 1200 × 1500) look best. The first photo is the main one.</p>
        </section>

        <section className="admin-card">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Colors, sizes & stock</h2>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="text-muted">Add sizes:</span>
              <button type="button" className="underline" onClick={() => addSizeRun(['S', 'M', 'L', 'XL', 'XXL'])}>S–XXL</button>
              <button type="button" className="underline" onClick={() => addSizeRun(['28', '30', '32', '34', '36'])}>28–36</button>
              <button type="button" className="underline" onClick={() => addSizeRun(['39', '40', '41', '42', '43', '44'])}>EU 39–44</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead><tr><th>Color</th><th>Size</th><th>SKU</th><th>Stock</th><th /></tr></thead>
              <tbody>
                {p.variants.map((v, i) => (
                  <tr key={i}>
                    <td><input aria-label="Color" className="field bg-white py-2" value={v.color} onChange={(e) => setVar(i, { color: e.target.value })} placeholder="e.g. Black" /></td>
                    <td><input aria-label="Size" className="field bg-white py-2" value={v.size} onChange={(e) => setVar(i, { size: e.target.value })} placeholder="e.g. M" /></td>
                    <td><input aria-label="SKU" className="field bg-white py-2" value={v.sku} onChange={(e) => setVar(i, { sku: e.target.value })} /></td>
                    <td><input aria-label="Stock" type="number" min={0} className="field w-24 bg-white py-2" value={v.stock} onChange={(e) => setVar(i, { stock: Number(e.target.value) })} /></td>
                    <td><button type="button" className="text-xs underline" onClick={() => set('variants', p.variants.filter((_, j) => j !== i))}>Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" className="btn btn-outline mt-3 py-2" onClick={() => set('variants', [...p.variants, { color: p.variants.at(-1)?.color ?? '', size: '', sku: '', stock: 0 }])}>Add row</button>
          <p className="mt-2 text-xs text-muted">Wallets and other one-size items: keep one row with color and size empty.</p>
        </section>
      </div>

      <div className="space-y-6">
        <section className="admin-card space-y-4">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="checkbox" checked={p.isActive} onChange={(e) => set('isActive', e.target.checked)} /> Visible in store</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="checkbox" checked={p.isFeatured} onChange={(e) => set('isFeatured', e.target.checked)} /> Show in Best sellers</label>
          <div>
            <label className="label" htmlFor="cat">Category</label>
            <select id="cat" className="field-select bg-white" value={p.categoryId} onChange={(e) => set('categoryId', Number(e.target.value))} required>
              <option value="">Choose…</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label" htmlFor="price">Price (৳)</label><input id="price" type="number" min={1} step="1" className="field bg-white" value={p.price} onChange={(e) => set('price', e.target.value)} required /></div>
            <div><label className="label" htmlFor="compare">Was (৳)</label><input id="compare" type="number" min={0} step="1" className="field bg-white" value={p.compareAt} onChange={(e) => set('compareAt', e.target.value)} placeholder="optional" /></div>
          </div>
          <div><label className="label" htmlFor="tags">Tags</label><input id="tags" className="field bg-white" value={p.tags} onChange={(e) => set('tags', e.target.value)} placeholder="new, eid" /><p className="mt-1 text-xs text-muted">Add “new” to show the product in New in.</p></div>
          <div><label className="label" htmlFor="slug">URL name</label><input id="slug" className="field bg-white" value={p.slug} onChange={(e) => set('slug', e.target.value)} placeholder="made from the name" /></div>
          <button className="btn btn-primary w-full" disabled={pending || uploading}>{pending ? 'Saving…' : 'Save product'}</button>
          {p.slug && p.id && <a href={`/products/${p.slug}`} target="_blank" className="block text-center text-xs underline">View in store ↗</a>}
        </section>
        {p.id && (
          <section className="admin-card">
            <h2 className="mb-2 font-semibold">Remove product</h2>
            <p className="mb-3 text-xs text-muted">Products with orders are hidden instead of deleted, so order history stays intact.</p>
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
  if (!confirm) return <button type="button" className="btn btn-outline w-full py-2 text-sale" onClick={() => setConfirm(true)}>Delete product</button>;
  return (
    <div className="flex gap-2">
      <button type="button" className="btn w-full bg-sale py-2 text-paper" disabled={pending} onClick={() => start(() => deleteProduct(id))}>{pending ? 'Deleting…' : 'Yes, delete'}</button>
      <button type="button" className="btn btn-outline w-full py-2" onClick={() => setConfirm(false)}>Keep</button>
    </div>
  );
}
