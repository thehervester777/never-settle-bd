import Link from 'next/link';
import { and, asc, count, desc, eq, like, type SQL } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requirePermission } from '@/lib/auth';
import { fmtDateTime, timeAgo } from '@/lib/dates';
import { EmptyState, PageHeader, Segmented } from '@/components/admin/ui';
import { AdminIcon } from '@/components/admin/AdminIcon';

export const metadata = { title: 'Activity log' };

const AREAS: [string, string, string][] = [
  ['all', 'Everything', 'activity'], ['order', 'Orders', 'orders'], ['product', 'Products', 'products'], ['variant', 'Stock', 'inventory'],
  ['expense', 'Expenses', 'expenses'], ['slide', 'Homepage', 'slides'], ['admin', 'Team & sign-ins', 'team'], ['settings', 'Settings', 'settings'],
];
const ICON: Record<string, string> = Object.fromEntries(AREAS.map(([k, , i]) => [k, i]));
const PER_PAGE = 50;

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ area?: string; who?: string; page?: string }> }) {
  await requirePermission('activity');
  const sp = await searchParams;
  const { activityLog: log, admins } = schema;
  const where: SQL[] = [];
  if (sp.area && sp.area !== 'all' && AREAS.some(([k]) => k === sp.area)) where.push(eq(log.entity, sp.area));
  if (sp.who && Number(sp.who)) where.push(eq(log.adminId, Number(sp.who)));
  const page = Math.max(1, Number(sp.page) || 1);
  const w = where.length ? and(...where) : undefined;
  const [rows, [{ total }], people] = await Promise.all([
    db.select().from(log).where(w).orderBy(desc(log.createdAt), desc(log.id)).limit(PER_PAGE).offset((page - 1) * PER_PAGE),
    db.select({ total: count() }).from(log).where(w),
    db.select({ id: admins.id, name: admins.name }).from(admins).orderBy(asc(admins.name)),
  ]);
  const qs = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ area: sp.area, who: sp.who, ...extra }).filter(([, v]) => v) as [string, string][]);
    return p.size ? `?${p}` : '';
  };
  // Group by Dhaka day for a readable feed.
  const day = (d: Date) => d.toLocaleDateString('en-GB', { timeZone: 'Asia/Dhaka', weekday: 'long', day: 'numeric', month: 'long' });
  const groups = rows.reduce<[string, typeof rows][]>((acc, r) => {
    const k = day(r.createdAt);
    if (acc.at(-1)?.[0] === k) acc.at(-1)![1].push(r); else acc.push([k, [r]]);
    return acc;
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="Activity log" description="Who did what in the admin panel" />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Segmented current={sp.area ?? 'all'} items={AREAS.map(([k, l]) => ({ key: k, label: l, href: `/admin/activity${qs({ area: k === 'all' ? undefined : k, page: undefined })}` }))} />
        <form className="flex gap-2">
          {sp.area && <input type="hidden" name="area" value={sp.area} />}
          <select name="who" defaultValue={sp.who ?? ''} className="aselect w-48"><option value="">Everyone</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          <button className="abtn abtn-primary">Filter</button>
        </form>
      </div>
      <section className="admin-card">
        {groups.map(([label, items]) => (
          <div key={label} className="mb-6 last:mb-0">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-ink/40">{label}</p>
            <ol className="space-y-1">
              {items.map((a) => (
                <li key={a.id} className="flex items-start gap-3 rounded-xl px-2 py-2 transition hover:bg-[#fafaf8]">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#f4f4f1] text-ink/60"><AdminIcon name={ICON[a.entity] ?? 'activity'} className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1 text-sm">
                    <p><span className="font-semibold">{a.adminName}</span> <span className="text-ink/70">{a.summary}</span></p>
                    <p className="text-xs text-ink/40" title={fmtDateTime(a.createdAt)}>{timeAgo(a.createdAt)} · {a.createdAt.toLocaleTimeString('en-GB', { timeZone: 'Asia/Dhaka', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  {a.entity === 'order' && a.entityId && <Link href={`/admin/orders?q=${encodeURIComponent(a.entityId)}`} className="text-xs font-medium text-ink/50 hover:text-ink">Open</Link>}
                  {a.entity === 'product' && a.entityId && <Link href={`/admin/products/${a.entityId}`} className="text-xs font-medium text-ink/50 hover:text-ink">Open</Link>}
                </li>
              ))}
            </ol>
          </div>
        ))}
        {!rows.length && <EmptyState icon="activity" title="Nothing recorded yet">Sign-ins, order changes, stock changes and edits appear here.</EmptyState>}
      </section>
      <div className="flex items-center justify-between text-sm">
        <span className="text-ink/50">{Number(total).toLocaleString()} entries</span>
        <div className="flex gap-2">
          {page > 1 && <Link className="abtn abtn-outline abtn-sm" href={`/admin/activity${qs({ page: String(page - 1) })}`}>Newer</Link>}
          {page * PER_PAGE < Number(total) && <Link className="abtn abtn-outline abtn-sm" href={`/admin/activity${qs({ page: String(page + 1) })}`}>Older</Link>}
        </div>
      </div>
    </div>
  );
}
