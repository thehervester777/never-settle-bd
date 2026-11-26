'use server';

import { eq } from 'drizzle-orm';
import qrcode from 'qrcode-generator';
import { db, schema } from '@/db';
import { checkPassword, requireAdmin, secret } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { rateLimit } from '@/lib/rate-limit';
import { headers } from 'next/headers';
import { hashRecoveryCode, newRecoveryCodes, newTotpSecret, openSecret, otpauthUrl, sealSecret, verifyTotp } from '@/lib/totp';

type Result = { ok: boolean; message: string };
const authSecret = () => new TextDecoder().decode(secret());
const row = async (id: number) => (await db.select().from(schema.admins).where(eq(schema.admins.id, id)).limit(1))[0];
const limited = async () => !rateLimit(await headers(), 'admin-2fa-settings', 10);

/** Step 1: a new key, shown as a QR code to scan. Not active until a code from the app is confirmed. */
export async function beginTwoStep(): Promise<{ ok: true; qr: string; key: string } | Result> {
  const admin = await requireAdmin();
  const a = await row(admin.id);
  if (a?.totpEnabledAt) return { ok: false, message: 'Two-step sign-in is already on.' };
  const key = newTotpSecret();
  await db.update(schema.admins).set({ totpSecret: sealSecret(key, authSecret()), totpEnabledAt: null, totpLastStep: 0 }).where(eq(schema.admins.id, admin.id));
  const qr = qrcode(0, 'M');
  qr.addData(otpauthUrl(key, admin.email, 'NEVER SETTLE'));
  qr.make();
  return { ok: true, qr: qr.createSvgTag({ cellSize: 5, margin: 2, scalable: true }), key: key.match(/.{1,4}/g)!.join(' ') };
}

/** Step 2: the first code from the app turns it on and gives the recovery codes (shown once). */
export async function confirmTwoStep(code: string): Promise<{ ok: true; codes: string[]; message: string } | Result> {
  const admin = await requireAdmin();
  if (await limited()) return { ok: false, message: 'Too many attempts. Please wait a minute.' };
  const a = await row(admin.id);
  const key = a?.totpSecret ? openSecret(a.totpSecret, authSecret()) : null;
  if (!a || !key || a.totpEnabledAt) return { ok: false, message: 'Start again: click “Turn on two-step sign-in”.' };
  const step = verifyTotp(key, String(code), 0);
  if (step === null) return { ok: false, message: 'That code didn’t match. Type the newest 6-digit code from the app.' };
  const codes = newRecoveryCodes();
  await db.update(schema.admins).set({ totpEnabledAt: new Date(), totpLastStep: step, recoveryCodes: JSON.stringify(codes.map(hashRecoveryCode)) }).where(eq(schema.admins.id, admin.id));
  await logActivity(admin, 'auth.2fa.on', 'admin', admin.id, 'Turned on two-step sign-in');
  return { ok: true, codes, message: 'Two-step sign-in is on.' };
}

/** Turning it off, or making new recovery codes, needs the password and a current code. */
async function checkBoth(adminId: number, password: string, code: string) {
  const a = await row(adminId);
  if (!a?.totpEnabledAt || !a.totpSecret) return { a, error: 'Two-step sign-in is already off.' };
  if (!(await checkPassword(String(password), a.passwordHash))) return { a, error: 'Your password is wrong.' };
  const key = openSecret(a.totpSecret, authSecret());
  const step = key ? verifyTotp(key, String(code), a.totpLastStep) : null;
  if (step === null) return { a, error: 'That code didn’t match. Type the newest 6-digit code from the app.' };
  return { a, step };
}

export async function disableTwoStep(password: string, code: string): Promise<Result> {
  const admin = await requireAdmin();
  if (await limited()) return { ok: false, message: 'Too many attempts. Please wait a minute.' };
  const r = await checkBoth(admin.id, password, code);
  if ('error' in r) return { ok: false, message: r.error! };
  await db.update(schema.admins).set({ totpSecret: null, totpEnabledAt: null, totpLastStep: 0, recoveryCodes: null }).where(eq(schema.admins.id, admin.id));
  await logActivity(admin, 'auth.2fa.off', 'admin', admin.id, 'Turned off two-step sign-in');
  return { ok: true, message: 'Two-step sign-in is off.' };
}

export async function renewRecoveryCodes(password: string, code: string): Promise<{ ok: true; codes: string[]; message: string } | Result> {
  const admin = await requireAdmin();
  if (await limited()) return { ok: false, message: 'Too many attempts. Please wait a minute.' };
  const r = await checkBoth(admin.id, password, code);
  if ('error' in r) return { ok: false, message: r.error! };
  const codes = newRecoveryCodes();
  await db.update(schema.admins).set({ totpLastStep: r.step, recoveryCodes: JSON.stringify(codes.map(hashRecoveryCode)) }).where(eq(schema.admins.id, admin.id));
  await logActivity(admin, 'auth.2fa.codes', 'admin', admin.id, 'Made new recovery codes');
  return { ok: true, codes, message: 'New recovery codes made. The old ones no longer work.' };
}
