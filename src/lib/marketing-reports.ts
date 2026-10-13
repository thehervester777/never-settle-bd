import 'server-only';
import { sql, type SQL } from 'drizzle-orm';
import { db } from '@/db';
import { utcBounds } from '@/lib/dates';
import { buckets, type Span } from '@/lib/reports';

/*
 * Marketing report: where orders came from, what campaigns and discount codes brought in, and what
 * the ads cost. Ad spend is the "Marketing & ads" expense category; its description starts with the
 * platform ("Meta ads · …") when logged from the marketing page, which gives ROAS per platform.
 * Sales = orders placed in the period, excluding cancelled and returned ones (after discounts, incl. delivery).
 */

type Row = Record<string, unknown>;
async function rows<T extends Row>(q: SQL): Promise<T[]> {
  const [r] = (await db.execute(q)) as unknown as [T[]];
  return r;
}
const num = (v: unknown) => Number(v ?? 0) || 0;
const ts = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ');
const LIVE = sql`o.status NOT IN ('CANCELLED', 'RETURNED')`;
const PAID = sql`(o.medium LIKE '%paid%' OR o.medium IN ('cpc', 'ppc', 'cpm', 'cpa', 'ad', 'ads', 'display', 'banner'))`;

export const AD_CATEGORY = 'Marketing & ads';

export const AD_PLATFORMS = [
  { key: 'meta', label: 'Meta (Facebook & Instagram)', prefix: 'Meta ads', sources: ['facebook', 'instagram', 'messenger'] },
  { key: 'tiktok', label: 'TikTok', prefix: 'TikTok ads', sources: ['tiktok'] },
  { key: 'google', label: 'Google & YouTube', prefix: 'Google ads', sources: ['google', 'youtube'] },
  { key: 'other', label: 'Other (influencers, boosts…)', prefix: 'Other marketing', sources: [] as string[] },
] as const;
export type AdPlatform = (typeof AD_PLATFORMS)[number]['key'];

const range = (span: Span) => {
  const [a, b] = utcBounds(span);
  return sql`o.created_at >= ${ts(a)} AND o.created_at < ${ts(b)}`;
};

export async function marketingSummary(span: Span) {
  const [s] = await rows(sql`
    SELECT COUNT(*) AS placed, SUM(${LIVE}) AS orders, COALESCE(SUM(CASE WHEN ${LIVE} THEN o.total END), 0) AS sales,
      SUM(${LIVE} AND ${PAID}) AS paidOrders, COALESCE(SUM(CASE WHEN ${LIVE} AND ${PAID} THEN o.total END), 0) AS paidSales,
      SUM(${LIVE} AND o.source IS NOT NULL AND o.source <> 'direct') AS referred,
      SUM(${LIVE} AND o.coupon_code IS NOT NULL) AS couponOrders, COALESCE(SUM(CASE WHEN ${LIVE} THEN o.discount END), 0) AS discounts
    FROM orders o WHERE ${range(span)}`);
  const [e] = await rows(sql`SELECT COALESCE(SUM(amount), 0) AS spend FROM expenses WHERE category = ${AD_CATEGORY} AND spent_on >= ${span.from} AND spent_on <= ${span.to}`);
  const orders = num(s.orders), sales = num(s.sales), spend = num(e.spend), paidOrders = num(s.paidOrders), paidSales = num(s.paidSales);
  return {
    placed: num(s.placed), orders, sales, paidOrders, paidSales, referred: num(s.referred), couponOrders: num(s.couponOrders), discounts: num(s.discounts), spend,
    roas: spend ? sales / spend : null, // blended: all sales per taka of ads
    paidRoas: spend && paidOrders ? paidSales / spend : null,
    costPerOrder: spend && orders ? spend / orders : null,
  };
}

export async function salesBySource(span: Span) {
  const r = await rows<{ source: string | null; placed: unknown; orders: unknown; sales: unknown; delivered: unknown; lost: unknown; paid: unknown }>(sql`
    SELECT o.source, COUNT(*) AS placed, SUM(${LIVE}) AS orders, COALESCE(SUM(CASE WHEN ${LIVE} THEN o.total END), 0) AS sales,
      SUM(o.status = 'DELIVERED') AS delivered, SUM(o.status IN ('CANCELLED', 'RETURNED')) AS lost, SUM(${LIVE} AND ${PAID}) AS paid
    FROM orders o WHERE ${range(span)} GROUP BY o.source ORDER BY sales DESC, placed DESC`);
  return r.map((x) => ({
    source: x.source, placed: num(x.placed), orders: num(x.orders), sales: num(x.sales), delivered: num(x.delivered), lost: num(x.lost), paid: num(x.paid),
  }));
}

export async function salesByCampaign(span: Span, limit = 15) {
  const r = await rows<{ campaign: string; source: string | null; medium: string | null; orders: unknown; sales: unknown; placed: unknown }>(sql`
    SELECT o.campaign, MAX(o.source) AS source, MAX(o.medium) AS medium, COUNT(*) AS placed, SUM(${LIVE}) AS orders,
      COALESCE(SUM(CASE WHEN ${LIVE} THEN o.total END), 0) AS sales
    FROM orders o WHERE ${range(span)} AND o.campaign IS NOT NULL AND o.campaign <> ''
    GROUP BY o.campaign ORDER BY sales DESC LIMIT ${limit}`);
  return r.map((x) => ({ campaign: x.campaign, source: x.source, medium: x.medium, placed: num(x.placed), orders: num(x.orders), sales: num(x.sales) }));
}

export async function couponPerformance(span: Span) {
  const r = await rows<{ code: string; orders: unknown; discount: unknown; sales: unknown }>(sql`
    SELECT o.coupon_code AS code, SUM(${LIVE}) AS orders, COALESCE(SUM(CASE WHEN ${LIVE} THEN o.discount END), 0) AS discount,
      COALESCE(SUM(CASE WHEN ${LIVE} THEN o.total END), 0) AS sales
    FROM orders o WHERE ${range(span)} AND o.coupon_code IS NOT NULL GROUP BY o.coupon_code ORDER BY sales DESC`);
  return r.map((x) => ({ code: x.code, orders: num(x.orders), discount: num(x.discount), sales: num(x.sales) }));
}

/** Coupon totals over all time, for the discount codes list. */
export async function couponTotals() {
  const r = await rows<{ code: string; orders: unknown; discount: unknown; sales: unknown }>(sql`
    SELECT o.coupon_code AS code, SUM(${LIVE}) AS orders, COALESCE(SUM(CASE WHEN ${LIVE} THEN o.discount END), 0) AS discount,
      COALESCE(SUM(CASE WHEN ${LIVE} THEN o.total END), 0) AS sales
    FROM orders o WHERE o.coupon_code IS NOT NULL GROUP BY o.coupon_code`);
  return new Map(r.map((x) => [x.code, { orders: num(x.orders), discount: num(x.discount), sales: num(x.sales) }]));
}

/** Ad spend and the sales from each platform's sources (all mediums: ads and organic posts). */
export async function platformReturns(span: Span) {
  const spendRows = await rows<{ description: string; amount: unknown }>(sql`
    SELECT description, SUM(amount) AS amount FROM expenses WHERE category = ${AD_CATEGORY} AND spent_on >= ${span.from} AND spent_on <= ${span.to}
    GROUP BY description`);
  const bySource = await salesBySource(span);
  return AD_PLATFORMS.map((p) => {
    const spend = spendRows.filter((r) => (p.key === 'other' ? !AD_PLATFORMS.slice(0, 3).some((q) => r.description.startsWith(q.prefix)) : r.description.startsWith(p.prefix)))
      .reduce((s, r) => s + num(r.amount), 0);
    const src = bySource.filter((r) => r.source && (p.sources as readonly string[]).includes(r.source));
    const orders = src.reduce((s, r) => s + r.orders, 0), sales = src.reduce((s, r) => s + r.sales, 0), paid = src.reduce((s, r) => s + r.paid, 0);
    return { ...p, spend, orders, sales, paid, roas: spend ? sales / spend : null, costPerOrder: spend && orders ? spend / orders : null };
  });
}

/** Daily sales split into tagged ads vs everything else. */
export async function paidVsOtherSeries(span: Span) {
  const r = await rows<{ k: string; paid: unknown; other: unknown }>(sql`
    SELECT DATE_FORMAT(DATE_ADD(o.created_at, INTERVAL 6 HOUR), '%Y-%m-%d') AS k,
      COALESCE(SUM(CASE WHEN ${PAID} THEN o.total END), 0) AS paid, COALESCE(SUM(CASE WHEN NOT ${PAID} OR o.medium IS NULL THEN o.total END), 0) AS other
    FROM orders o WHERE ${range(span)} AND ${LIVE} GROUP BY k`);
  const m = new Map(r.map((x) => [x.k, x]));
  return buckets(span, 'day').map((k) => ({ key: k, paid: num(m.get(k)?.paid), other: num(m.get(k)?.other) }));
}

export async function recentAdSpend(limit = 8) {
  return rows<{ id: number; spent_on: string; description: string; amount: number }>(sql`
    SELECT id, DATE_FORMAT(spent_on, '%Y-%m-%d') AS spent_on, description, amount FROM expenses WHERE category = ${AD_CATEGORY}
    ORDER BY spent_on DESC, id DESC LIMIT ${limit}`);
}
