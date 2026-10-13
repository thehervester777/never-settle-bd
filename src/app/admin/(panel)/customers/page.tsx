import Link from 'next/link';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { requirePermission } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { formatBDT } from '@/lib/money';
import { fmtDate, timeAgo } from '@/lib/dates';
import { PageHeader, Segmented, EmptyState } from '@/components/admin/ui';
import { StatTile } from '@/components/admin/StatTile';

export const metadata = { title: 'Customers' };

const VIP = 1_500_000; // ৳15,000 lifetime spend
const PER_PAGE = 40;
type Row = { phone: string; name: string; email: string | null; city: string; orders: unknown; good: unknown; spent: unknown; first: Date | string; last: Date | string };

const SEGMENTS = [['all', 'All'], ['new', 'New'], ['repeat', 'Repeat'], ['vip', 'VIP']] as const;
const SORTS = [['spent', 'Top spenders'], ['recent', 'Most recent'], ['orders', 'Most orders']] as const;

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; seg?: string; sort?: string; page?: string }> }) {
  const admin = await requirePermission('customers');
  const seeSales = can(admin.role, 'sales');
  const sp = await searchParams;
  const seg = SEGMENTS.some(([k]) => k === sp.seg) ? sp.seg! : 'all';
  const sort = SORTS.some(([k]) => k === sp.sort) ? sp.sort! : seeSales ? 'spent' : 'recent';
  const page = Math.max(1, Number(sp.page) || 1);
  const q = sp.q?.trim().replace(/[%_]/g, '');

  const latest = (col: string) => sql.raw(`SUBSTRING_INDEX(GROUP_CONCAT(COALESCE(o.${col}, '') ORDER BY o.created_at DESC SEPARATOR '\\n'), '\\n', 1)`);
  const live = sql`o.status NOT IN ('CANCELLED', 'RETURNED')`;
  const search = q ? sql`WHERE o.phone LIKE ${`%${q}%`} OR o.customer_name LIKE ${`%${q}%`} OR o.email LIKE ${`%${q}%`}` : sql``;
  const having = seg === 'new' ? sql`HAVING COUNT(*) = 1` : seg === 'repeat' ? sql`HAVING SUM(${live}) >= 2` : seg === 'vip' ? sql`HAVING COALESCE(SUM(CASE WHEN ${live} THEN o.total END), 0) >= ${VIP}` : sql``;
  const order = sort === 'recent' ? sql`last DESC` : sort === 'orders' ? sql`orders DESC, spent DESC` : sql`spent DESC`;
  const grouped = sql`
    SELECT o.phone, ${latest('customer_name')} AS name, ${latest('email')} AS email, ${latest('city')} AS city,
      COUNT(*) AS orders, SUM(${live}) AS good, COALESCE(SUM(CASE WHEN ${live} THEN o.total END), 0) AS spent,
      MIN(o.created_at) AS first, MAX(o.created_at) AS last
    FROM orders o ${search} GROUP BY o.phone ${having}`;

  const [[list], [summary]] = await Promise.all([
    db.execute(sql`${grouped} ORDER BY ${order} LIMIT ${PER_PAGE} OFFSET ${(page - 1) * PER_PAGE}`) as unknown as Promise<[Row[]]>,
    db.execute(sql`SELECT COUNT(*) AS customers, SUM(c.good >= 2) AS repeaters, AVG(c.spent) AS ltv FROM (${grouped}) c`) as unknown as Promise<[{ customers: unknown; repeaters: unknown; ltv: unknown }[]]>,
  ]);
  const s = summary[0];
  const customers = Number(s?.customers ?? 0);
  const qs = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ q: sp.q, seg: seg === 'all' ? undefined : seg, sort: sp.sort, ...extra }).filter(([, v]) => v) as [string, string][]);
    return p.size ? `?${p}` : '';
  };
  const asDate = (d: Date | string) => (d instanceof Date ? d : new Date(`${String(d).replace(' ', 'T')}Z`));

  return (
    <div className="space-y-6">
      <PageHeader title="Customers" description="Everyone who has ordered, grouped by phone number" />
      <div className={`grid gap-4 ${seeSales ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
        <StatTile label={seg === 'all' ? 'Customers' : 'Customers in segment'} value={customers} icon="customers" />
        <StatTile label="Repeat customers" value={customers ? Number(s.repeaters ?? 0) / customers : 0} format="pct" hint={`${Number(s?.repeaters ?? 0)} ordered more than once`} icon="refresh" />
        {seeSales && <StatTile tone="accent" label="Average lifetime value" value={Number(s?.ltv ?? 0)} format="bdt" icon="sparkle" />}
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Segmented current={seg} items={SEGMENTS.map(([k, l]) => ({ key: k, label: l, href: `/admin/customers${qs({ seg: k === 'all' ? undefined : k, page: undefined })}` }))} />
          <Segmented current={sort} items={SORTS.filter(([k]) => seeSales || k !== 'spent').map(([k, l]) => ({ key: k, label: l, href: `/admin/customers${qs({ sort: k, page: undefined })}` }))} />
        </div>
        <form className="flex gap-2">
          {seg !== 'all' && <input type="hidden" name="seg" value={seg} />}
          <input name="q" defaultValue={sp.q} placeholder="Name, phone or email" className="ainput w-64" />
          <button className="abtn abtn-primary">Search</button>
        </form>
      </div>
      <section className="admin-card p-0">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead><tr><th>Customer</th><th>City</th><th className="text-right">Orders</th>{seeSales && <th className="text-right">Lifetime value</th>}<th>Customer since</th><th>Last order</th></tr></thead>
            <tbody>
              {list.map((c) => {
                const spent = Number(c.spent), good = Number(c.good);
                return (
                  <tr key={c.phone}>
                    <td>
                      <Link href={`/admin/customers/${encodeURIComponent(c.phone)}`} className="flex items-center gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#f4f4f1] text-xs font-semibold">{(c.name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('')}</span>
                        <span><span className="font-medium hover:underline">{c.name}</span>
                          {spent >= VIP && <span className="ml-2 rounded-full bg-accent px-1.5 py-0.5 text-[0.6rem] font-bold uppercase">VIP</span>}
                          {good >= 2 && spent < VIP && <span className="ml-2 rounded-full bg-sky-50 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase text-sky-700">Repeat</span>}
                          <span className="block text-xs text-ink/45">{c.phone}{c.email ? ` · ${c.email}` : ''}</span></span>
                      </Link>
                    </td>
                    <td className="text-ink/70">{c.city}</td>
                    <td className="text-right tabular">{Number(c.orders)}</td>
                    {seeSales && <td className="text-right font-semibold tabular">{formatBDT(spent)}</td>}
                    <td className="whitespace-nowrap text-ink/60">{fmtDate(asDate(c.first))}</td>
                    <td className="whitespace-nowrap text-ink/60">{timeAgo(asDate(c.last))}</td>
                  </tr>
                );
              })}
              {!list.length && <tr><td colSpan={6}><EmptyState icon="customers" title="No customers found" /></td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      <div className="flex items-center justify-between text-sm">
        <span className="text-ink/50">Page {page} of {Math.max(1, Math.ceil(customers / PER_PAGE))}</span>
        <div className="flex gap-2">
          {page > 1 && <Link className="abtn abtn-outline abtn-sm" href={`/admin/customers${qs({ page: String(page - 1) })}`}>Previous</Link>}
          {page * PER_PAGE < customers && <Link className="abtn abtn-outline abtn-sm" href={`/admin/customers${qs({ page: String(page + 1) })}`}>Next</Link>}
        </div>
      </div>
    </div>
  );
}
