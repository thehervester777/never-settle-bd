'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useMemo, useState, useTransition } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  addAdSpend, deleteAdSpend, deleteCoupon, saveCoupon, saveTracking, setCouponActive, testConversionsApi, type CouponInput, type TrackingState,
} from '@/app/admin/(panel)/marketing/actions';
import { AdminIcon } from './AdminIcon';
import { Modal } from './Modal';
import { StatusBadge } from './StatusBadge';
import { EmptyState } from './ui';
import { toast } from './toast';

async function copy(text: string, what = 'Copied') {
  try { await navigator.clipboard.writeText(text); toast(what); } catch { window.prompt('Copy this:', text); }
}

/* ---------------------------------------------------------------- Copy field */

export function CopyField({ value, label, mono = true }: { value: string; label?: string; mono?: boolean }) {
  return (
    <div>
      {label && <p className="alabel">{label}</p>}
      <div className="flex items-stretch gap-2">
        <input readOnly value={value} onFocus={(e) => e.currentTarget.select()} className={`ainput min-w-0 flex-1 bg-[#fafaf8] ${mono ? 'font-mono text-xs' : ''}`} />
        <button type="button" onClick={() => copy(value)} className="abtn abtn-outline shrink-0"><AdminIcon name="copy" className="h-4 w-4" /> Copy</button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Ad spend */

export function AdSpendForm({ platforms, today }: { platforms: { key: string; label: string }[]; today: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const [form, setForm] = useState({ spentOn: today, platform: platforms[0].key, amount: '', note: '' });
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await addAdSpend(form);
          toast(r.message, r.ok ? 'ok' : 'warn');
          if (r.ok) { setForm((f) => ({ ...f, amount: '', note: '' })); router.refresh(); }
        });
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <div><label className="alabel" htmlFor="spend-date">Date</label><input id="spend-date" type="date" required max={today} value={form.spentOn} onChange={(e) => setForm({ ...form, spentOn: e.target.value })} className="ainput" /></div>
        <div><label className="alabel" htmlFor="spend-amount">Amount (৳)</label><input id="spend-amount" type="number" min="1" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="ainput font-semibold" placeholder="0" /></div>
      </div>
      <div>
        <label className="alabel" htmlFor="spend-platform">Platform</label>
        <select id="spend-platform" value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} className="aselect">
          {platforms.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
      </div>
      <div><label className="alabel" htmlFor="spend-note">Campaign / note</label><input id="spend-note" maxLength={200} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="ainput" placeholder="e.g. Eid collection, week 2" /></div>
      <button className="abtn abtn-primary w-full py-2.5" disabled={pending}><AdminIcon name="plus" className="h-4 w-4" /> {pending ? 'Saving…' : 'Log ad spend'}</button>
      <p className="ahint">Copy the amount from Ads Manager’s billing. It’s also counted in Profit &amp; loss under “Marketing &amp; ads”.</p>
    </form>
  );
}

export function DeleteAdSpend({ id }: { id: number }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button" disabled={pending} aria-label="Delete this ad spend"
      onClick={() => confirm('Delete this ad spend entry?') && start(async () => { const r = await deleteAdSpend(id); toast(r.message, r.ok ? 'ok' : 'warn'); router.refresh(); })}
      className="rounded-lg p-1.5 text-ink/35 transition hover:bg-red-50 hover:text-red-600"
    >
      <AdminIcon name="trash" className="h-4 w-4" />
    </button>
  );
}

/* ---------------------------------------------------------------- Discount codes */

export type CouponRow = {
  id: number; code: string; description: string; type: 'PERCENT' | 'FIXED' | 'FREE_SHIPPING'; value: number; minSubtotal: number; maxDiscount: number | null;
  usageLimit: number | null; usedCount: number; oncePerCustomer: boolean; startsAt: string | null; endsAt: string | null; isActive: boolean;
  state: string; summary: string; window: string; orders: number; sales: string; discountGiven: string;
};

/** ISO instant → value for <input type="datetime-local"> in Dhaka time. */
const toLocal = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() + 6 * 3600_000).toISOString().slice(0, 16) : '');
const randomCode = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');

type Draft = { id?: number; code: string; description: string; type: CouponRow['type']; value: string; minSubtotal: string; maxDiscount: string; usageLimit: string; oncePerCustomer: boolean; startsAt: string; endsAt: string; isActive: boolean };
const EMPTY: Draft = { code: '', description: '', type: 'PERCENT', value: '10', minSubtotal: '', maxDiscount: '', usageLimit: '', oncePerCustomer: false, startsAt: '', endsAt: '', isActive: true };

function fromRow(c: CouponRow): Draft {
  return {
    id: c.id, code: c.code, description: c.description, type: c.type,
    value: c.type === 'FIXED' ? String(c.value / 100) : c.type === 'PERCENT' ? String(c.value) : '',
    minSubtotal: c.minSubtotal ? String(c.minSubtotal / 100) : '', maxDiscount: c.maxDiscount ? String(c.maxDiscount / 100) : '',
    usageLimit: c.usageLimit ? String(c.usageLimit) : '', oncePerCustomer: c.oncePerCustomer, startsAt: toLocal(c.startsAt), endsAt: toLocal(c.endsAt), isActive: c.isActive,
  };
}

export function CouponManager({ coupons, site }: { coupons: CouponRow[]; site: string }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<{ field?: string; message: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const shareLink = (code: string) => `${site}/?code=${encodeURIComponent(code)}`;

  const open = (d: Draft) => { setDraft(d); setError(null); };
  const set = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const save = () => {
    if (!draft) return;
    const input: CouponInput = {
      id: draft.id, code: draft.code, description: draft.description, type: draft.type,
      value: Number(draft.value) || 0, minSubtotal: Number(draft.minSubtotal) || 0,
      maxDiscount: draft.maxDiscount ? Number(draft.maxDiscount) : null, usageLimit: draft.usageLimit ? Number(draft.usageLimit) : null,
      oncePerCustomer: draft.oncePerCustomer, startsAt: draft.startsAt || undefined, endsAt: draft.endsAt || undefined, isActive: draft.isActive,
    };
    start(async () => {
      const r = await saveCoupon(input);
      if (!r.ok) { setError({ field: r.field, message: r.message }); return; }
      toast(r.message);
      setDraft(null);
      router.refresh();
    });
  };
  const act = (fn: () => Promise<{ ok: boolean; message: string }>) => start(async () => { const r = await fn(); toast(r.message, r.ok ? 'ok' : 'warn'); router.refresh(); });

  const preview = useMemo(() => {
    if (!draft) return '';
    const n = Number(draft.value) || 0, min = Number(draft.minSubtotal) || 0, cap = Number(draft.maxDiscount) || 0;
    const main = draft.type === 'PERCENT' ? `${n}% off${cap ? ` (up to ৳${cap.toLocaleString()})` : ''}` : draft.type === 'FIXED' ? `৳${n.toLocaleString()} off` : 'Free delivery';
    return `${main}${min ? ` on orders over ৳${min.toLocaleString()}` : ''}`;
  }, [draft]);

  const err = (f: string) => (error?.field === f ? <p className="mt-1.5 text-xs text-red-600">{error.message}</p> : null);

  return (
    <>
      <div className="flex justify-end">
        <button type="button" onClick={() => open({ ...EMPTY, code: randomCode() })} className="abtn abtn-primary"><AdminIcon name="plus" className="h-4 w-4" /> New discount code</button>
      </div>

      <section className="admin-card mt-4 p-0">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead><tr><th>Code</th><th>Offer</th><th>Status</th><th className="text-right">Used</th><th className="text-right">Orders</th><th className="text-right">Sales</th><th className="text-right">Discount given</th><th>Valid</th><th className="w-36" /></tr></thead>
            <tbody>
              {coupons.map((c, i) => (
                <motion.tr key={c.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: Math.min(i, 12) * 0.03 }}>
                  <td>
                    <button type="button" onClick={() => copy(c.code, `${c.code} copied`)} className="rounded-lg bg-[#f4f4f1] px-2 py-1 font-mono text-xs font-semibold tracking-wider hover:bg-black/10" title="Copy code">{c.code}</button>
                    {c.description && <p className="mt-1 max-w-[14rem] truncate text-xs text-ink/45">{c.description}</p>}
                  </td>
                  <td className="text-sm">{c.summary}{c.oncePerCustomer && <p className="text-xs text-ink/45">Once per customer</p>}</td>
                  <td><StatusBadge status={c.state} /></td>
                  <td className="text-right tabular">{c.usedCount}{c.usageLimit ? <span className="text-ink/40"> / {c.usageLimit}</span> : ''}</td>
                  <td className="text-right tabular">{c.orders ? <a className="hover:underline" href={`/admin/orders?coupon=${encodeURIComponent(c.code)}`}>{c.orders}</a> : 0}</td>
                  <td className="text-right font-medium tabular">{c.sales}</td>
                  <td className="text-right tabular text-ink/60">{c.discountGiven}</td>
                  <td className="whitespace-nowrap text-xs text-ink/55">{c.window}</td>
                  <td>
                    <div className="flex justify-end gap-0.5">
                      <button type="button" onClick={() => copy(shareLink(c.code), 'Share link copied: the code applies itself at checkout')} className="rounded-lg p-1.5 text-ink/45 hover:bg-black/[0.05] hover:text-ink" title="Copy share link" aria-label={`Copy share link for ${c.code}`}><AdminIcon name="link" className="h-4 w-4" /></button>
                      <button type="button" onClick={() => open(fromRow(c))} className="rounded-lg p-1.5 text-ink/45 hover:bg-black/[0.05] hover:text-ink" title="Edit" aria-label={`Edit ${c.code}`}><AdminIcon name="note" className="h-4 w-4" /></button>
                      <button type="button" disabled={pending} onClick={() => act(() => setCouponActive(c.id, !c.isActive))} className="rounded-lg p-1.5 text-ink/45 hover:bg-black/[0.05] hover:text-ink" title={c.isActive ? 'Pause' : 'Turn on'} aria-label={c.isActive ? `Pause ${c.code}` : `Turn on ${c.code}`}><AdminIcon name={c.isActive ? 'lock' : 'refresh'} className="h-4 w-4" /></button>
                      <button type="button" disabled={pending} onClick={() => confirm(`Delete ${c.code}? Orders that used it keep their discount.`) && act(() => deleteCoupon(c.id))} className="rounded-lg p-1.5 text-ink/35 hover:bg-red-50 hover:text-red-600" title="Delete" aria-label={`Delete ${c.code}`}><AdminIcon name="trash" className="h-4 w-4" /></button>
                    </div>
                  </td>
                </motion.tr>
              ))}
              {!coupons.length && (
                <tr><td colSpan={9}><EmptyState icon="ticket" title="No discount codes yet">Create one for your next campaign, e.g. EID20 for 20% off. Share it as a link and it applies itself at checkout.</EmptyState></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Modal open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? `Edit ${draft.code}` : 'New discount code'} description="Shoppers type the code at checkout, or open your share link and it applies itself." width="max-w-xl">
        {draft && (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
            <div>
              <label className="alabel" htmlFor="c-code">Code</label>
              <div className="flex gap-2">
                <input id="c-code" required value={draft.code} onChange={(e) => set({ code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') })} maxLength={40} className="ainput flex-1 font-mono font-semibold tracking-wider" placeholder="EID20" />
                <button type="button" onClick={() => set({ code: randomCode() })} className="abtn abtn-outline shrink-0"><AdminIcon name="refresh" className="h-4 w-4" /> Random</button>
              </div>
              {err('code')}
            </div>

            <div>
              <p className="alabel">Discount</p>
              <div className="seg w-full">
                {([['PERCENT', 'Percentage'], ['FIXED', 'Fixed amount'], ['FREE_SHIPPING', 'Free delivery']] as const).map(([t, l]) => (
                  <button key={t} type="button" aria-current={draft.type === t ? 'true' : undefined} onClick={() => set({ type: t, value: t === 'PERCENT' ? '10' : t === 'FIXED' ? '100' : '' })} className="flex-1">{l}</button>
                ))}
              </div>
            </div>

            <AnimatePresence initial={false} mode="popLayout">
              {draft.type !== 'FREE_SHIPPING' && (
                <motion.div key={draft.type} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="alabel" htmlFor="c-value">{draft.type === 'PERCENT' ? 'Percent off' : 'Amount off (৳)'}</label>
                    <input id="c-value" type="number" min={draft.type === 'PERCENT' ? 1 : 1} max={draft.type === 'PERCENT' ? 100 : undefined} step={draft.type === 'PERCENT' ? 1 : 0.01} required value={draft.value} onChange={(e) => set({ value: e.target.value })} className="ainput font-semibold" />
                    {err('value')}
                  </div>
                  {draft.type === 'PERCENT' && (
                    <div>
                      <label className="alabel" htmlFor="c-max">Maximum discount (৳)</label>
                      <input id="c-max" type="number" min={0} step={0.01} value={draft.maxDiscount} onChange={(e) => set({ maxDiscount: e.target.value })} className="ainput" placeholder="No limit" />
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="alabel" htmlFor="c-min">Minimum order (৳)</label>
                <input id="c-min" type="number" min={0} step={0.01} value={draft.minSubtotal} onChange={(e) => set({ minSubtotal: e.target.value })} className="ainput" placeholder="Any order" />
                <p className="ahint">Products only, before delivery.</p>
              </div>
              <div>
                <label className="alabel" htmlFor="c-limit">Total uses</label>
                <input id="c-limit" type="number" min={0} step={1} value={draft.usageLimit} onChange={(e) => set({ usageLimit: e.target.value })} className="ainput" placeholder="Unlimited" />
                <p className="ahint">e.g. 100 for “first 100 orders”.</p>
              </div>
              <div>
                <label className="alabel" htmlFor="c-start">Starts</label>
                <input id="c-start" type="datetime-local" value={draft.startsAt} onChange={(e) => set({ startsAt: e.target.value })} className="ainput" />
              </div>
              <div>
                <label className="alabel" htmlFor="c-end">Ends</label>
                <input id="c-end" type="datetime-local" value={draft.endsAt} onChange={(e) => set({ endsAt: e.target.value })} className="ainput" />
                {err('endsAt')}
              </div>
            </div>
            <p className="-mt-2 text-xs text-ink/45">Times are Bangladesh time. Leave empty to start now and never expire.</p>

            <div><label className="alabel" htmlFor="c-desc">Internal note</label><input id="c-desc" maxLength={160} value={draft.description} onChange={(e) => set({ description: e.target.value })} className="ainput" placeholder="e.g. Eid Instagram campaign" /></div>

            <div className="space-y-2 rounded-xl bg-[#f7f7f4] p-3 text-sm">
              <label className="flex items-center gap-2.5"><input type="checkbox" className="acheck" checked={draft.oncePerCustomer} onChange={(e) => set({ oncePerCustomer: e.target.checked })} /> Once per customer (by phone number)</label>
              <label className="flex items-center gap-2.5"><input type="checkbox" className="acheck" checked={draft.isActive} onChange={(e) => set({ isActive: e.target.checked })} /> Live (shoppers can use it)</label>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-black/10 px-3 py-2.5 text-sm">
              <span className="text-ink/55">Shoppers see</span>
              <span className="font-medium">{draft.code || 'CODE'} · {preview}</span>
            </div>

            {error && !error.field && <p className="text-sm text-red-600">{error.message}</p>}
            {error?.field && !['code', 'value', 'endsAt'].includes(error.field) && <p className="text-sm text-red-600">{error.message}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDraft(null)} className="abtn abtn-ghost">Cancel</button>
              <button className="abtn abtn-primary" disabled={pending}>{pending ? 'Saving…' : draft.id ? 'Save changes' : 'Create code'}</button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}

/* ---------------------------------------------------------------- Conversions API test */

export function TestCapiButton({ disabled }: { disabled: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button" disabled={disabled || pending} className="abtn abtn-outline"
      onClick={() => start(async () => { const r = await testConversionsApi(); toast(r.message, r.ok ? 'ok' : 'warn'); router.refresh(); })}
    >
      <AdminIcon name="sparkle" className="h-4 w-4" /> {pending ? 'Sending…' : 'Send test event'}
    </button>
  );
}

/* ---------------------------------------------------------------- Campaign link builder */

const PRESET_SOURCES = [
  ['facebook', 'paid_social', 'Facebook ad'], ['instagram', 'paid_social', 'Instagram ad'], ['instagram', 'bio', 'Instagram bio link'],
  ['instagram', 'story', 'Instagram story'], ['facebook', 'social', 'Facebook post'], ['tiktok', 'paid_social', 'TikTok ad'],
  ['influencer', 'influencer', 'Influencer'], ['whatsapp', 'social', 'WhatsApp broadcast'], ['sms', 'sms', 'SMS'], ['email', 'email', 'Email'],
] as const;

export function LinkBuilder({ site, pages, codes }: { site: string; pages: { label: string; path: string }[]; codes: string[] }) {
  const [preset, setPreset] = useState(0);
  const [page, setPage] = useState(pages[0]?.path ?? '/');
  const [source, setSource] = useState<string>(PRESET_SOURCES[0][0]);
  const [medium, setMedium] = useState<string>(PRESET_SOURCES[0][1]);
  const [campaign, setCampaign] = useState('');
  const [content, setContent] = useState('');
  const [code, setCode] = useState('');

  const slug = (v: string) => v.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_.-]/g, '');
  const url = useMemo(() => {
    const u = new URL(page, site);
    if (source) u.searchParams.set('utm_source', slug(source));
    if (medium) u.searchParams.set('utm_medium', slug(medium));
    if (campaign) u.searchParams.set('utm_campaign', slug(campaign));
    if (content) u.searchParams.set('utm_content', slug(content));
    if (code) u.searchParams.set('code', code);
    return u.toString();
  }, [site, page, source, medium, campaign, content, code]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3">
        <div>
          <label className="alabel" htmlFor="lb-preset">Where will you post it?</label>
          <select id="lb-preset" className="aselect" value={preset} onChange={(e) => { const i = Number(e.target.value); setPreset(i); setSource(PRESET_SOURCES[i][0]); setMedium(PRESET_SOURCES[i][1]); }}>
            {PRESET_SOURCES.map((p, i) => <option key={p[2]} value={i}>{p[2]}</option>)}
          </select>
        </div>
        <div>
          <label className="alabel" htmlFor="lb-page">Page</label>
          <select id="lb-page" className="aselect" value={page} onChange={(e) => setPage(e.target.value)}>
            {pages.map((p) => <option key={p.path} value={p.path}>{p.label}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="alabel" htmlFor="lb-campaign">Campaign name</label><input id="lb-campaign" className="ainput" value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder="eid_sale_2026" /></div>
          <div><label className="alabel" htmlFor="lb-content">Ad / post name</label><input id="lb-content" className="ainput" value={content} onChange={(e) => setContent(e.target.value)} placeholder="video_1" /></div>
          <div><label className="alabel" htmlFor="lb-source">Source</label><input id="lb-source" className="ainput" value={source} onChange={(e) => setSource(e.target.value)} /></div>
          <div><label className="alabel" htmlFor="lb-medium">Medium</label><input id="lb-medium" className="ainput" value={medium} onChange={(e) => setMedium(e.target.value)} /></div>
        </div>
        <div>
          <label className="alabel" htmlFor="lb-code">Apply a discount code</label>
          <select id="lb-code" className="aselect" value={code} onChange={(e) => setCode(e.target.value)}>
            <option value="">No code</option>
            {codes.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div className="flex flex-col justify-between gap-4 rounded-2xl bg-[#f7f7f4] p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/40">Your link</p>
          <p className="mt-2 break-all font-mono text-xs leading-relaxed">{url}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => copy(url, 'Campaign link copied')} className="abtn abtn-primary"><AdminIcon name="copy" className="h-4 w-4" /> Copy link</button>
          <a href={url} target="_blank" rel="noopener" className="abtn abtn-outline"><AdminIcon name="external" className="h-4 w-4" /> Open</a>
        </div>
        <p className="text-xs text-ink/50">Orders from this link show up under <strong>{slug(source) || '—'}</strong>{campaign ? <> · campaign <strong>{slug(campaign)}</strong></> : ''} in Campaigns &amp; ROAS.</p>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Tracking settings form */

type TrackingValues = {
  metaPixelId: string; tiktokPixelId: string; ga4Id: string; googleAdsId: string; googleAdsPurchaseLabel: string;
  metaDomainVerification: string; googleSiteVerification: string; whatsappNumber: string; messengerPage: string; metaTestEventCode: string;
};

export function TrackingForm({ values, token }: { values: TrackingValues; token: { saved: boolean; hint: string; fromEnv: boolean } }) {
  const [state, action, pending] = useActionState<TrackingState, FormData>(saveTracking, {});
  const router = useRouter();
  useEffect(() => {
    if (!state.message) return;
    toast(state.message, state.ok ? 'ok' : 'warn');
    if (state.ok) router.refresh();
  }, [state, router]);

  const field = (name: keyof TrackingValues, label: string, hint: React.ReactNode, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label className="alabel" htmlFor={name}>{label}</label>
      <input id={name} name={name} defaultValue={values[name]} className={`ainput ${state.errors?.[name] ? 'border-red-400' : ''}`} autoComplete="off" spellCheck={false} {...props} />
      {state.errors?.[name] ? <p className="mt-1.5 text-xs text-red-600">{state.errors[name]}</p> : <p className="ahint">{hint}</p>}
    </div>
  );
  const section = (title: string, icon: React.ReactNode, children: React.ReactNode, note?: React.ReactNode) => (
    <section className="admin-card">
      <div className="mb-4 flex items-center gap-3">{icon}<div><h2 className="font-semibold tracking-tight">{title}</h2>{note && <p className="text-xs text-ink/50">{note}</p>}</div></div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
  const badge = (bg: string, text: string) => <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-xs font-bold text-white ${bg}`}>{text}</span>;

  return (
    <form action={action} className="space-y-4">
      {section('Meta: Facebook & Instagram', badge('bg-[#0866FF]', 'f'), <>
        {field('metaPixelId', 'Pixel ID (dataset ID)', 'Events Manager → Data sources → your pixel. 15–16 digits.', { inputMode: 'numeric', placeholder: '123456789012345' })}
        <div>
          <label className="alabel" htmlFor="metaCapiToken">Conversions API access token</label>
          {token.fromEnv ? (
            <p className="rounded-xl bg-[#f7f7f4] px-3.5 py-2.5 text-sm text-ink/60">Set on the server (META_CAPI_TOKEN)</p>
          ) : (
            <input id="metaCapiToken" name="metaCapiToken" type="password" autoComplete="new-password" spellCheck={false} placeholder={token.saved ? `Saved ${token.hint} · leave empty to keep` : 'Paste the token'}
              className={`ainput ${state.errors?.metaCapiToken ? 'border-red-400' : ''}`} />
          )}
          {state.errors?.metaCapiToken ? <p className="mt-1.5 text-xs text-red-600">{state.errors.metaCapiToken}</p> : (
            <p className="ahint">Pixel → Settings → Conversions API → Generate access token. Stored on the server only, never shown again.
              {token.saved && !token.fromEnv && <label className="mt-1.5 flex items-center gap-2 text-ink/60"><input type="checkbox" name="clearCapiToken" className="acheck" /> Remove the saved token</label>}
            </p>
          )}
        </div>
        {field('metaDomainVerification', 'Domain verification code', 'Business settings → Brand safety → Domains → Meta-tag. Paste the code or the whole tag.', { placeholder: 'abc123def456…' })}
        {field('metaTestEventCode', 'Test event code (optional)', 'Only while testing in Events Manager → Test events. Clear it when you’re done, or purchases won’t count.', { placeholder: 'TEST12345' })}
      </>, 'Pixel in the browser + Conversions API from the server, matched by order number')}

      {section('TikTok', badge('bg-black', '♪'), <>
        {field('tiktokPixelId', 'TikTok Pixel ID', 'TikTok Ads Manager → Tools → Events → Web events → your pixel.', { placeholder: 'C4ABCDEFGH1234567890' })}
      </>)}

      {section('Google', badge('bg-[#4285F4]', 'G'), <>
        {field('ga4Id', 'Google Analytics 4 Measurement ID', 'Analytics → Admin → Data streams → Web.', { placeholder: 'G-AB12CD34EF' })}
        {field('googleAdsId', 'Google Ads tag ID', 'Google Ads → Goals → Conversions → Tag setup.', { placeholder: 'AW-123456789' })}
        {field('googleAdsPurchaseLabel', 'Purchase conversion label', 'From the “Purchase” conversion action: the part after the slash.', { placeholder: 'AbC-D_efGhIjK' })}
        {field('googleSiteVerification', 'Search Console verification', 'Search Console → Settings → Ownership → HTML tag.', { placeholder: 'abcDEF123…' })}
      </>)}

      {section('Chat buttons', badge('bg-[#25D366]', 'W'), <>
        {field('whatsappNumber', 'WhatsApp number', 'Shows a floating WhatsApp button and “Order on WhatsApp” on products.', { inputMode: 'tel', placeholder: '01712345678' })}
        {field('messengerPage', 'Facebook Page username', 'Shows a Messenger button (m.me/username).', { placeholder: 'neversettlebd' })}
      </>, 'Every tap counts as a “Contact” in your ads reporting')}

      <div className="sticky bottom-4 z-10 flex items-center justify-end gap-3 rounded-2xl border border-black/[0.06] bg-white/90 p-3 shadow-lg backdrop-blur">
        {state.message && !state.ok && <p className="mr-auto text-sm text-red-600">{state.message}</p>}
        <button className="abtn abtn-primary px-6" disabled={pending}>{pending ? 'Saving…' : 'Save tracking settings'}</button>
      </div>
    </form>
  );
}
