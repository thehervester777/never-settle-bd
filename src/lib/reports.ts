import 'server-only';
import { sql, type SQL } from 'drizzle-orm';
import { db } from '@/db';
import { addDays, addMonths, utcBounds } from '@/lib/dates';

/*
 * Reporting queries. Raw SQL that runs the same on MySQL 8 and MariaDB. Times are stored in UTC and
 * grouped by Bangladesh calendar day (UTC+6). Money is in poisha.
 *
 * Definitions used everywhere:
 * - Sales: orders placed in the period, excluding cancelled and returned ones (order value incl. delivery,
 *   after discount codes).
 * - Product sales ("merch") are after discount codes, so margins and profit are real.
 * - Revenue (P&L): delivered orders, counted on the day they were delivered.
 * - Cost of goods: unit cost captured when the order was placed; for older orders without one, the
 *   variant's current cost.
 */

type Row = Record<string, unknown>;
async function rows<T extends Row>(q: SQL): Promise<T[]> {
  const [r] = (await db.execute(q)) as unknown as [T[]];
  return r;
}
const num = (v: unknown) => Number(v ?? 0) || 0;
const ts = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ');
const DHAKA = (col: SQL) => sql`DATE_ADD(${col}, INTERVAL 6 HOUR)`;
const bucket = (col: SQL, by: 'day' | 'month') => sql`DATE_FORMAT(${DHAKA(col)}, ${by === 'day' ? '%Y-%m-%d' : '%Y-%m'})`;
const ITEM_COST = sql`(oi.quantity * COALESCE(NULLIF(oi.unit_cost, 0), v.cost, 0))`;
const LIVE = sql`o.status NOT IN ('CANCELLED', 'RETURNED')`;

export type Span = { from: string; to: string };

/** Every day or month key in a span, so charts show zero days instead of skipping them. */
export function buckets(span: Span, by: 'day' | 'month'): string[] {
  const out: string[] = [];
  if (by === 'day') for (let d = span.from; d <= span.to; d = addDays(d, 1)) out.push(d);
  else for (let m = `${span.from.slice(0, 7)}-01`; m.slice(0, 7) <= span.to.slice(0, 7); m = addMonths(m, 1)) out.push(m.slice(0, 7));
  return out;
}

export async function salesSummary(span: Span) {
  const [a, b] = utcBounds(span);
  const [s] = await rows(sql`
    SELECT COUNT(*) AS orders, COALESCE(SUM(o.total), 0) AS sales, COALESCE(SUM(o.subtotal - o.discount), 0) AS merch,
      COALESCE(SUM(o.shipping_fee), 0) AS shipping, COALESCE(SUM(o.discount), 0) AS discounts
    FROM orders o WHERE o.created_at >= ${ts(a)} AND o.created_at < ${ts(b)} AND ${LIVE}`);
  const [c] = await rows(sql`
    SELECT COALESCE(SUM(${ITEM_COST}), 0) AS cogs, COALESCE(SUM(oi.quantity), 0) AS units
    FROM order_items oi JOIN orders o ON o.id = oi.order_id LEFT JOIN variants v ON v.id = oi.variant_id
    WHERE o.created_at >= ${ts(a)} AND o.created_at < ${ts(b)} AND ${LIVE}`);
  const [x] = await rows(sql`
    SELECT COUNT(*) AS placed, SUM(o.status IN ('CANCELLED', 'RETURNED')) AS lost
    FROM orders o WHERE o.created_at >= ${ts(a)} AND o.created_at < ${ts(b)}`);
  const sales = num(s.sales), merch = num(s.merch), cogs = num(c.cogs), orders = num(s.orders);
  return {
    orders, sales, merch, shipping: num(s.shipping), discounts: num(s.discounts), cogs, units: num(c.units),
    grossProfit: merch - cogs, margin: merch ? (merch - cogs) / merch : 0, aov: orders ? sales / orders : 0,
    placed: num(x.placed), cancelRate: num(x.placed) ? num(x.lost) / num(x.placed) : 0,
  };
}

export async function salesSeries(span: Span, by: 'day' | 'month') {
  const [a, b] = utcBounds(span);
  const o1 = await rows<{ k: string; sales: unknown; orders: unknown; merch: unknown }>(sql`
    SELECT ${bucket(sql`o.created_at`, by)} AS k, SUM(o.total) AS sales, COUNT(*) AS orders, SUM(o.subtotal - o.discount) AS merch
    FROM orders o WHERE o.created_at >= ${ts(a)} AND o.created_at < ${ts(b)} AND ${LIVE} GROUP BY k`);
  const c1 = await rows<{ k: string; cogs: unknown }>(sql`
    SELECT ${bucket(sql`o.created_at`, by)} AS k, SUM(${ITEM_COST}) AS cogs
    FROM order_items oi JOIN orders o ON o.id = oi.order_id LEFT JOIN variants v ON v.id = oi.variant_id
    WHERE o.created_at >= ${ts(a)} AND o.created_at < ${ts(b)} AND ${LIVE} GROUP BY k`);
  const om = new Map(o1.map((r) => [r.k, r]));
  const cm = new Map(c1.map((r) => [r.k, num(r.cogs)]));
  return buckets(span, by).map((k) => {
    const r = om.get(k);
    return { key: k, sales: num(r?.sales), orders: num(r?.orders), grossProfit: num(r?.merch) - (cm.get(k) ?? 0) };
  });
}

export async function statusCounts(span: Span) {
  const [a, b] = utcBounds(span);
  const r = await rows<{ status: string; n: unknown; value: unknown }>(sql`
    SELECT o.status, COUNT(*) AS n, SUM(o.total) AS value FROM orders o
    WHERE o.created_at >= ${ts(a)} AND o.created_at < ${ts(b)} GROUP BY o.status`);
  return new Map(r.map((x) => [x.status, { n: num(x.n), value: num(x.value) }]));
}

export async function topProducts(span: Span, limit = 6) {
  const [a, b] = utcBounds(span);
  const r = await rows<{ id: unknown; title: string; units: unknown; revenue: unknown; cogs: unknown }>(sql`
    SELECT oi.product_id AS id, MAX(oi.title) AS title, SUM(oi.quantity) AS units, SUM(oi.quantity * oi.unit_price) AS revenue, SUM(${ITEM_COST}) AS cogs
    FROM order_items oi JOIN orders o ON o.id = oi.order_id LEFT JOIN variants v ON v.id = oi.variant_id
    WHERE o.created_at >= ${ts(a)} AND o.created_at < ${ts(b)} AND ${LIVE}
    GROUP BY oi.product_id ORDER BY revenue DESC LIMIT ${limit}`);
  return r.map((x) => ({ id: num(x.id), title: x.title, units: num(x.units), revenue: num(x.revenue), profit: num(x.revenue) - num(x.cogs) }));
}

export async function salesByCity(span: Span, limit = 6) {
  const [a, b] = utcBounds(span);
  const r = await rows<{ city: string; n: unknown; value: unknown }>(sql`
    SELECT o.city, COUNT(*) AS n, SUM(o.total) AS value FROM orders o
    WHERE o.created_at >= ${ts(a)} AND o.created_at < ${ts(b)} AND ${LIVE}
    GROUP BY o.city ORDER BY value DESC LIMIT ${limit}`);
  return r.map((x) => ({ city: x.city, orders: num(x.n), value: num(x.value) }));
}

/* ---------------------------------------------------------------- Profit & loss */

export async function profitAndLoss(span: Span) {
  const [a, b] = utcBounds(span);
  const delivered = sql`o.status = 'DELIVERED' AND COALESCE(o.delivered_at, o.updated_at) >= ${ts(a)} AND COALESCE(o.delivered_at, o.updated_at) < ${ts(b)}`;
  const [rev] = await rows(sql`
    SELECT COUNT(*) AS orders, COALESCE(SUM(o.subtotal), 0) AS merch, COALESCE(SUM(o.discount), 0) AS discounts, COALESCE(SUM(o.shipping_fee), 0) AS shipping
    FROM orders o WHERE ${delivered}`);
  const [cg] = await rows(sql`
    SELECT COALESCE(SUM(${ITEM_COST}), 0) AS cogs, COALESCE(SUM(oi.quantity), 0) AS units
    FROM order_items oi JOIN orders o ON o.id = oi.order_id LEFT JOIN variants v ON v.id = oi.variant_id WHERE ${delivered}`);
  const exp = await rows<{ category: string; total: unknown }>(sql`
    SELECT category, SUM(amount) AS total FROM expenses WHERE spent_on >= ${span.from} AND spent_on <= ${span.to}
    GROUP BY category ORDER BY total DESC`);
  const [pipe] = await rows(sql`
    SELECT COUNT(*) AS orders, COALESCE(SUM(o.total), 0) AS value FROM orders o WHERE o.status IN ('PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED')`);

  const merch = num(rev.merch), discounts = num(rev.discounts), shipping = num(rev.shipping), cogs = num(cg.cogs);
  const revenue = merch - discounts + shipping;
  const gross = revenue - cogs;
  const expenses = exp.map((e) => ({ category: e.category, total: num(e.total) }));
  const opex = expenses.reduce((s, e) => s + e.total, 0);
  const net = gross - opex;
  return {
    orders: num(rev.orders), units: num(cg.units), merch, discounts, shipping, revenue, cogs, gross, expenses, opex, net,
    grossMargin: revenue ? gross / revenue : 0, netMargin: revenue ? net / revenue : 0,
    pipeline: { orders: num(pipe.orders), value: num(pipe.value) },
  };
}

export async function monthlyPnl(span: Span) {
  const [a, b] = utcBounds(span);
  const delivered = sql`o.status = 'DELIVERED' AND COALESCE(o.delivered_at, o.updated_at) >= ${ts(a)} AND COALESCE(o.delivered_at, o.updated_at) < ${ts(b)}`;
  const at = sql`COALESCE(o.delivered_at, o.updated_at)`;
  const rev = await rows<{ k: string; revenue: unknown }>(sql`
    SELECT ${bucket(at, 'month')} AS k, SUM(o.subtotal - o.discount + o.shipping_fee) AS revenue FROM orders o WHERE ${delivered} GROUP BY k`);
  const cg = await rows<{ k: string; cogs: unknown }>(sql`
    SELECT ${bucket(at, 'month')} AS k, SUM(${ITEM_COST}) AS cogs
    FROM order_items oi JOIN orders o ON o.id = oi.order_id LEFT JOIN variants v ON v.id = oi.variant_id WHERE ${delivered} GROUP BY k`);
  const ex = await rows<{ k: string; total: unknown }>(sql`
    SELECT DATE_FORMAT(spent_on, '%Y-%m') AS k, SUM(amount) AS total FROM expenses
    WHERE spent_on >= ${span.from} AND spent_on <= ${span.to} GROUP BY k`);
  const r = new Map(rev.map((x) => [x.k, num(x.revenue)]));
  const c = new Map(cg.map((x) => [x.k, num(x.cogs)]));
  const e = new Map(ex.map((x) => [x.k, num(x.total)]));
  return buckets(span, 'month').map((k) => {
    const revenue = r.get(k) ?? 0, cogs = c.get(k) ?? 0, expenses = e.get(k) ?? 0;
    return { key: k, revenue, cogs, expenses, costs: cogs + expenses, net: revenue - cogs - expenses };
  });
}

/* ---------------------------------------------------------------- Inventory */

export async function inventoryTotals(lowAt: number) {
  const [r] = await rows(sql`
    SELECT COUNT(*) AS skus, COALESCE(SUM(GREATEST(v.stock, 0)), 0) AS units,
      COALESCE(SUM(GREATEST(v.stock, 0) * v.cost), 0) AS costValue, COALESCE(SUM(GREATEST(v.stock, 0) * p.price), 0) AS retailValue,
      SUM(v.stock <= 0) AS outOfStock, SUM(v.stock > 0 AND v.stock <= ${lowAt}) AS low, SUM(v.cost = 0) AS noCost
    FROM variants v JOIN products p ON p.id = v.product_id WHERE p.is_active = 1`);
  return {
    skus: num(r.skus), units: num(r.units), costValue: num(r.costValue), retailValue: num(r.retailValue),
    outOfStock: num(r.outOfStock), low: num(r.low), noCost: num(r.noCost),
  };
}
