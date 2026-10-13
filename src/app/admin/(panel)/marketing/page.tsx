import Link from 'next/link';
import { requirePermission } from '@/lib/auth';
import { formatBDT } from '@/lib/money';
import { dhakaDate, fmtDay, previousRange, resolveRange } from '@/lib/dates';
import { getSettings } from '@/lib/settings';
import { mediumLabel, sourceLabel } from '@/lib/attribution';
import {
  AD_PLATFORMS, couponPerformance, marketingSummary, paidVsOtherSeries, platformReturns, recentAdSpend, salesByCampaign, salesBySource,
} from '@/lib/marketing-reports';
import { Card, PageHeader, pctChange } from '@/components/admin/ui';
import { StatTile } from '@/components/admin/StatTile';
import { RangePicker } from '@/components/admin/RangePicker';
import { BarList, ChartFrame, TrendChart } from '@/components/admin/charts';
import { SERIES } from '@/components/admin/palette';
import { AdminIcon } from '@/components/admin/AdminIcon';
import { AdSpendForm, DeleteAdSpend } from '@/components/admin/MarketingTools';

export const metadata = { title: 'Campaigns & ROAS' };

const ratio = (v: number | null) => (v == null ? '—' : `${v.toFixed(2)}×`);
const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : '—');

export default async function MarketingPage({ searchParams }: { searchParams: Promise<{ range?: string; from?: string; to?: string }> }) {
  await requirePermission('marketing');
  const range = resolveRange(await searchParams, '30d');
  const prev = previousRange(range);
  const [sum, before, sources, campaigns, coupons, platforms, series, spendLog, settings] = await Promise.all([
    marketingSummary(range), marketingSummary(prev), salesBySource(range), salesByCampaign(range), couponPerformance(range),
    platformReturns(range), paidVsOtherSeries(range), recentAdSpend(), getSettings(),
  ]);
  const tracking = !!(settings.metaPixelId || settings.tiktokPixelId || settings.ga4Id);
  const labels = series.map((d) => fmtDay(d.key).replace(/ \d{4}$/, ''));
  const tracked = sources.filter((s) => s.source).reduce((n, s) => n + s.placed, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campaigns & ROAS"
        description={<>Where your orders come from and what your ads bring back · {range.label}</>}
        actions={<Link href="/admin/marketing/setup" className="abtn abtn-outline"><AdminIcon name="target" className="h-4 w-4" /> Pixels &amp; catalog</Link>}
      />

      {!tracking && (
        <Link href="/admin/marketing/setup" className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 transition hover:bg-amber-100/70">
          <AdminIcon name="alert" className="h-5 w-5 shrink-0" />
          <span className="flex-1"><strong>Ad tracking isn’t set up yet.</strong> Add your Meta Pixel (and TikTok / Google if you use them) so your ads can optimise for sales and retarget visitors.</span>
          <AdminIcon name="chevron" className="h-4 w-4" />
        </Link>
      )}

      <RangePicker basePath="/admin/marketing" range={range} presets={['7d', '30d', 'mtd', 'lm', '90d']} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Sales" value={sum.sales} format="bdt" delta={pctChange(sum.sales, before.sales)} icon="cash" />
        <StatTile label="Ad spend" value={sum.spend} format="bdt" delta={pctChange(sum.spend, before.spend)} goodWhenUp={false} icon="megaphone" />
        <StatTile
          tone="accent" label="Return on ad spend" value={sum.roas ?? 0} format="ratio" icon="sparkle"
          hint={sum.roas == null ? 'Log your ad spend to see it' : `৳${sum.roas.toFixed(2)} in sales for every ৳1 on ads`}
        />
        <StatTile label="Cost per order" value={sum.costPerOrder ?? 0} format="bdt" icon="orders" goodWhenUp={false}
          delta={sum.costPerOrder != null && before.costPerOrder != null ? pctChange(sum.costPerOrder, before.costPerOrder) : undefined}
          hint={sum.costPerOrder == null ? 'Ad spend ÷ orders' : undefined} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3 [&>*]:min-w-0">
        <Card className="xl:col-span-2" title="Return by platform" description="Sales from each platform’s visitors (ads and posts) against what you spent there" padded={false}>
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead><tr><th>Platform</th><th className="text-right">Ad spend</th><th className="text-right">Orders</th><th className="text-right">Sales</th><th className="text-right">ROAS</th><th className="text-right">Cost / order</th></tr></thead>
              <tbody>
                {platforms.map((p) => (
                  <tr key={p.key}>
                    <td className="font-medium">{p.label}{p.paid > 0 && <p className="text-xs font-normal text-ink/45">{p.paid} from tagged ads</p>}</td>
                    <td className="text-right tabular">{p.spend ? formatBDT(p.spend) : <span className="text-ink/35">—</span>}</td>
                    <td className="text-right tabular">{p.key === 'other' ? <span className="text-ink/35">—</span> : p.orders}</td>
                    <td className="text-right font-medium tabular">{p.key === 'other' ? <span className="text-ink/35">—</span> : formatBDT(p.sales)}</td>
                    <td className={`text-right font-semibold tabular ${p.roas != null && p.roas < 1 ? 'text-red-600' : ''}`}>{p.key === 'other' ? '—' : ratio(p.roas)}</td>
                    <td className="text-right tabular">{p.costPerOrder != null && p.key !== 'other' ? formatBDT(p.costPerOrder) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-black/[0.05] px-5 py-3 text-xs text-ink/50">
            ROAS under 1× means the ads cost more than the sales they brought. Remember that profit also has to cover the cost of the goods.
          </p>
        </Card>

        <Card title="Log ad spend" description="From Ads Manager → Billing">
          <AdSpendForm platforms={AD_PLATFORMS.map((p) => ({ key: p.key, label: p.label }))} today={dhakaDate()} />
          {spendLog.length > 0 && (
            <ul className="mt-5 divide-y divide-black/[0.05] border-t border-black/[0.05] text-sm">
              {spendLog.map((e) => (
                <li key={e.id} className="flex items-center gap-3 py-2">
                  <span className="min-w-0 flex-1"><span className="block truncate">{e.description}</span><span className="text-xs text-ink/45">{fmtDay(e.spent_on)}</span></span>
                  <span className="font-medium tabular">{formatBDT(Number(e.amount))}</span>
                  <DeleteAdSpend id={Number(e.id)} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Sales from ads vs everything else" description="Ads = links tagged as paid (utm_medium paid_social, cpc…). Set up the URL parameters under Pixels & catalog.">
        <ChartFrame
          caption="Daily sales from tagged ads and from all other visits"
          chart={<TrendChart labels={labels} series={[
            { key: 'paid', label: 'Ads', color: SERIES.blue, values: series.map((d) => d.paid) },
            { key: 'other', label: 'Posts, search & direct', color: SERIES.orange, values: series.map((d) => d.other) },
          ]} />}
          table={{ headers: ['Day', 'Ads', 'Other'], rows: series.map((d, i) => [labels[i], formatBDT(d.paid), formatBDT(d.other)]) }}
        />
      </Card>

      <div className="grid gap-4 xl:grid-cols-2 [&>*]:min-w-0">
        <Card title="Where orders come from" description={`${tracked} of ${sum.placed} orders have a recorded source`} padded={false}>
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead><tr><th>Source</th><th className="text-right">Orders</th><th className="text-right">Sales</th><th className="text-right">Avg order</th><th className="text-right">Delivered</th><th className="text-right">Cancelled</th></tr></thead>
              <tbody>
                {sources.map((s) => (
                  <tr key={s.source ?? 'none'}>
                    <td><Link href={`/admin/orders?source=${encodeURIComponent(s.source ?? 'none')}&from=${range.from}&to=${range.to}`} className="font-medium hover:underline">{s.source ? sourceLabel(s.source) : 'Not recorded'}</Link>{!s.source && <p className="text-xs text-ink/45">Orders from before tracking</p>}</td>
                    <td className="text-right tabular">{s.orders}</td>
                    <td className="text-right font-medium tabular">{formatBDT(s.sales)}</td>
                    <td className="text-right tabular">{s.orders ? formatBDT(s.sales / s.orders) : '—'}</td>
                    <td className="text-right tabular">{pct(s.delivered, s.placed)}</td>
                    <td className={`text-right tabular ${s.placed && s.lost / s.placed > 0.25 ? 'font-semibold text-red-600' : ''}`}>{pct(s.lost, s.placed)}</td>
                  </tr>
                ))}
                {!sources.length && <tr><td colSpan={6} className="py-8 text-center text-ink/45">No orders in this period.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Sales by source">
          <BarList rows={sources.filter((s) => s.sales > 0).slice(0, 8).map((s) => ({ label: s.source ? sourceLabel(s.source) : 'Not recorded', value: s.sales, sub: `${s.orders} order${s.orders === 1 ? '' : 's'}`, href: `/admin/orders?source=${encodeURIComponent(s.source ?? 'none')}&from=${range.from}&to=${range.to}` }))} empty="No sales in this period." />
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2 [&>*]:min-w-0">
        <Card title="Campaigns" description="From utm_campaign on your ad and post links" padded={false}>
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead><tr><th>Campaign</th><th>Source</th><th className="text-right">Orders</th><th className="text-right">Sales</th><th className="text-right">Avg order</th></tr></thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.campaign}>
                    <td><Link href={`/admin/orders?campaign=${encodeURIComponent(c.campaign)}&from=${range.from}&to=${range.to}`} className="font-medium hover:underline">{c.campaign}</Link></td>
                    <td className="text-xs text-ink/60">{sourceLabel(c.source)}{c.medium ? ` · ${mediumLabel(c.medium)}` : ''}</td>
                    <td className="text-right tabular">{c.orders}</td>
                    <td className="text-right font-medium tabular">{formatBDT(c.sales)}</td>
                    <td className="text-right tabular">{c.orders ? formatBDT(c.sales / c.orders) : '—'}</td>
                  </tr>
                ))}
                {!campaigns.length && <tr><td colSpan={5} className="py-8 text-center text-sm text-ink/45">No tagged campaigns yet. Build links under <Link href="/admin/marketing/setup#links" className="underline">Pixels &amp; catalog</Link>, or paste the URL parameters into your Meta ads.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Discount codes" description={`${sum.couponOrders} orders used a code · ${formatBDT(sum.discounts)} given away`} padded={false}
          actions={<Link href="/admin/marketing/coupons" className="text-xs font-medium text-ink/55 hover:text-ink">Manage codes</Link>}>
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead><tr><th>Code</th><th className="text-right">Orders</th><th className="text-right">Discount</th><th className="text-right">Sales</th></tr></thead>
              <tbody>
                {coupons.map((c) => (
                  <tr key={c.code}>
                    <td><Link href={`/admin/orders?coupon=${encodeURIComponent(c.code)}&from=${range.from}&to=${range.to}`} className="rounded-lg bg-[#f4f4f1] px-2 py-0.5 font-mono text-xs font-semibold tracking-wider hover:bg-black/10">{c.code}</Link></td>
                    <td className="text-right tabular">{c.orders}</td>
                    <td className="text-right tabular text-ink/60">{formatBDT(c.discount)}</td>
                    <td className="text-right font-medium tabular">{formatBDT(c.sales)}</td>
                  </tr>
                ))}
                {!coupons.length && <tr><td colSpan={4} className="py-8 text-center text-sm text-ink/45">No orders used a discount code in this period.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
