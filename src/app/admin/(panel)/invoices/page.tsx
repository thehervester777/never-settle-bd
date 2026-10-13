import Link from 'next/link';
import { and, count, desc, eq, gte, inArray, lt, notInArray, sum, type SQL } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requirePermission } from '@/lib/auth';
import { formatBDT } from '@/lib/money';
import { fmtDate, PRESETS, resolveRange, utcBounds } from '@/lib/dates';
import { PageHeader, Segmented, EmptyState } from '@/components/admin/ui';
import { StatTile } from '@/components/admin/StatTile';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { AdminIcon } from '@/components/admin/AdminIcon';

export const metadata = { title: 'Invoices' };

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ range?: string; pay?: string; page?: string }> }) {
  await requirePermission('invoices');
  const sp = await searchParams;
  const range = resolveRange(sp, 'mtd');
  const [start, end] = utcBounds(range);
  const { orders } = schema;
  const base: SQL[] = [gte(orders.createdAt, start), lt(orders.createdAt, end), notInArray(orders.status, ['CANCELLED'])];
  const where = and(...base, ...(sp.pay === 'PAID' || sp.pay === 'UNPAID' || sp.pay === 'REFUNDED' ? [eq(orders.paymentStatus, sp.pay)] : []));
  const page = Math.max(1, Number(sp.page) || 1);

  const [rows, [totals], [collected], [due]] = await Promise.all([
    db.select().from(orders).where(where).orderBy(desc(orders.createdAt)).limit(40).offset((page - 1) * 40),
    db.select({ n: count(), value: sum(orders.total) }).from(orders).where(and(...base, notInArray(orders.status, ['RETURNED']))),
    db.select({ n: count(), value: sum(orders.total) }).from(orders).where(and(...base, eq(orders.paymentStatus, 'PAID'))),
    db.select({ n: count(), value: sum(orders.total) }).from(orders).where(and(...base, eq(orders.paymentStatus, 'UNPAID'), inArray(orders.status, ['SHIPPED', 'DELIVERED']))),
  ]);
  const qs = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ range: range.preset === 'custom' ? undefined : range.preset, pay: sp.pay, ...extra }).filter(([, v]) => v) as [string, string][]);
    return p.size ? `?${p}` : '';
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        description={`Every order gets an invoice (INV-order number) · ${range.label.toLowerCase()}`}
        actions={<Segmented current={range.preset} items={PRESETS.filter(([k]) => ['7d', '30d', 'mtd', 'lm', 'ytd'].includes(k)).map(([k, l]) => ({ key: k, label: l, href: `/admin/invoices${qs({ range: k, page: undefined })}` }))} />}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Invoiced" value={Number(totals.value ?? 0)} format="bdt" hint={`${totals.n} invoices`} icon="invoice" />
        <StatTile label="Collected" value={Number(collected.value ?? 0)} format="bdt" hint={`${collected.n} paid`} icon="cash" />
        <StatTile tone="accent" label="With couriers, not yet collected" value={Number(due.value ?? 0)} format="bdt" hint={`${due.n} shipped or delivered, unpaid`} icon="truck" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented current={sp.pay ?? 'all'} items={[['all', 'All'], ['UNPAID', 'Unpaid'], ['PAID', 'Paid'], ['REFUNDED', 'Refunded']].map(([k, l]) => ({ key: k, label: l, href: `/admin/invoices${qs({ pay: k === 'all' ? undefined : k, page: undefined })}` }))} />
        {rows.length > 0 && <a href={`/admin/print?ids=${rows.map((r) => r.id).join(',')}`} target="_blank" className="abtn abtn-outline"><AdminIcon name="print" className="h-4 w-4" /> Print this page ({rows.length})</a>}
      </div>
      <section className="admin-card p-0">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead><tr><th>Invoice</th><th>Date</th><th>Customer</th><th>Order status</th><th>Payment</th><th className="text-right">Amount</th><th className="text-right">Print</th></tr></thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id}>
                  <td className="font-semibold">INV-{o.number}</td>
                  <td className="whitespace-nowrap text-ink/60">{fmtDate(o.createdAt)}</td>
                  <td><Link href={`/admin/orders/${o.id}`} className="hover:underline">{o.customerName}</Link><p className="text-xs text-ink/45">{o.phone}</p></td>
                  <td><StatusBadge status={o.status} /></td>
                  <td><StatusBadge status={o.paymentStatus} /></td>
                  <td className="text-right font-semibold tabular">{formatBDT(o.total)}</td>
                  <td className="text-right"><a href={`/admin/print?ids=${o.id}`} target="_blank" className="inline-flex rounded-lg p-1.5 text-ink/45 hover:bg-black/[0.05] hover:text-ink" aria-label={`Print INV-${o.number}`}><AdminIcon name="print" className="h-4 w-4" /></a></td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={7}><EmptyState icon="invoice" title="No invoices in this period" /></td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      <div className="flex justify-end gap-2">
        {page > 1 && <Link className="abtn abtn-outline abtn-sm" href={`/admin/invoices${qs({ page: String(page - 1) })}`}>Newer</Link>}
        {rows.length === 40 && <Link className="abtn abtn-outline abtn-sm" href={`/admin/invoices${qs({ page: String(page + 1) })}`}>Older</Link>}
      </div>
    </div>
  );
}
