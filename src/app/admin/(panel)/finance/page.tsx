import { requirePermission } from '@/lib/auth';
import { formatBDT } from '@/lib/money';
import { addMonths, fmtMonth, previousRange, resolveRange } from '@/lib/dates';
import { monthlyPnl, profitAndLoss } from '@/lib/reports';
import { Card, PageHeader, pctChange } from '@/components/admin/ui';
import { StatTile } from '@/components/admin/StatTile';
import { RangePicker } from '@/components/admin/RangePicker';
import { BarList, ChartFrame, ColumnChart, DivergingColumns } from '@/components/admin/charts';
import { SERIES } from '@/components/admin/palette';
import { AdminIcon } from '@/components/admin/AdminIcon';

export const metadata = { title: 'Profit & loss' };

function Line({ label, value, strong, negative, indent, note }: { label: string; value: number; strong?: boolean; negative?: boolean; indent?: boolean; note?: string }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 py-2 ${strong ? 'border-t border-black/[0.08] font-semibold' : ''} ${indent ? 'pl-4 text-ink/70' : ''}`}>
      <span>{label}{note && <span className="ml-2 text-xs font-normal text-ink/45">{note}</span>}</span>
      <span className={`tabular ${value < 0 && strong ? 'text-red-600' : ''}`}>{negative && value ? `(${formatBDT(value)})` : formatBDT(value)}</span>
    </div>
  );
}

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ range?: string; from?: string; to?: string }> }) {
  await requirePermission('finance');
  const sp = await searchParams;
  const range = resolveRange(sp, 'mtd');
  const prev = previousRange(range);
  const trailing = { from: addMonths(range.to, -11), to: range.to };
  const [pl, before, months] = await Promise.all([profitAndLoss(range), profitAndLoss(prev), monthlyPnl(trailing)]);
  const labels = months.map((m) => fmtMonth(m.key));
  const exportHref = `/admin/finance/export?from=${range.from}&to=${range.to}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profit & loss"
        description={<>Revenue is counted when an order is delivered · {range.label}</>}
        actions={<a href={exportHref} className="abtn abtn-outline"><AdminIcon name="download" className="h-4 w-4" /> Export CSV</a>}
      />
      <RangePicker basePath="/admin/finance" range={range} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Revenue" value={pl.revenue} format="bdt" delta={pctChange(pl.revenue, before.revenue)} icon="cash" />
        <StatTile label="Gross profit" value={pl.gross} format="bdt" delta={pctChange(pl.gross, before.gross)} icon="pnl" />
        <StatTile label="Expenses" value={pl.opex} format="bdt" delta={pctChange(pl.opex, before.opex)} goodWhenUp={false} icon="expenses" />
        <StatTile tone="accent" label="Net profit" value={pl.net} format="bdt" delta={pctChange(pl.net, before.net)} icon="sparkle" />
      </div>

      <div className="grid gap-4 xl:grid-cols-5 [&>*]:min-w-0">
        <Card className="xl:col-span-2" title="Statement" description={`${pl.orders} delivered orders · ${pl.units} units`}>
          <div className="text-sm">
            <p className="pb-1 text-xs font-semibold uppercase tracking-[0.12em] text-ink/40">Revenue</p>
            <Line indent label="Product sales" value={pl.merch} />
            {pl.discounts > 0 && <Line indent label="Discount codes" value={pl.discounts} negative />}
            <Line indent label="Delivery charges" value={pl.shipping} />
            <Line strong label="Total revenue" value={pl.revenue} />
            <Line label="Cost of goods sold" value={pl.cogs} negative />
            <Line strong label="Gross profit" value={pl.gross} note={`${(pl.grossMargin * 100).toFixed(1)}% margin`} />
            <p className="pb-1 pt-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink/40">Operating expenses</p>
            {pl.expenses.map((e) => <Line key={e.category} indent label={e.category} value={e.total} negative />)}
            {!pl.expenses.length && <p className="py-2 pl-4 text-ink/45">No expenses recorded for this period.</p>}
            <Line strong label="Total expenses" value={pl.opex} negative />
            <div className={`mt-3 flex items-baseline justify-between rounded-xl px-4 py-3 text-base font-semibold ${pl.net >= 0 ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-800'}`}>
              <span>Net {pl.net >= 0 ? 'profit' : 'loss'} <span className="ml-1 text-xs font-normal opacity-70">{(pl.netMargin * 100).toFixed(1)}% of revenue</span></span>
              <span className="tabular">{formatBDT(pl.net)}</span>
            </div>
          </div>
          {pl.pipeline.orders > 0 && (
            <p className="mt-4 flex gap-2 rounded-xl bg-[#f7f7f4] p-3 text-xs text-ink/60">
              <AdminIcon name="truck" className="h-4 w-4 shrink-0" />
              {pl.pipeline.orders} open orders worth {formatBDT(pl.pipeline.value)} aren’t counted yet: they become revenue when delivered.
            </p>
          )}
        </Card>

        <div className="space-y-4 xl:col-span-3">
          <Card title="Revenue and costs" description="Last 12 months · costs are goods sold plus expenses">
            <ChartFrame
              caption="Monthly revenue, costs and net profit"
              chart={<ColumnChart labels={labels} series={[
                { key: 'rev', label: 'Revenue', color: SERIES.blue, values: months.map((m) => m.revenue) },
                { key: 'cost', label: 'Costs', color: SERIES.orange, values: months.map((m) => m.costs) },
              ]} />}
              table={{ headers: ['Month', 'Revenue', 'Goods sold', 'Expenses', 'Net profit'], rows: months.map((m, i) => [labels[i], formatBDT(m.revenue), formatBDT(m.cogs), formatBDT(m.expenses), formatBDT(m.net)]) }}
            />
          </Card>
          <Card title="Net profit by month">
            <DivergingColumns labels={labels} values={months.map((m) => m.net)} />
          </Card>
        </div>
      </div>

      <Card title="Where the money goes" description={`Expenses by category · ${range.label}`}>
        <BarList color={SERIES.orange} rows={pl.expenses.map((e) => ({ label: e.category, value: e.total, sub: pl.opex ? `${((e.total / pl.opex) * 100).toFixed(0)}%` : undefined }))} empty="No expenses in this period. Add them under Expenses." />
      </Card>
    </div>
  );
}
