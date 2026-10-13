import 'server-only';
import { and, eq, gte, inArray, like, lt, or, type SQL } from 'drizzle-orm';
import { schema } from '@/db';
import { ORDER_STATUSES, type OrderStatus } from '@/db/schema';
import { isDay, utcBounds } from '@/lib/dates';

export type OrderFilters = { status?: string; q?: string; from?: string; to?: string; pay?: string; page?: string };

/** WHERE clause for the orders list, its tab counts (without status) and the CSV export. */
export function orderWhere(f: OrderFilters, opts: { ignoreStatus?: boolean } = {}): SQL | undefined {
  const { orders } = schema;
  const where: SQL[] = [];
  if (!opts.ignoreStatus) {
    if (f.status === 'TO_CONFIRM') where.push(eq(orders.status, 'PENDING'));
    else if (f.status === 'TO_SHIP') where.push(inArray(orders.status, ['CONFIRMED', 'PROCESSING']));
    else if (f.status && (ORDER_STATUSES as readonly string[]).includes(f.status)) where.push(eq(orders.status, f.status as OrderStatus));
  }
  if (f.pay === 'PAID' || f.pay === 'UNPAID' || f.pay === 'REFUNDED') where.push(eq(orders.paymentStatus, f.pay));
  const q = f.q?.trim();
  if (q) {
    const term = `%${q.replace(/[%_]/g, '')}%`;
    where.push(or(like(orders.number, term), like(orders.phone, term), like(orders.customerName, term), like(orders.city, term))!);
  }
  if (isDay(f.from) || isDay(f.to)) {
    const [start, end] = utcBounds({ from: isDay(f.from) ? f.from : '2000-01-01', to: isDay(f.to) ? f.to : '2999-12-31' });
    where.push(gte(orders.createdAt, start), lt(orders.createdAt, end));
  }
  return where.length ? and(...where) : undefined;
}
