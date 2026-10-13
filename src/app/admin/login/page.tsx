import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { adminCount, getSession, startSession, verifyLogin } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { rateLimit } from '@/lib/rate-limit';
import { AuthLayout } from '@/components/admin/AuthLayout';

export const metadata: Metadata = { title: 'Admin login', robots: { index: false } };
export const dynamic = 'force-dynamic';

async function login(formData: FormData) {
  'use server';
  if (!rateLimit(await headers(), 'admin-login', 5)) redirect('/admin/login?e=rate');
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const result = await verifyLogin(email, password);
  if (!result.ok) redirect(`/admin/login?e=${result.reason}`);
  await startSession(result.admin);
  await logActivity(result.admin, 'auth.login', 'admin', result.admin.id, 'Signed in');
  redirect('/admin');
}

const ERRORS: Record<string, string> = {
  invalid: 'Wrong email or password.',
  disabled: 'This account has been turned off. Ask the store owner to turn it back on.',
  rate: 'Too many attempts. Please wait a minute and try again.',
};

export default async function AdminLogin({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  if (await getSession()) redirect('/admin');
  if ((await adminCount()) === 0) redirect('/admin/setup');
  const { e } = await searchParams;
  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to manage your store.">
      {e && <p className="mt-6 rounded-xl bg-red-50 p-3 text-sm text-red-700 ring-1 ring-inset ring-red-200" role="alert">{ERRORS[e] ?? ERRORS.invalid}</p>}
      <form action={login} className="mt-6 space-y-4">
        <div><label htmlFor="email" className="alabel">Email</label><input id="email" name="email" type="email" required autoComplete="username" className="ainput" /></div>
        <div><label htmlFor="password" className="alabel">Password</label><input id="password" name="password" type="password" required autoComplete="current-password" className="ainput" /></div>
        <button className="abtn abtn-primary w-full py-3">Sign in</button>
      </form>
      <p className="mt-6 text-xs text-ink/45">Forgot your password? Ask the store owner to reset it from Team &amp; roles.</p>
    </AuthLayout>
  );
}
