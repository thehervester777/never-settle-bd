import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { endSession, requireAdmin } from '@/lib/auth';
import { AdminNav } from '@/components/admin/AdminNav';

export const metadata: Metadata = { title: { default: 'Admin', template: '%s — Admin' }, robots: { index: false } };
export const dynamic = 'force-dynamic';

async function logout() {
  'use server';
  await endSession();
  redirect('/admin/login');
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <div className="min-h-screen bg-[#f6f5f2] md:grid md:grid-cols-[240px_1fr]">
      <aside className="bg-ink text-paper md:sticky md:top-0 md:h-screen">
        <div className="flex items-center justify-between gap-4 p-5 md:block">
          <div>
            <Link href="/admin" className="font-display text-2xl uppercase">NEVER SETTLE</Link>
            <p className="eyebrow mt-1 text-paper/50">Admin</p>
          </div>
          {/* On phones the sidebar footer is hidden, so the store link and log out live up here */}
          <div className="flex items-center gap-4 text-xs text-paper/70 md:hidden">
            <Link href="/" target="_blank" className="underline">Store ↗</Link>
            <form action={logout}><button className="underline">Log out</button></form>
          </div>
        </div>
        <AdminNav />
        <div className="hidden p-5 text-xs text-paper/60 md:absolute md:bottom-0 md:block">
          <p>{admin.name}</p>
          <form action={logout}><button className="mt-2 underline">Log out</button></form>
          <Link href="/" target="_blank" className="mt-2 block underline">View store ↗</Link>
        </div>
      </aside>
      <div className="min-w-0 p-4 md:p-8">{children}</div>
    </div>
  );
}
