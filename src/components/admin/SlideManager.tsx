'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { deleteSlide, moveSlide, saveSlide, setSlideActive, type SlideInput } from '@/app/admin/(panel)/homepage/actions';
import { AdminIcon } from './AdminIcon';
import { Modal } from './Modal';
import { EmptyState } from './ui';
import { toast } from './toast';

export type SlideRow = {
  id: number; sortOrder: number; isActive: boolean; mediaType: 'IMAGE' | 'VIDEO'; mediaUrl: string; mobileMediaUrl: string | null; posterUrl: string | null;
  eyebrow: string; heading: string; text: string; ctaLabel: string; ctaHref: string; cta2Label: string; cta2Href: string;
};
type Draft = Omit<SlideRow, 'id' | 'sortOrder' | 'mobileMediaUrl' | 'posterUrl'> & { id?: number; mobileMediaUrl: string; posterUrl: string };
type Kind = 'image' | 'video';

const LIMIT_MB: Record<Kind, number> = { image: 10, video: 60 };
const ACCEPT: Record<Kind, string> = { image: 'image/jpeg,image/png,image/webp', video: 'video/mp4,video/webm' };
const EMPTY: Draft = {
  isActive: true, mediaType: 'IMAGE', mediaUrl: '', mobileMediaUrl: '', posterUrl: '',
  eyebrow: '', heading: '', text: '', ctaLabel: 'Shop now', ctaHref: '/collections/all', cta2Label: '', cta2Href: '',
};

/** Sends the file as the request body so a big video shows real upload progress. */
function upload(file: File, onProgress: (p: number) => void): Promise<{ url?: string; error?: string }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/admin/upload');
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.setRequestHeader('X-Upload', 'slider');
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      let data: { url?: string; error?: string } = {};
      try { data = JSON.parse(xhr.responseText); } catch { /* not JSON: e.g. the hosting rejected a big upload */ }
      if (xhr.status === 200 && data.url) resolve({ url: data.url });
      else if (xhr.status === 413) resolve({ error: data.error || 'This file is too big for your hosting to accept. Make the video shorter or smaller, or upload it elsewhere and paste the link.' });
      else resolve({ error: data.error || 'Upload failed. Please try again.' });
    };
    xhr.onerror = () => resolve({ error: 'Upload failed. Check your internet connection and try again.' });
    xhr.send(file);
  });
}

function MediaPreview({ url, kind, poster, className = '' }: { url: string; kind: Kind; poster?: string; className?: string }) {
  if (!url) return null;
  return kind === 'video'
    ? <video src={url} poster={poster || undefined} muted loop playsInline autoPlay className={`h-full w-full object-cover ${className}`} />
    // eslint-disable-next-line @next/next/no-img-element
    : <img src={url} alt="" className={`h-full w-full object-cover ${className}`} />;
}

/** Upload (button or drag & drop) or paste a link, with progress and a preview. */
function MediaField({ id, label, hint, kind, value, onChange, optional }: {
  id: string; label: string; hint: React.ReactNode; kind: Kind; value: string; onChange: (url: string) => void; optional?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [over, setOver] = useState(false);
  const [linkMode, setLinkMode] = useState(false);

  const take = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    if (!ACCEPT[kind].split(',').includes(file.type)) {
      setError(kind === 'video'
        ? (/quicktime|mov/i.test(file.type) || /\.mov$/i.test(file.name) ? 'iPhone .MOV videos need converting to MP4 first (e.g. with CapCut or an online converter).' : 'Use an MP4 or WebM video.')
        : 'Use a JPG, PNG or WebP picture.');
      return;
    }
    if (file.size > LIMIT_MB[kind] * 1024 * 1024) { setError(`This ${kind === 'video' ? 'video' : 'picture'} is ${(file.size / 1024 / 1024).toFixed(0)} MB; the limit is ${LIMIT_MB[kind]} MB.`); return; }
    setProgress(0);
    const r = await upload(file, setProgress);
    setProgress(null);
    if (r.url) { onChange(r.url); toast(`${kind === 'video' ? 'Video' : 'Picture'} uploaded`); } else setError(r.error ?? 'Upload failed.');
  };

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label className="alabel mb-0" htmlFor={id}>{label}{optional && <span className="ml-1 font-normal text-ink/40">optional</span>}</label>
        <button type="button" onClick={() => setLinkMode((v) => !v)} className="text-xs font-medium text-ink/50 hover:text-ink">{linkMode ? 'Upload a file instead' : 'Paste a link instead'}</button>
      </div>
      {linkMode ? (
        <input id={id} value={value} onChange={(e) => onChange(e.target.value.trim())} className="ainput font-mono text-xs" placeholder={kind === 'video' ? 'https://…/video.mp4' : 'https://…/picture.jpg'} />
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); void take(e.dataTransfer.files[0]); }}
          className={`relative flex items-center gap-3 rounded-xl border border-dashed p-2.5 transition ${over ? 'border-ink bg-accent/20' : 'border-black/15 bg-[#fafaf8]'}`}
        >
          <div className="grid h-16 w-28 shrink-0 place-items-center overflow-hidden rounded-lg bg-black/[0.06]">
            {value ? <MediaPreview url={value} kind={kind} /> : <AdminIcon name={kind === 'video' ? 'video' : 'slides'} className="h-5 w-5 text-ink/35" />}
          </div>
          <div className="min-w-0 flex-1 text-xs">
            {progress !== null ? (
              <>
                <p className="font-medium">Uploading… {Math.round(progress * 100)}%</p>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/[0.07]"><div className="h-full rounded-full bg-ink transition-[width]" style={{ width: `${progress * 100}%` }} /></div>
              </>
            ) : (
              <>
                <p className="truncate font-medium text-ink/70">{value ? value.split('/').pop() : `Drop a ${kind === 'video' ? 'video' : 'picture'} here`}</p>
                <p className="mt-0.5 text-ink/45">{hint}</p>
              </>
            )}
          </div>
          <div className="flex shrink-0 gap-1">
            <button type="button" disabled={progress !== null} onClick={() => input.current?.click()} className="abtn abtn-outline abtn-sm">{value ? 'Replace' : 'Upload'}</button>
            {value && optional && <button type="button" onClick={() => onChange('')} className="abtn abtn-ghost abtn-sm" aria-label={`Remove ${label}`}><AdminIcon name="trash" className="h-3.5 w-3.5" /></button>}
          </div>
          <input ref={input} id={id} type="file" accept={ACCEPT[kind]} className="sr-only" onChange={(e) => { void take(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
      )}
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  );
}

/** The slide as it will look on the homepage, scaled down. */
function SlidePreview({ d, phone }: { d: Draft; phone: boolean }) {
  const kind: Kind = d.mediaType === 'VIDEO' ? 'video' : 'image';
  const url = (phone && d.mobileMediaUrl) || d.mediaUrl;
  return (
    <div className={`relative mx-auto overflow-hidden rounded-xl bg-[#0b0b0c] text-[#f3f1ec] ${phone ? 'aspect-[9/16] w-48' : 'aspect-video w-full'}`}>
      {url && <MediaPreview url={url} kind={kind} poster={d.posterUrl} className="absolute inset-0" />}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgb(0 0 0 / .25) 0%, transparent 30%, transparent 45%, rgb(0 0 0 / .55) 100%)' }} />
      <div className={`absolute inset-x-0 bottom-0 ${phone ? 'p-3' : 'p-5'}`}>
        {d.eyebrow && <p className="mb-1.5 inline-flex items-center gap-1.5 text-[0.55rem] font-semibold uppercase tracking-[0.2em]"><span className="h-1.5 w-1.5 rounded-full bg-accent" />{d.eyebrow}</p>}
        {d.heading && <p className={`font-display uppercase leading-[0.9] ${phone ? 'text-2xl' : 'text-4xl'}`}>{d.heading.split('\n').map((l, i) => <span key={i} className="block">{l}</span>)}</p>}
        {d.text && <p className="mt-1.5 line-clamp-2 max-w-xs text-[0.6rem] opacity-85">{d.text}</p>}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {d.ctaLabel && <span className="bg-accent px-2 py-1 text-[0.5rem] font-bold uppercase tracking-[0.15em] text-[#0b0b0c]">{d.ctaLabel} →</span>}
          {d.cta2Label && <span className="border border-white/50 px-2 py-1 text-[0.5rem] font-bold uppercase tracking-[0.15em]">{d.cta2Label}</span>}
        </div>
      </div>
      {!url && <p className="absolute inset-0 grid place-items-center text-xs text-white/50">Upload a {kind === 'video' ? 'video' : 'picture'} to see the preview</p>}
    </div>
  );
}

export function SlideManager({ slides, links }: { slides: SlideRow[]; links: { label: string; href: string }[] }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<{ field?: string; message: string } | null>(null);
  const [phonePreview, setPhonePreview] = useState(false);
  const [shown, setShown] = useState<Record<number, boolean>>({}); // Show/hide switches flip at once, before the server confirms
  const [pending, start] = useTransition();
  const router = useRouter();
  const set = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const act = (fn: () => Promise<{ ok: boolean; message: string }>) => start(async () => { const r = await fn(); toast(r.message, r.ok ? 'ok' : 'warn'); router.refresh(); });
  const open = (d: Draft) => { setDraft(d); setError(null); setPhonePreview(false); };

  const save = () => {
    if (!draft) return;
    if (!draft.mediaUrl) { setError({ field: 'mediaUrl', message: `Upload the ${draft.mediaType === 'VIDEO' ? 'video' : 'picture'} first.` }); return; }
    const input: SlideInput = { ...draft };
    start(async () => {
      const r = await saveSlide(input);
      if (!r.ok) { setError({ field: r.field, message: r.message }); return; }
      toast(r.message);
      setDraft(null);
      router.refresh();
    });
  };
  const err = (f: string) => (error?.field === f ? <p className="mt-1.5 text-xs text-red-600">{error.message}</p> : null);
  const kind: Kind = draft?.mediaType === 'VIDEO' ? 'video' : 'image';

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink/55">{slides.filter((s) => s.isActive).length} of {slides.length} slides showing · they play in this order</p>
        <button type="button" onClick={() => open({ ...EMPTY })} className="abtn abtn-primary"><AdminIcon name="plus" className="h-4 w-4" /> Add slide</button>
      </div>

      <ul className="mt-4 space-y-3">
        <AnimatePresence initial={false}>
          {slides.map((s, i) => {
            const k: Kind = s.mediaType === 'VIDEO' ? 'video' : 'image';
            return (
              <motion.li key={s.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                className={`admin-card flex flex-col gap-4 p-3 sm:flex-row sm:items-center ${(shown[s.id] ?? s.isActive) ? '' : 'opacity-60'}`}>
                <div className="flex items-center gap-3">
                  <span className="w-6 text-center font-display text-xl text-ink/30">{i + 1}</span>
                  <div className="relative aspect-video w-44 shrink-0 overflow-hidden rounded-xl bg-black/[0.06]">
                    <MediaPreview url={s.mediaUrl} kind={k} poster={s.posterUrl ?? undefined} />
                    <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[0.6rem] font-semibold text-white">
                      <AdminIcon name={k === 'video' ? 'video' : 'slides'} className="h-3 w-3" /> {k === 'video' ? 'Video' : 'Picture'}
                    </span>
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  {s.eyebrow && <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-ink/45">{s.eyebrow}</p>}
                  <p className="truncate font-display text-xl uppercase leading-tight">{s.heading.replace(/\n/g, ' ') || <span className="font-sans text-sm normal-case text-ink/40">No heading</span>}</p>
                  <p className="mt-0.5 truncate text-xs text-ink/50">{[s.ctaLabel && `${s.ctaLabel} → ${s.ctaHref}`, s.mobileMediaUrl && 'Phone version', !s.isActive && 'Hidden'].filter(Boolean).join(' · ') || 'No buttons'}</p>
                </div>
                <div className="flex items-center gap-1 self-end sm:self-auto">
                  <button type="button" disabled={pending || i === 0} onClick={() => act(() => moveSlide(s.id, -1))} className="rounded-lg p-2 text-ink/50 hover:bg-black/[0.05] hover:text-ink disabled:opacity-25" aria-label="Move up"><AdminIcon name="arrow-up" className="h-4 w-4" /></button>
                  <button type="button" disabled={pending || i === slides.length - 1} onClick={() => act(() => moveSlide(s.id, 1))} className="rounded-lg p-2 text-ink/50 hover:bg-black/[0.05] hover:text-ink disabled:opacity-25" aria-label="Move down"><AdminIcon name="arrow-down" className="h-4 w-4" /></button>
                  <label className="mx-2 flex cursor-pointer items-center gap-2 text-xs font-medium text-ink/60">
                    <input type="checkbox" className="acheck" checked={shown[s.id] ?? s.isActive}
                      onChange={(e) => { const on = e.target.checked; setShown((m) => ({ ...m, [s.id]: on })); act(() => setSlideActive(s.id, on)); }} /> Show
                  </label>
                  <button type="button" onClick={() => open({ ...s, mobileMediaUrl: s.mobileMediaUrl ?? '', posterUrl: s.posterUrl ?? '' })} className="abtn abtn-outline abtn-sm">Edit</button>
                  <button type="button" disabled={pending} onClick={() => confirm('Delete this slide from the homepage?') && act(() => deleteSlide(s.id))} className="rounded-lg p-2 text-ink/35 hover:bg-red-50 hover:text-red-600" aria-label="Delete slide"><AdminIcon name="trash" className="h-4 w-4" /></button>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
      {!slides.length && <div className="admin-card mt-4"><EmptyState icon="slides" title="No slides yet">Add a picture or video to show at the top of your homepage.</EmptyState></div>}

      <Modal open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? 'Edit slide' : 'New slide'} description="Changes go live on the homepage when you save." width="max-w-5xl">
        {draft && (
          <form className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" onSubmit={(e) => { e.preventDefault(); save(); }}>
            <div className="space-y-4">
              <div className="seg w-full">
                {(['IMAGE', 'VIDEO'] as const).map((t) => (
                  <button key={t} type="button" className="flex-1" aria-current={draft.mediaType === t ? 'true' : undefined}
                    onClick={() => t !== draft.mediaType && set({ mediaType: t, mediaUrl: '', mobileMediaUrl: '', posterUrl: '' })}>
                    {t === 'IMAGE' ? 'Picture' : 'Video'}
                  </button>
                ))}
              </div>
              <MediaField key={`main-${kind}`} id="s-media" kind={kind} label={kind === 'video' ? 'Video' : 'Picture'} value={draft.mediaUrl} onChange={(v) => set({ mediaUrl: v })}
                hint={kind === 'video' ? 'MP4, landscape, 10–20 seconds, under 60 MB. Plays without sound.' : 'JPG or WebP, landscape, at least 1920 × 1080, under 10 MB.'} />
              {err('mediaUrl')}
              <MediaField key={`phone-${kind}`} id="s-mobile" kind={kind} optional label={kind === 'video' ? 'Phone video' : 'Phone picture'} value={draft.mobileMediaUrl} onChange={(v) => set({ mobileMediaUrl: v })}
                hint="Portrait (e.g. 1080 × 1350) so it fills a phone screen. Without one, phones show the main one, cropped." />
              {kind === 'video' && (
                <MediaField key="poster" id="s-poster" kind="image" optional label="Cover picture" value={draft.posterUrl} onChange={(v) => set({ posterUrl: v })}
                  hint="Shown while the video loads, and to visitors who turn off animations." />
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div><label className="alabel" htmlFor="s-eyebrow">Small label</label><input id="s-eyebrow" maxLength={80} value={draft.eyebrow} onChange={(e) => set({ eyebrow: e.target.value })} className="ainput" placeholder="New season" /></div>
                <div>
                  <label className="alabel" htmlFor="s-heading">Big heading</label>
                  <textarea id="s-heading" rows={2} maxLength={120} value={draft.heading} onChange={(e) => set({ heading: e.target.value })} className="ainput resize-none font-semibold uppercase" placeholder={'Eid\nCollection'} />
                  <p className="ahint">Press Enter for a new line.</p>
                </div>
              </div>
              <div><label className="alabel" htmlFor="s-text">Text</label><textarea id="s-text" rows={2} maxLength={300} value={draft.text} onChange={(e) => set({ text: e.target.value })} className="ainput resize-none" placeholder="One or two short sentences." />{err('text')}</div>

              <datalist id="slide-links">{links.map((l) => <option key={l.href} value={l.href}>{l.label}</option>)}</datalist>
              {([['ctaLabel', 'ctaHref', 'Main button'], ['cta2Label', 'cta2Href', 'Second button']] as const).map(([lk, hk, title]) => (
                <div key={lk} className="grid gap-3 sm:grid-cols-2">
                  <div><label className="alabel" htmlFor={`s-${lk}`}>{title} text</label><input id={`s-${lk}`} maxLength={60} value={draft[lk]} onChange={(e) => set({ [lk]: e.target.value })} className="ainput" placeholder={lk === 'ctaLabel' ? 'Shop now' : 'Optional'} />{err(lk)}</div>
                  <div><label className="alabel" htmlFor={`s-${hk}`}>{title} link</label><input id={`s-${hk}`} list="slide-links" maxLength={300} value={draft[hk]} onChange={(e) => set({ [hk]: e.target.value })} className="ainput" placeholder="/collections/punjabis" />{err(hk)}</div>
                </div>
              ))}
              <label className="flex items-center gap-2.5 rounded-xl bg-[#f7f7f4] px-3 py-2.5 text-sm"><input type="checkbox" className="acheck" checked={draft.isActive} onChange={(e) => set({ isActive: e.target.checked })} /> Show this slide on the homepage</label>
            </div>

            <div className="space-y-3 lg:sticky lg:top-0 lg:self-start">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/40">Preview</p>
                <div className="seg">
                  <button type="button" aria-current={!phonePreview ? 'true' : undefined} onClick={() => setPhonePreview(false)}>Computer</button>
                  <button type="button" aria-current={phonePreview ? 'true' : undefined} onClick={() => setPhonePreview(true)}>Phone</button>
                </div>
              </div>
              <SlidePreview d={draft} phone={phonePreview} />
              {error && !['mediaUrl', 'text', 'ctaLabel', 'ctaHref', 'cta2Label', 'cta2Href'].includes(error.field ?? '') && <p className="text-sm text-red-600">{error.message}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setDraft(null)} className="abtn abtn-ghost">Cancel</button>
                <button className="abtn abtn-primary" disabled={pending}>{pending ? 'Saving…' : draft.id ? 'Save slide' : 'Add slide'}</button>
              </div>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
