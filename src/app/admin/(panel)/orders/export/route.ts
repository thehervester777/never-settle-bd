import { desc } from 'drizzle-orm';
import { db, schema } from '@/db';
import { getSession } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { orderWhere } from '@/lib/order-filters';
import { csv, csvResponse } from '@/lib/csv';
import { dhakaDate, fmtDateTime } from '@/lib/dates';

/** Orders as a spreadsheet (CSV), with the same filters as the orders page. */
export async function GET(req: Request) {
  const admin = await getSession();
  if (!admin || !can(admin.role, 'orders.view')) return new Response('Not allowed', { status: 403 });
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const rows = await db.select().from(schema.orders).where(orderWhere(sp)).orderBy(desc(schema.orders.createdAt)).limit(20000);
  const body = csv(
    ['Order', 'Placed', 'Status', 'Payment', 'Customer', 'Phone', 'Email', 'Address', 'Area', 'City', 'Zone', 'Subtotal', 'Delivery', 'Total', 'Note'],
    rows.map((o) => [o.number, fmtDateTime(o.createdAt), o.status, o.paymentStatus, o.customerName, o.phone, o.email ?? '', o.address, o.area ?? '', o.city, o.zone,
      o.subtotal / 100, o.shippingFee / 100, o.total / 100, o.note ?? '']),
  );
  return csvResponse(body, `orders-${dhakaDate()}.csv`);
}
