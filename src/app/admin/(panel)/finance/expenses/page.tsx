import { and, desc, eq, gte, lte, sql, type SQL } from 'drizzle-orm';
import { db, schema } from '@/db';
import { EXPENSE_CATEGORIES } from '@/db/schema';
import { requirePermission } from '@/lib/auth';
import { formatBDT } from '@/lib/money';
import { dhakaDate, fmtDay, resolveRange } from '@/lib/dates';
import { Card, EmptyState, PageHeader } from '@/components/admin/ui';
import { StatTile } from '@/components/admin/StatTile';
import { RangePicker } from '@/components/admin/RangePicker';
import { BarList } from '@/components/admin/charts';
import { SERIES } from '@/components/admin/palette';
import { DeleteExpense, ExpenseForm } from '@/components/admin/ExpenseForm';

export const metadata = { title: 'Expenses' };

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ range?: string; from?: string; to?: string; cat?: string }> }) {
  await requirePermission('finance');
  const sp = await searchParams;
  const range = resolveRange(sp, 'mtd');
  const { expenses, admins } = schema;
  const where: SQL[] = [gte(expenses.spentOn, range.from), lte(expenses.spentOn, range.to)];
  const cat = (EXPENSE_CATEGORIES as readonly string[]).includes(sp.cat ?? '') ? sp.cat : undefined;
  if (cat) where.push(eq(expenses.category, cat));

  const [rows, byCat] = await Promise.all([
    db.select({ id: expenses.id, spentOn: expenses.spentOn, category: expenses.category, description: expenses.description, amount: expenses.amount, by: admins.name })
      .from(expenses).leftJoin(admins, eq(expenses.adminId, admins.id)).where(and(...where)).orderBy(desc(expenses.spentOn), desc(expenses.id)).limit(500),
    db.select({ category: expenses.category, total: sql<number>`SUM(${expenses.amount})` }).from(expenses)
      .where(and(gte(expenses.spentOn, range.from), lte(expenses.spentOn, range.to))).groupBy(expenses.category).orderBy(sql`2 DESC`),
  ]);
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const allTotal = byCat.reduce((s, c) => s + Number(c.total), 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Expenses" description="Rent, salaries, ads, courier charges… everything that isn’t stock you sell" />
      <RangePicker basePath="/admin/finance/expenses" range={range} extra={{ cat }} />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile tone="accent" label={cat ? `${cat} spending` : 'Total spent'} value={cat ? total : allTotal} format="bdt" hint={range.label} icon="expenses" />
        <StatTile label="Entries" value={rows.length} icon="note" />
        <StatTile label="Biggest category" value={Number(byCat[0]?.total ?? 0)} format="bdt" hint={byCat[0]?.category ?? 'No expenses yet'} icon="pnl" />
      </div>
      <div className="grid gap-6 xl:grid-cols-3 [&>*]:min-w-0">
        <div className="space-y-6 xl:col-span-2">
          <Card padded={false} title={cat ? `${cat}` : 'All expenses'} description={`${fmtDay(range.from)} – ${fmtDay(range.to)}`}
            actions={cat ? <a href={`/admin/finance/expenses?range=${range.preset}`} className="text-xs font-medium text-ink/55 hover:text-ink">Show all categories</a> : undefined}>
            <div className="overflow-x-auto">
              <table className="admin-table">
                <thead><tr><th>Date</th><th>Category</th><th>Description</th><th className="text-right">Amount</th><th>Added by</th><th /></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="whitespace-nowrap text-ink/60">{fmtDay(r.spentOn)}</td>
                      <td><a href={`/admin/finance/expenses?range=${range.preset}&cat=${encodeURIComponent(r.category)}`} className="rounded-full bg-[#f4f4f1] px-2 py-0.5 text-xs font-medium hover:bg-black/10">{r.category}</a></td>
                      <td className="text-ink/75">{r.description || '—'}</td>
                      <td className="text-right font-semibold tabular">{formatBDT(r.amount)}</td>
                      <td className="text-xs text-ink/50">{r.by ?? '—'}</td>
                      <td className="text-right"><DeleteExpense id={r.id} /></td>
                    </tr>
                  ))}
                  {!rows.length && <tr><td colSpan={6}><EmptyState icon="expenses" title="No expenses in this period">Add your first one with the form.</EmptyState></td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
        <div className="space-y-6">
          <Card title="Add an expense"><ExpenseForm categories={EXPENSE_CATEGORIES} today={dhakaDate()} /></Card>
          <Card title="By category">
            <BarList color={SERIES.orange} rows={byCat.map((c) => ({ label: c.category, value: Number(c.total), sub: allTotal ? `${((Number(c.total) / allTotal) * 100).toFixed(0)}%` : undefined, href: `/admin/finance/expenses?range=${range.preset}&cat=${encodeURIComponent(c.category)}` }))} />
          </Card>
        </div>
      </div>
    </div>
  );
}
