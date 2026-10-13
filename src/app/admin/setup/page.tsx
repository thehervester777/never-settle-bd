import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db, schema } from '@/db';
import { adminCount, hashPassword, startSession } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { logActivity } from '@/lib/activity';
import { AuthLayout } from '@/components/admin/AuthLayout';

export const metadata: Metadata = { title: 'Create admin account', robots: { index: false } };
export const dynamic = 'force-dynamic';

/**
 * First-run setup: lets you create the first admin from the browser, for hosts without a terminal.
 * It only works while there are NO admin accounts; after that it always sends you to the login page.
 */
const setupSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(160),
  password: z.string().min(10).max(200),
  confirm: z.string(),
}).refine((v) => v.password === v.confirm, { path: ['confirm'] });

async function createFirstAdmin(formData: FormData) {
  'use server';
  if (!rateLimit(await headers(), 'admin-setup', 5)) redirect('/admin/setup?e=rate');
  if ((await adminCount()) > 0) redirect('/admin/login');
  const parsed = setupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? 'form');
    redirect(`/admin/setup?e=${encodeURIComponent(field)}`);
  }
  const { name, email, password } = parsed.data;
  const passwordHash = await hashPassword(password);
  // Re-check right before writing so two people can't both claim the store.
  if ((await adminCount()) > 0) redirect('/admin/login');
  const [res] = await db.insert(schema.admins).values({ name, email, passwordHash, role: 'OWNER', lastLoginAt: new Date() });
  const id = Number(res.insertId);
  await startSession({ id });
  await logActivity({ id, name, email, role: 'OWNER' }, 'auth.setup', 'admin', id, 'Created the store owner account');
  redirect('/admin');
}

const MESSAGES: Record<string, string> = {
  name: 'Please enter your name.',
  email: 'Please enter a valid email address.',
  password: 'Use a password of at least 10 characters.',
  confirm: "The two passwords don't match.",
  rate: 'Too many attempts. Please wait a minute and try again.',
};

export default async function AdminSetup({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  if ((await adminCount()) > 0) redirect('/admin/login');
  const { e } = await searchParams;
  return (
    <AuthLayout title="Create your owner account" subtitle="This page works only once, before any admin exists. Do it right after your site goes up.">
      {e && <p className="mt-6 rounded-xl bg-red-50 p-3 text-sm text-red-700 ring-1 ring-inset ring-red-200" role="alert">{MESSAGES[e] ?? 'Please check the form and try again.'}</p>}
      <form action={createFirstAdmin} className="mt-6 space-y-4">
        <div><label htmlFor="name" className="alabel">Your name</label><input id="name" name="name" required autoComplete="name" className="ainput" /></div>
        <div><label htmlFor="email" className="alabel">Email</label><input id="email" name="email" type="email" required autoComplete="username" className="ainput" /></div>
        <div><label htmlFor="password" className="alabel">Password (at least 10 characters)</label><input id="password" name="password" type="password" required minLength={10} autoComplete="new-password" className="ainput" /></div>
        <div><label htmlFor="confirm" className="alabel">Confirm password</label><input id="confirm" name="confirm" type="password" required minLength={10} autoComplete="new-password" className="ainput" /></div>
        <button className="abtn abtn-primary w-full py-3">Create account</button>
      </form>
    </AuthLayout>
  );
}
