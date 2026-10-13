/** Dates in the admin panel follow Bangladesh time (UTC+6, no daylight saving). */
export const TZ = 'Asia/Dhaka';
const OFFSET_MS = 6 * 3600 * 1000;

/** 'YYYY-MM-DD' for a moment, in Dhaka time. */
export const dhakaDate = (d: Date = new Date()) => new Date(d.getTime() + OFFSET_MS).toISOString().slice(0, 10);

/** The UTC instant when a Dhaka calendar day starts. */
export const dayStartUtc = (day: string) => new Date(`${day}T00:00:00+06:00`);

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function addMonths(day: string, n: number): string {
  const d = new Date(`${day.slice(0, 7)}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}

export const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

export const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

export type Range = { from: string; to: string; label: string; preset: string };

export const PRESETS = [
  ['7d', 'Last 7 days'], ['30d', 'Last 30 days'], ['90d', 'Last 90 days'],
  ['mtd', 'This month'], ['lm', 'Last month'], ['ytd', 'This year'], ['12m', 'Last 12 months'],
] as const;

/** Resolves ?range= (a preset) or ?from=&to= (custom, inclusive) into Dhaka calendar days. */
export function resolveRange(sp: { range?: string; from?: string; to?: string }, fallback = '30d'): Range {
  const today = dhakaDate();
  if (isDay(sp.from) && isDay(sp.to) && sp.from <= sp.to) return { from: sp.from, to: sp.to, label: `${fmtDay(sp.from)} – ${fmtDay(sp.to)}`, preset: 'custom' };
  const preset = PRESETS.some(([k]) => k === sp.range) ? sp.range! : fallback;
  const label = PRESETS.find(([k]) => k === preset)![1];
  const monthStart = `${today.slice(0, 7)}-01`;
  switch (preset) {
    case '7d': return { from: addDays(today, -6), to: today, label, preset };
    case '90d': return { from: addDays(today, -89), to: today, label, preset };
    case 'mtd': return { from: monthStart, to: today, label, preset };
    case 'lm': { const from = addMonths(monthStart, -1); return { from, to: addDays(monthStart, -1), label, preset }; }
    case 'ytd': return { from: `${today.slice(0, 4)}-01-01`, to: today, label, preset };
    case '12m': return { from: addMonths(monthStart, -11), to: today, label, preset };
    default: return { from: addDays(today, -29), to: today, label, preset: '30d' };
  }
}

/** The same-length period right before a range, for "vs previous period" deltas. */
export function previousRange(r: Range): { from: string; to: string } {
  const len = daysBetween(r.from, r.to) + 1;
  return { from: addDays(r.from, -len), to: addDays(r.from, -1) };
}

/** UTC bounds [start, end) covering whole Dhaka days, for datetime columns. */
export const utcBounds = (r: { from: string; to: string }) => [dayStartUtc(r.from), dayStartUtc(addDays(r.to, 1))] as const;

export const fmtDay = (day: string) => new Date(`${day}T12:00:00+06:00`).toLocaleDateString('en-GB', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' });
export const fmtDate = (d: Date) => d.toLocaleDateString('en-GB', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' });
export const fmtDateTime = (d: Date) => d.toLocaleString('en-GB', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
export const fmtMonth = (ym: string) => `${new Date(`${ym}-15T12:00:00Z`).toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' })} ’${ym.slice(2, 4)}`;

export function timeAgo(d: Date, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - d.getTime()) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60); if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60); if (h < 24) return `${h} h ago`;
  const days = Math.round(h / 24); if (days < 30) return `${days} d ago`;
  return fmtDate(d);
}
