import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { endTwoStep, pendingTwoStep, recordFailure, secret, startSession } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { rateLimit } from '@/lib/rate-limit';
import { hashRecoveryCode, openSecret, verifyTotp } from '@/lib/totp';
import { AuthLayout } from '@/components/admin/AuthLayout';

export const metadata: Metadata = { title: 'Two-step sign-in', robots: { index: false } };
export const dynamic = 'force-dynamic';

async function verify(formData: FormData) {
  'use server';
  if (!rateLimit(await headers(), 'admin-2fa', 6)) redirect('/admin/login/verify?e=rate');
  const a = await pendingTwoStep();
  if (!a) redirect('/admin/login?e=expired');
  if (a.lockedUntil && a.lockedUntil.getTime() > Date.now()) { await endTwoStep(); redirect('/admin/login?e=locked'); }
  const code = String(formData.get('code') ?? '').trim().slice(0, 40);
  const session = { id: a.id, email: a.email, name: a.name, role: a.role };
  const done = async (note: string) => {
    await endTwoStep();
    await startSession(session);
    await logActivity(session, 'auth.login', 'admin', a.id, note);
    redirect('/admin');
  };

  const key = a.totpSecret ? openSecret(a.totpSecret, new TextDecoder().decode(secret())) : null;
  const step = key ? verifyTotp(key, code, a.totpLastStep) : null;
  if (step !== null) {
    await db.update(schema.admins).set({ totpLastStep: step, failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() }).where(eq(schema.admins.id, a.id));
    await done('Signed in (two-step)');
  }
  // A recovery code: works once.
  const codes: string[] = a.recoveryCodes ? JSON.parse(a.recoveryCodes) : [];
  const i = /^[a-z0-9]{5}-?[a-z0-9]{5}$/i.test(code) ? codes.indexOf(hashRecoveryCode(code)) : -1;
  if (i >= 0) {
    codes.splice(i, 1);
    await db.update(schema.admins).set({ recoveryCodes: JSON.stringify(codes), failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() }).where(eq(schema.admins.id, a.id));
    await done(`Signed in with a recovery code (${codes.length} left)`);
  }
  await recordFailure(a.id);
  redirect('/admin/login/verify?e=code');
}

const ERRORS: Record<string, string> = {
  code: 'That code didn’t work. Check the app shows NEVER SETTLE and type the newest code.',
  rate: 'Too many attempts. Please wait a minute and try again.',
};

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const a = await pendingTwoStep();
  if (!a) redirect('/admin/login');
  const { e } = await searchParams;
  return (
    <AuthLayout title="Enter your code" subtitle={`Open your authenticator app and type the 6-digit code for ${a.email}.`}>
      {e && <p className="mt-6 rounded-xl bg-red-50 p-3 text-sm text-red-700 ring-1 ring-inset ring-red-200" role="alert">{ERRORS[e] ?? ERRORS.code}</p>}
      <form action={verify} className="mt-6 space-y-4">
        <div>
          <label htmlFor="code" className="alabel">Code</label>
          <input id="code" name="code" required autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={40} placeholder="123 456" className="ainput text-center font-mono text-xl tracking-[0.3em]" />
        </div>
        <button className="abtn abtn-primary w-full py-3">Verify</button>
      </form>
      <p className="mt-6 text-xs text-ink/45">Lost your phone? Type one of your recovery codes instead (like abcde-12345). If you have none left, ask the store owner to reset your password.</p>
      <p className="mt-3 text-xs"><a href="/admin/login" className="text-ink/60 underline">Use a different account</a></p>
    </AuthLayout>
  );
}
