import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db, schema } from '@/db';
import { adminCount, hashPassword, startSession } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';

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
  const [res] = await db.insert(schema.admins).values({ name, email, passwordHash });
  await startSession({ id: Number(res.insertId), email, name });
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
    <main className="grid min-h-screen place-items-center bg-ink p-6">
      <form action={createFirstAdmin} className="w-full max-w-md bg-paper p-8">
        <p className="font-display text-3xl uppercase">NEVER SETTLE</p>
        <p className="eyebrow mt-1 text-muted">Welcome. Create your admin account</p>
        <p className="mt-4 text-sm text-muted">This page only works once, before any admin exists. Do it right after your site goes up.</p>
        {e && <p className="mt-6 bg-sale/10 p-3 text-sm text-sale" role="alert">{MESSAGES[e] ?? 'Please check the form and try again.'}</p>}
        <div className="mt-6 space-y-4">
          <div><label htmlFor="name" className="label">Your name</label><input id="name" name="name" required autoComplete="name" className="field" /></div>
          <div><label htmlFor="email" className="label">Email</label><input id="email" name="email" type="email" required autoComplete="username" className="field" /></div>
          <div><label htmlFor="password" className="label">Password (min 10 characters)</label><input id="password" name="password" type="password" required minLength={10} autoComplete="new-password" className="field" /></div>
          <div><label htmlFor="confirm" className="label">Confirm password</label><input id="confirm" name="confirm" type="password" required minLength={10} autoComplete="new-password" className="field" /></div>
          <button className="btn btn-primary w-full">Create account</button>
        </div>
      </form>
    </main>
  );
}
