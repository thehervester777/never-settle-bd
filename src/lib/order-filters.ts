import 'server-only';
import { and, eq, gte, inArray, isNull, like, lt, or, type SQL } from 'drizzle-orm';
import { schema } from '@/db';
import { ORDER_STATUSES, type OrderStatus } from '@/db/schema';
import { isDay, utcBounds } from '@/lib/dates';

export type OrderFilters = { status?: string; q?: string; from?: string; to?: string; pay?: string; page?: string; source?: string; campaign?: string; coupon?: string };

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
  // From the marketing report: orders from one source, campaign or discount code ("none" = not recorded).
  if (f.source) where.push(f.source === 'none' ? isNull(orders.source) : eq(orders.source, f.source.slice(0, 40)));
  if (f.campaign) where.push(eq(orders.campaign, f.campaign.slice(0, 120)));
  if (f.coupon) where.push(eq(orders.couponCode, f.coupon.slice(0, 40)));
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
