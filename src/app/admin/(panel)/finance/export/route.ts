import { getSession } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { csv, csvResponse } from '@/lib/csv';
import { addMonths, resolveRange } from '@/lib/dates';
import { monthlyPnl, profitAndLoss } from '@/lib/reports';

/** The P&L statement for the chosen period, followed by a month-by-month breakdown. */
export async function GET(req: Request) {
  const admin = await getSession();
  if (!admin || !can(admin.role, 'finance')) return new Response('Not allowed', { status: 403 });
  const range = resolveRange(Object.fromEntries(new URL(req.url).searchParams), 'mtd');
  const [pl, months] = await Promise.all([profitAndLoss(range), monthlyPnl({ from: addMonths(range.to, -11), to: range.to })]);
  const t = (p: number) => p / 100;
  const rows: (string | number)[][] = [
    ['Period', `${range.from} to ${range.to}`],
    [],
    ['Product sales', t(pl.merch)], ['Delivery charges', t(pl.shipping)], ['Total revenue', t(pl.revenue)],
    ['Cost of goods sold', -t(pl.cogs)], ['Gross profit', t(pl.gross)], ['Gross margin %', +(pl.grossMargin * 100).toFixed(2)],
    [],
    ...pl.expenses.map((e) => [`Expense: ${e.category}`, -t(e.total)]),
    ['Total expenses', -t(pl.opex)], ['Net profit', t(pl.net)], ['Net margin %', +(pl.netMargin * 100).toFixed(2)],
    [],
    ['Month', 'Revenue', 'Goods sold', 'Expenses', 'Net profit'],
    ...months.map((m) => [m.key, t(m.revenue), t(m.cogs), t(m.expenses), t(m.net)]),
  ];
  return csvResponse(csv(['Profit & loss (BDT)', ''], rows), `profit-and-loss-${range.from}-to-${range.to}.csv`);
}
