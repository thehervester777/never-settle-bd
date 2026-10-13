import Link from 'next/link';
import { and, eq, gte, lt, lte } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requirePermission } from '@/lib/auth';
import { formatBDT } from '@/lib/money';
import { dayStartUtc, fmtDateTime, fmtDay, resolveRange, utcBounds } from '@/lib/dates';
import { Card, EmptyState, PageHeader, Segmented } from '@/components/admin/ui';
import { StatTile } from '@/components/admin/StatTile';
import { RangePicker } from '@/components/admin/RangePicker';
import { AdminIcon } from '@/components/admin/AdminIcon';

export const metadata = { title: 'Transactions' };

type Tx = { key: string; at: Date; dateLabel: string; kind: 'in' | 'out'; label: string; detail: string; amount: number; href?: string };

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<{ range?: string; from?: string; to?: string; type?: string }> }) {
  await requirePermission('finance');
  const sp = await searchParams;
  const range = resolveRange(sp, 'mtd');
  const [start, end] = utcBounds(range);
  const { payments, orders, expenses } = schema;

  const [pay, exp] = await Promise.all([
    db.select({ id: payments.id, amount: payments.amount, status: payments.status, at: payments.createdAt, orderId: orders.id, number: orders.number, customer: orders.customerName })
      .from(payments).innerJoin(orders, eq(payments.orderId, orders.id))
      .where(and(gte(payments.createdAt, start), lt(payments.createdAt, end), eq(payments.provider, 'cod'))),
    db.select().from(expenses).where(and(gte(expenses.spentOn, range.from), lte(expenses.spentOn, range.to))),
  ]);

  const all: Tx[] = [
    ...pay.map((p) => ({
      key: `p${p.id}`, at: p.at, dateLabel: fmtDateTime(p.at), kind: (p.amount >= 0 ? 'in' : 'out') as 'in' | 'out',
      label: p.amount >= 0 ? `Cash received · ${p.number}` : `${p.status === 'REFUNDED' ? 'Refund' : 'Correction'} · ${p.number}`,
      detail: p.customer, amount: p.amount, href: `/admin/orders/${p.orderId}`,
    })),
    ...exp.map((e) => ({
      key: `e${e.id}`, at: new Date(dayStartUtc(e.spentOn).getTime() + 12 * 3600_000), dateLabel: fmtDay(e.spentOn), kind: 'out' as const,
      label: e.category, detail: e.description, amount: -e.amount,
    })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  let running = 0;
  const withBalance = all.map((t) => ({ ...t, balance: (running += t.amount) }));
  const moneyIn = all.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const moneyOut = -all.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0);
  const shown = withBalance.filter((t) => !sp.type || t.kind === sp.type).reverse();

  return (
    <div className="space-y-6">
      <PageHeader title="Transactions" description="Cash collected from couriers, refunds and expenses: the store’s money in and out" />
      <RangePicker basePath="/admin/finance/transactions" range={range} extra={{ type: sp.type }} />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Money in" value={moneyIn} format="bdt" hint={`${all.filter((t) => t.amount > 0).length} cash collections`} icon="arrow-down" />
        <StatTile label="Money out" value={moneyOut} format="bdt" hint="Expenses and refunds" icon="arrow-up" />
        <StatTile tone="accent" label="Net cash flow" value={moneyIn - moneyOut} format="bdt" hint={range.label} icon="transactions" />
      </div>
      <Card padded={false} title="Ledger" description="Newest first · balance runs from the start of the period"
        actions={<Segmented current={sp.type ?? 'all'} items={[['all', 'All'], ['in', 'Money in'], ['out', 'Money out']].map(([k, l]) => ({ key: k, label: l, href: `/admin/finance/transactions?${new URLSearchParams(Object.entries({ range: range.preset === 'custom' ? undefined : range.preset, from: range.preset === 'custom' ? range.from : undefined, to: range.preset === 'custom' ? range.to : undefined, type: k === 'all' ? undefined : k }).filter(([, v]) => v) as [string, string][])}` }))} />}>
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead><tr><th>Date</th><th>Transaction</th><th>Details</th><th className="text-right">Amount</th><th className="text-right">Balance</th></tr></thead>
            <tbody>
              {shown.slice(0, 500).map((t) => (
                <tr key={t.key}>
                  <td className="whitespace-nowrap text-ink/60">{t.dateLabel}</td>
                  <td>
                    <span className="flex items-center gap-2.5">
                      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${t.amount >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}><AdminIcon name={t.amount >= 0 ? 'arrow-down' : 'arrow-up'} className="h-3.5 w-3.5" strokeWidth={2.25} /></span>
                      {t.href ? <Link href={t.href} className="font-medium hover:underline">{t.label}</Link> : <span className="font-medium">{t.label}</span>}
                    </span>
                  </td>
                  <td className="text-ink/60">{t.detail || '—'}</td>
                  <td className={`text-right font-semibold tabular ${t.amount >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{t.amount >= 0 ? '+' : '−'}{formatBDT(Math.abs(t.amount))}</td>
                  <td className="text-right tabular text-ink/60">{formatBDT(t.balance)}</td>
                </tr>
              ))}
              {!shown.length && <tr><td colSpan={5}><EmptyState icon="transactions" title="No transactions in this period">Marking an order as paid records the cash here.</EmptyState></td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
