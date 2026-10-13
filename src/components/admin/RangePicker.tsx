import Link from 'next/link';
import { PRESETS, type Range } from '@/lib/dates';

/** Period presets plus a custom from/to, in one row above the content it scopes. */
export function RangePicker({ basePath, range, presets = ['30d', 'mtd', 'lm', 'ytd', '12m'], extra = {} }: {
  basePath: string; range: Range; presets?: string[]; extra?: Record<string, string | undefined>;
}) {
  const href = (params: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ ...extra, ...params }).filter(([, v]) => v) as [string, string][]);
    return p.size ? `${basePath}?${p}` : basePath;
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="seg">
        {PRESETS.filter(([k]) => presets.includes(k)).map(([k, l]) => (
          <Link key={k} href={href({ range: k })} aria-current={range.preset === k ? 'true' : undefined} scroll={false}>{l}</Link>
        ))}
      </div>
      <form action={basePath} className="flex items-center gap-1.5 rounded-xl border border-black/[0.06] bg-white p-1 shadow-sm">
        {Object.entries(extra).map(([k, v]) => v && <input key={k} type="hidden" name={k} value={v} />)}
        <input type="date" name="from" defaultValue={range.from} aria-label="From" className="rounded-lg border-0 bg-transparent px-2 py-1 text-xs focus:ring-2 focus:ring-accent/60" />
        <span className="text-xs text-ink/40">to</span>
        <input type="date" name="to" defaultValue={range.to} aria-label="To" className="rounded-lg border-0 bg-transparent px-2 py-1 text-xs focus:ring-2 focus:ring-accent/60" />
        <button className={`rounded-lg px-2.5 py-1 text-xs font-medium ${range.preset === 'custom' ? 'bg-ink text-white' : 'text-ink/60 hover:bg-black/[0.05]'}`}>Apply</button>
      </form>
    </div>
  );
}
