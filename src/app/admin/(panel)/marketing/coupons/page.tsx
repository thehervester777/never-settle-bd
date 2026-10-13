import { desc } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requirePermission } from '@/lib/auth';
import { formatBDT } from '@/lib/money';
import { fmtDateTime } from '@/lib/dates';
import { couponState, couponSummary } from '@/lib/coupons';
import { couponTotals } from '@/lib/marketing-reports';
import { siteUrl } from '@/lib/site';
import { PageHeader } from '@/components/admin/ui';
import { StatTile } from '@/components/admin/StatTile';
import { CouponManager, type CouponRow } from '@/components/admin/MarketingTools';

export const metadata = { title: 'Discount codes' };

export default async function CouponsPage() {
  await requirePermission('marketing');
  const [rows, totals] = await Promise.all([db.select().from(schema.coupons).orderBy(desc(schema.coupons.createdAt), desc(schema.coupons.id)), couponTotals()]);
  const now = new Date();
  const coupons: CouponRow[] = rows.map((c) => {
    const t = totals.get(c.code);
    const state = couponState(c, now);
    return {
      id: c.id, code: c.code, description: c.description, type: c.type, value: c.value, minSubtotal: c.minSubtotal, maxDiscount: c.maxDiscount,
      usageLimit: c.usageLimit, usedCount: c.usedCount, oncePerCustomer: c.oncePerCustomer,
      startsAt: c.startsAt?.toISOString() ?? null, endsAt: c.endsAt?.toISOString() ?? null, isActive: c.isActive,
      state: state === 'used-up' ? 'USED_UP' : state.toUpperCase(), summary: couponSummary(c),
      window: c.startsAt && c.startsAt > now ? `From ${fmtDateTime(c.startsAt)}` : c.endsAt ? `${c.endsAt > now ? 'Until' : 'Ended'} ${fmtDateTime(c.endsAt)}` : 'No end date',
      orders: t?.orders ?? 0, sales: formatBDT(t?.sales ?? 0), discountGiven: formatBDT(t?.discount ?? 0),
    };
  });
  const live = rows.filter((c) => couponState(c, now) === 'active').length;
  const all = [...totals.values()];
  const sum = (k: 'orders' | 'discount' | 'sales') => all.reduce((s, x) => s + x[k], 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Discount codes" description="Run offers for your campaigns. Share a code as a link (yourstore.com/?code=EID20) and it applies itself at checkout." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Live codes" value={live} icon="ticket" hint={`${rows.length} in total`} />
        <StatTile label="Orders with a code" value={sum('orders')} icon="orders" hint="All time, excluding cancelled" />
        <StatTile label="Sales with a code" value={sum('sales')} format="bdt" icon="cash" />
        <StatTile tone="accent" label="Discount given" value={sum('discount')} format="bdt" icon="sparkle" hint="Shown in Profit & loss" />
      </div>
      <CouponManager coupons={coupons} site={siteUrl()} />
    </div>
  );
}
