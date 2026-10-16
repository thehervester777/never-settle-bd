import Link from 'next/link';
import { AdminIcon } from './AdminIcon';

export function PageHeader({ title, description, back, actions }: { title: string; description?: React.ReactNode; back?: { href: string; label: string }; actions?: React.ReactNode }) {
  return (
    <div data-page-head className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {back && (
          <Link data-page-sub href={back.href} className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-ink/50 transition hover:text-ink">
            <AdminIcon name="arrow-left" className="h-3.5 w-3.5" /> {back.label}
          </Link>
        )}
        <h1 data-page-title className="text-2xl font-semibold tracking-tight md:text-[1.75rem]">{title}</h1>
        {description && <p data-page-sub className="mt-1 text-sm text-ink/55">{description}</p>}
      </div>
      {actions && <div data-page-sub className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon = 'box', title, children }: { icon?: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#f4f4f1] text-ink/40"><AdminIcon name={icon} className="h-6 w-6" /></span>
      <p className="mt-4 font-medium">{title}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-ink/50">{children}</div>}
    </div>
  );
}

/** A labelled card section. */
export function Card({ title, description, actions, children, className = '', padded = true }: { title?: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string; padded?: boolean }) {
  return (
    <section className={`admin-card ${padded ? '' : 'p-0'} ${className}`}>
      {(title || actions) && (
        <div className={`flex flex-wrap items-start justify-between gap-3 ${padded ? 'mb-4' : 'px-5 pb-3 pt-5'}`}>
          <div>
            {title && <h2 className="admin-card-title">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-ink/50">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

/** Segmented links (filters, periods). */
export function Segmented({ items, current, tone }: { items: { href: string; label: React.ReactNode; key: string }[]; current: string; tone?: 'dark' }) {
  return (
    <div className={`seg ${tone === 'dark' ? 'seg-dark' : ''}`}>
      {items.map((i) => <Link key={i.key} href={i.href} aria-current={i.key === current ? 'true' : undefined} scroll={false}>{i.label}</Link>)}
    </div>
  );
}

/** Up/down change vs a previous period. `goodWhenUp` flips the colour for costs. */
export function Delta({ value, goodWhenUp = true, suffix = 'vs previous period', dark }: { value: number | null; goodWhenUp?: boolean; suffix?: string; dark?: boolean }) {
  const muted = dark ? 'text-white/45' : 'text-ink/40';
  if (value === null || !Number.isFinite(value)) return <span className={`text-xs ${muted}`}>No earlier data</span>;
  const up = value > 0.0005, down = value < -0.0005;
  const good = (up && goodWhenUp) || (down && !goodWhenUp);
  const bad = (down && goodWhenUp) || (up && !goodWhenUp);
  return (
    <span className="inline-flex items-center gap-1 text-xs">
      <span className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-semibold ${good ? 'bg-emerald-50 text-emerald-700' : bad ? 'bg-red-50 text-red-700' : 'bg-black/[0.04] text-ink/60'}`}>
        {up && <AdminIcon name="arrow-up" className="h-3 w-3" strokeWidth={2.5} />}
        {down && <AdminIcon name="arrow-down" className="h-3 w-3" strokeWidth={2.5} />}
        {Math.abs(value * 100).toFixed(Math.abs(value) < 0.1 ? 1 : 0)}%
      </span>
      <span className={muted}>{suffix}</span>
    </span>
  );
}

export const pctChange = (now: number, before: number) => (before === 0 ? (now === 0 ? 0 : null) : (now - before) / Math.abs(before));
