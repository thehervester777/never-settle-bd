import Link from 'next/link';
import { and, count, desc, eq, inArray, lte } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requireAdmin } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { getSettings } from '@/lib/settings';
import { formatBDT } from '@/lib/money';
import { dhakaDate, fmtDay, fmtMonth, previousRange, resolveRange, timeAgo } from '@/lib/dates';
import { salesByCity, salesSeries, salesSummary, topProducts } from '@/lib/reports';
import { StatTile } from '@/components/admin/StatTile';
import { BarList, ChartFrame, TrendChart } from '@/components/admin/charts';
import { SERIES } from '@/components/admin/palette';
import { Card, EmptyState, PageHeader, Segmented, pctChange } from '@/components/admin/ui';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { AdminIcon } from '@/components/admin/AdminIcon';

export const metadata = { title: 'Dashboard' };

const PERIODS = [['7d', '7 days'], ['30d', '30 days'], ['90d', '90 days'], ['12m', '12 months']] as const;

function greeting() {
  const h = Number(new Date().toLocaleString('en-GB', { timeZone: 'Asia/Dhaka', hour: '2-digit', hour12: false }));
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const range = resolveRange({ range: PERIODS.some(([k]) => k === sp.range) ? sp.range : '30d' });
  const prev = previousRange(range);
  const by = range.preset === '12m' ? 'month' : 'day';
  const seeSales = can(admin.role, 'sales'), seeCosts = can(admin.role, 'costs');
  const seeOrders = can(admin.role, 'orders.view'), seeStock = can(admin.role, 'inventory'), seeActivity = can(admin.role, 'activity');
  const settings = await getSettings();
  const { orders, variants, products, activityLog } = schema;

  const [now, before, series, top, cities, pipeline, lowStock, recent, activity] = await Promise.all([
    salesSummary(range), salesSummary(prev), salesSeries(range, by), topProducts(range), seeSales ? salesByCity(range) : Promise.resolve([]),
    db.select({ status: orders.status, n: count() }).from(orders).where(inArray(orders.status, ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED'])).groupBy(orders.status),
    seeStock
      ? db.select({ id: variants.id, stock: variants.stock, color: variants.color, size: variants.size, title: products.title, productId: products.id })
        .from(variants).innerJoin(products, eq(variants.productId, products.id))
        .where(and(lte(variants.stock, settings.lowStockThreshold), eq(products.isActive, true))).orderBy(variants.stock).limit(6)
      : Promise.resolve([]),
    seeOrders ? db.select().from(orders).orderBy(desc(orders.createdAt)).limit(6) : Promise.resolve([]),
    seeActivity ? db.select().from(activityLog).orderBy(desc(activityLog.createdAt)).limit(7) : Promise.resolve([]),
  ]);

  const pipe = new Map(pipeline.map((p) => [p.status, Number(p.n)]));
  const labels = series.map((s) => (by === 'day' ? fmtDay(s.key).replace(/ \d{4}$/, '') : fmtMonth(s.key)));
  const trendSeries = [
    ...(seeSales ? [{ key: 'sales', label: 'Sales', color: SERIES.blue, values: series.map((s) => s.sales) }] : []),
    ...(seeCosts ? [{ key: 'gp', label: 'Gross profit', color: SERIES.orange, values: series.map((s) => s.grossProfit) }] : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greeting()}, ${admin.name.split(' ')[0]}`}
        description={<>Here&apos;s how the store is doing · {range.label.toLowerCase()} to {fmtDay(dhakaDate())}</>}
        actions={<Segmented current={range.preset} items={PERIODS.map(([k, l]) => ({ key: k, label: l, href: `/admin?range=${k}` }))} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {seeSales ? (
          <>
            <StatTile label="Sales" value={now.sales} format="bdt" delta={pctChange(now.sales, before.sales)} trend={series.map((s) => s.sales)} icon="cash" />
            <StatTile label="Orders" value={now.orders} delta={pctChange(now.orders, before.orders)} trend={series.map((s) => s.orders)} icon="orders" />
            <StatTile label="Average order value" value={now.aov} format="bdt" delta={pctChange(now.aov, before.aov)} icon="pnl" />
            {seeCosts
              ? <StatTile tone="accent" label="Gross profit" value={now.grossProfit} format="bdt" delta={pctChange(now.grossProfit, before.grossProfit)} icon="sparkle" />
              : <StatTile label="Units sold" value={now.units} delta={pctChange(now.units, before.units)} icon="box" />}
          </>
        ) : (
          <>
            <StatTile label="Orders" value={now.orders} delta={pctChange(now.orders, before.orders)} trend={series.map((s) => s.orders)} icon="orders" />
            <StatTile label="Units sold" value={now.units} delta={pctChange(now.units, before.units)} icon="box" />
            <StatTile tone="accent" label="Waiting for confirmation" value={pipe.get('PENDING') ?? 0} hint="Call these customers" icon="phone" />
            <StatTile label="Ready to ship" value={(pipe.get('CONFIRMED') ?? 0) + (pipe.get('PROCESSING') ?? 0)} hint="Confirmed and packing" icon="truck" />
          </>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-3 [&>*]:min-w-0">
        <Card
          className="xl:col-span-2"
          title={seeSales ? (seeCosts ? 'Sales and gross profit' : 'Sales') : 'Orders'}
          description={`${by === 'day' ? 'Daily' : 'Monthly'} · cancelled and returned orders excluded`}
        >
          {trendSeries.length ? (
            <ChartFrame
              caption="Sales by period"
              chart={<TrendChart labels={labels} series={trendSeries} extra={{ label: 'orders', values: series.map((s) => s.orders) }} />}
              table={{ headers: ['Period', 'Orders', ...trendSeries.map((s) => s.label)], rows: series.map((s, i) => [labels[i], s.orders, ...trendSeries.map((t) => formatBDT(t.values[i]))]) }}
            />
          ) : (
            <ChartFrame
              caption="Orders by period"
              chart={<TrendChart labels={labels} format="int" series={[{ key: 'orders', label: 'Orders', color: SERIES.blue, values: series.map((s) => s.orders) }]} />}
              table={{ headers: ['Period', 'Orders'], rows: series.map((s, i) => [labels[i], s.orders]) }}
            />
          )}
        </Card>

        <Card title="Order pipeline" description="Open orders right now">
          <ul className="space-y-2">
            {(['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED'] as const).map((s) => (
              <li key={s}>
                <Link href={`/admin/orders?status=${s}`} className="group flex items-center justify-between rounded-xl border border-black/[0.05] px-3 py-2.5 transition hover:border-black/10 hover:bg-[#fafaf8]">
                  <span className="flex items-center gap-2 text-sm"><StatusBadge status={s} /> <span className="text-ink/55">{s === 'PENDING' ? 'call to confirm' : s === 'SHIPPED' ? 'with the courier' : s === 'PROCESSING' ? 'being packed' : 'ready to pack'}</span></span>
                  <span className="flex items-center gap-1 text-lg font-semibold tabular">{pipe.get(s) ?? 0}<AdminIcon name="chevron" className="h-4 w-4 text-ink/30 transition group-hover:translate-x-0.5" /></span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-5 rounded-xl bg-[#f7f7f4] p-4">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-ink/55">Cancelled or returned</span>
              <span className="font-semibold tabular">{(now.cancelRate * 100).toFixed(1)}%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#dbe8f8]">
              <div className="h-full rounded-full bg-[#2a78d6]" style={{ width: `${Math.min(100, now.cancelRate * 100)}%` }} />
            </div>
            <p className="mt-2 text-xs text-ink/45">of {now.placed} orders placed {range.label.toLowerCase()}</p>
          </div>
        </Card>
      </div>

      <div className={`grid gap-4 [&>*]:min-w-0 ${seeSales ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
        <Card title="Best sellers" description={seeSales ? 'By sales' : 'By units sold'}>
          <BarList
            format={seeSales ? 'bdt' : 'int'}
            rows={top.map((p) => ({ label: p.title, value: seeSales ? p.revenue : p.units, sub: `${p.units} sold`, href: can(admin.role, 'products') ? `/admin/products/${p.id}` : undefined }))}
          />
        </Card>
        {seeSales && (
          <Card title="Top cities" description="By sales">
            <BarList color={SERIES.blue} rows={cities.map((c) => ({ label: c.city, value: c.value, sub: `${c.orders} orders` }))} />
          </Card>
        )}
        {seeStock && (
          <Card title="Low stock" description={`${settings.lowStockThreshold} or fewer left`} actions={<Link href="/admin/inventory?filter=low" className="text-xs font-medium text-ink/55 hover:text-ink">View all</Link>}>
            {lowStock.length ? (
              <ul className="divide-y divide-black/[0.05]">
                {lowStock.map((v) => (
                  <li key={v.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="min-w-0"><span className="block truncate font-medium">{v.title}</span><span className="text-xs text-ink/45">{[v.color, v.size].filter(Boolean).join(' / ') || 'One size'}</span></span>
                    <StatusBadge status={v.stock <= 0 ? 'OUT' : 'LOW'} label={v.stock <= 0 ? 'Sold out' : `${v.stock} left`} />
                  </li>
                ))}
              </ul>
            ) : <EmptyState icon="check" title="Everything is well stocked" />}
          </Card>
        )}
      </div>

      {(seeOrders || seeActivity) && (
        <div className="grid gap-4 xl:grid-cols-3 [&>*]:min-w-0">
          {seeOrders && (
            <Card className="xl:col-span-2" padded={false} title="Recent orders" actions={<Link href="/admin/orders" className="text-xs font-medium text-ink/55 hover:text-ink">All orders</Link>}>
              <div className="overflow-x-auto">
                <table className="admin-table">
                  <thead><tr><th>Order</th><th>Customer</th><th>Status</th><th>Payment</th><th className="text-right">Total</th></tr></thead>
                  <tbody>
                    {recent.map((o) => (
                      <tr key={o.id}>
                        <td><Link className="font-medium hover:underline" href={`/admin/orders/${o.id}`}>{o.number}</Link><p className="text-xs text-ink/45">{timeAgo(o.createdAt)}</p></td>
                        <td>{o.customerName}<p className="text-xs text-ink/45">{o.city}</p></td>
                        <td><StatusBadge status={o.status} /></td>
                        <td><StatusBadge status={o.paymentStatus} /></td>
                        <td className="text-right font-medium tabular">{formatBDT(o.total)}</td>
                      </tr>
                    ))}
                    {!recent.length && <tr><td colSpan={5}><EmptyState icon="orders" title="No orders yet">New orders will show up here.</EmptyState></td></tr>}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
          {seeActivity && (
            <Card title="Team activity" actions={<Link href="/admin/activity" className="text-xs font-medium text-ink/55 hover:text-ink">View log</Link>}>
              {activity.length ? (
                <ol className="relative space-y-4 border-l border-black/[0.06] pl-4">
                  {activity.map((a) => (
                    <li key={a.id} className="relative">
                      <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#2a78d6]" />
                      <p className="text-sm"><span className="font-medium">{a.adminName}</span> <span className="text-ink/60">{a.summary}</span></p>
                      <p className="text-xs text-ink/40">{timeAgo(a.createdAt)}</p>
                    </li>
                  ))}
                </ol>
              ) : <EmptyState icon="activity" title="No activity yet" />}
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
