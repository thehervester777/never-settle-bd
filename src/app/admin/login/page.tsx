import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { adminCount, getSession, startSession, verifyLogin } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';

export const metadata: Metadata = { title: 'Admin login', robots: { index: false } };

async function login(formData: FormData) {
  'use server';
  if (!rateLimit(await headers(), 'admin-login', 5)) redirect('/admin/login?e=2');
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const admin = await verifyLogin(email, password);
  if (!admin) redirect('/admin/login?e=1');
  await startSession(admin);
  redirect('/admin');
}

export default async function AdminLogin({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  if (await getSession()) redirect('/admin');
  if ((await adminCount()) === 0) redirect('/admin/setup');
  const { e } = await searchParams;
  return (
    <main className="grid min-h-screen place-items-center bg-ink p-6">
      <form action={login} className="w-full max-w-sm bg-paper p-8">
        <p className="font-display text-3xl uppercase">NEVER SETTLE</p>
        <p className="eyebrow mt-1 text-muted">Store admin</p>
        {e && <p className="mt-6 bg-sale/10 p-3 text-sm text-sale" role="alert">{e === '2' ? 'Too many attempts. Please wait a minute and try again.' : 'Wrong email or password.'}</p>}
        <div className="mt-6 space-y-4">
          <div><label htmlFor="email" className="label">Email</label><input id="email" name="email" type="email" required autoComplete="username" className="field" /></div>
          <div><label htmlFor="password" className="label">Password</label><input id="password" name="password" type="password" required autoComplete="current-password" className="field" /></div>
          <button className="btn btn-primary w-full">Sign in</button>
        </div>
      </form>
    </main>
  );
}
