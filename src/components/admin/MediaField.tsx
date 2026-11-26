'use client';

import { useRef, useState } from 'react';
import { AdminIcon } from './AdminIcon';
import { toast } from './toast';

/* Picture / video upload used by the homepage slider and categories. */

export type Kind = 'image' | 'video';
/** What the upload is for; the server checks the matching permission (slider: settings, category: products). */
export type UploadPurpose = 'slider' | 'category';

const LIMIT_MB: Record<Kind, number> = { image: 10, video: 60 };
const ACCEPT: Record<Kind, string> = { image: 'image/jpeg,image/png,image/webp', video: 'video/mp4,video/webm' };

/** Sends the file as the request body so a big video shows real upload progress. */
export function upload(file: File, onProgress: (p: number) => void, purpose: UploadPurpose = 'slider'): Promise<{ url?: string; error?: string }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/admin/upload');
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.setRequestHeader('X-Upload', purpose);
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

export function MediaPreview({ url, kind, poster, className = '' }: { url: string; kind: Kind; poster?: string; className?: string }) {
  if (!url) return null;
  return kind === 'video'
    ? <video src={url} poster={poster || undefined} muted loop playsInline autoPlay className={`h-full w-full object-cover ${className}`} />
    // eslint-disable-next-line @next/next/no-img-element
    : <img src={url} alt="" className={`h-full w-full object-cover ${className}`} />;
}

/** Upload (button or drag & drop) or paste a link, with progress and a preview. */
export function MediaField({ id, label, hint, kind, value, onChange, optional, purpose = 'slider' }: {
  id: string; label: string; hint: React.ReactNode; kind: Kind; value: string; onChange: (url: string) => void; optional?: boolean; purpose?: UploadPurpose;
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
    const r = await upload(file, setProgress, purpose);
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
