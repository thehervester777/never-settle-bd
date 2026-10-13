import type { Metadata } from 'next';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { and, count, eq, lte, or } from 'drizzle-orm';
import { db, schema } from '@/db';
import { endSession, requireAdmin } from '@/lib/auth';
import { can, ROLE_INFO } from '@/lib/permissions';
import { getSettings } from '@/lib/settings';
import { AdminShell } from '@/components/admin/AdminShell';
import { FlashToast } from '@/components/admin/FlashToast';
import { NAV } from '@/components/admin/nav';

export const metadata: Metadata = { title: { default: 'Admin', template: '%s — Admin' }, robots: { index: false } };
export const dynamic = 'force-dynamic';

async function logout() {
  'use server';
  await endSession();
  redirect('/admin/login');
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const { orders, messages, variants, products } = schema;
  const settings = await getSettings();
  const zero = Promise.resolve([{ n: 0 }]);
  const [[toConfirm], [unread], [lowStock]] = await Promise.all([
    can(admin.role, 'orders.view') ? db.select({ n: count() }).from(orders).where(and(eq(orders.status, 'PENDING'), or(eq(orders.paymentMethod, 'COD'), eq(orders.paymentStatus, 'PAID')))) : zero,
    can(admin.role, 'messages') ? db.select({ n: count() }).from(messages).where(eq(messages.isRead, false)) : zero,
    can(admin.role, 'inventory')
      ? db.select({ n: count() }).from(variants).innerJoin(products, eq(variants.productId, products.id)).where(and(lte(variants.stock, settings.lowStockThreshold), eq(products.isActive, true)))
      : zero,
  ]);
  const nav = NAV.map((g) => ({ ...g, items: g.items.filter((i) => !i.perm || can(admin.role, i.perm)) })).filter((g) => g.items.length);

  return (
    <AdminShell
      admin={{ name: admin.name, email: admin.email, roleLabel: ROLE_INFO[admin.role]?.label ?? admin.role }}
      nav={nav}
      badges={{ toConfirm: Number(toConfirm.n), unread: Number(unread.n), lowStock: Number(lowStock.n) }}
      canSearchOrders={can(admin.role, 'orders.view')}
      logout={logout}
    >
      {children}
      <Suspense><FlashToast /></Suspense>
    </AdminShell>
  );
}
