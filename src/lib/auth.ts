import 'server-only';
import crypto from 'crypto';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { eq, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import type { AdminRole } from '@/db/schema';
import { can, type Permission } from '@/lib/permissions';
import { secretProblem } from '@/lib/secret-check';

const COOKIE = 'ns_admin';
const MAX_AGE = 60 * 60 * 12; // 12 hours

export function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || secretProblem(s)) throw new Error('AUTH_SECRET must be set to your own random string of at least 32 characters.');
  return new TextEncoder().encode(s);
}

export type AdminSession = { id: number; email: string; name: string; role: AdminRole };

// Changes whenever the password does, so a password change signs out every other browser.
const passwordVersion = (hash: string) => crypto.createHash('sha256').update(hash).digest('hex').slice(0, 16);

type LoginResult =
  | { ok: true; admin: AdminSession; twoStep: boolean }
  | { ok: false; reason: 'invalid' | 'disabled' | 'locked'; minutes?: number };

const LOCK_AFTER = 5; // wrong passwords or codes in a row
const LOCK_MINUTES = 15;
const DUMMY_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEeO5nZtFhA4l5X7Qf6c5pX9e4Yb2mJ8x0K';

const minutesLeft = (until: Date | null) => (until && until.getTime() > Date.now() ? Math.ceil((until.getTime() - Date.now()) / 60_000) : 0);

/** Counts a wrong password or code; every 5th in a row locks the account (15 min, then 30, 60… up to a day). */
export async function recordFailure(adminId: number) {
  await db.update(schema.admins).set({ failedLogins: sql`${schema.admins.failedLogins} + 1` }).where(eq(schema.admins.id, adminId));
  const [row] = await db.select({ n: schema.admins.failedLogins }).from(schema.admins).where(eq(schema.admins.id, adminId)).limit(1);
  if (!row || row.n % LOCK_AFTER !== 0) return;
  const minutes = Math.min(LOCK_MINUTES * 2 ** (row.n / LOCK_AFTER - 1), 24 * 60);
  await db.update(schema.admins).set({ lockedUntil: new Date(Date.now() + minutes * 60_000) }).where(eq(schema.admins.id, adminId));
}

export async function verifyLogin(email: string, password: string): Promise<LoginResult> {
  const [admin] = await db.select().from(schema.admins).where(eq(schema.admins.email, email.toLowerCase().trim().slice(0, 160))).limit(1);
  // Compare against a dummy hash when the email is unknown so response time doesn't reveal which emails exist.
  const ok = await bcrypt.compare(password.slice(0, 200), admin?.passwordHash ?? DUMMY_HASH);
  if (!admin) return { ok: false, reason: 'invalid' };
  const locked = minutesLeft(admin.lockedUntil);
  // While locked even the right password is refused, so guessing can't continue in the background.
  if (locked) return { ok: false, reason: 'locked', minutes: locked };
  if (!ok) { await recordFailure(admin.id); return { ok: false, reason: 'invalid' }; }
  if (!admin.isActive) return { ok: false, reason: 'disabled' };
  const twoStep = !!(admin.totpEnabledAt && admin.totpSecret);
  if (!twoStep) await db.update(schema.admins).set({ lastLoginAt: new Date(), failedLogins: 0, lockedUntil: null }).where(eq(schema.admins.id, admin.id));
  return { ok: true, admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role }, twoStep };
}

/* Between the password and the code: a short-lived cookie that only the code page accepts. */
const PENDING = 'ns_admin_2fa';
const cookieSecure = () => (process.env.NEXT_PUBLIC_SITE_URL || '').startsWith('https://');

export async function startTwoStep(admin: { id: number }) {
  const [row] = await db.select({ passwordHash: schema.admins.passwordHash }).from(schema.admins).where(eq(schema.admins.id, admin.id)).limit(1);
  const token = await new SignJWT({ pv: row ? passwordVersion(row.passwordHash) : '', p: '2fa' })
    .setProtectedHeader({ alg: 'HS256' }).setSubject(String(admin.id)).setIssuedAt().setExpirationTime('10m').sign(secret());
  (await cookies()).set(PENDING, token, { httpOnly: true, secure: cookieSecure(), sameSite: 'lax', path: '/admin', maxAge: 600 });
}

/** The admin who has typed the right password and now needs to enter a code. */
export async function pendingTwoStep() {
  const token = (await cookies()).get(PENDING)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.p !== '2fa') return null;
    const [a] = await db.select().from(schema.admins).where(eq(schema.admins.id, Number(payload.sub))).limit(1);
    if (!a || !a.isActive || !a.totpEnabledAt || !a.totpSecret || payload.pv !== passwordVersion(a.passwordHash)) return null;
    return a;
  } catch {
    return null;
  }
}

export async function endTwoStep() {
  (await cookies()).delete({ name: PENDING, path: '/admin' });
}

export async function startSession(admin: { id: number }) {
  const [row] = await db.select({ passwordHash: schema.admins.passwordHash }).from(schema.admins).where(eq(schema.admins.id, admin.id)).limit(1);
  const token = await new SignJWT({ pv: row ? passwordVersion(row.passwordHash) : '' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(admin.id))
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    // Secure cookie whenever the site runs on https (it should, once cPanel AutoSSL is on).
    secure: cookieSecure(),
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

/**
 * The signed-in admin, loaded fresh from the database once per request, so role changes and
 * deactivated accounts take effect immediately.
 */
export const getSession = cache(async (): Promise<AdminSession | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  let id: number;
  let pv: unknown;
  try {
    const { payload } = await jwtVerify(token, secret());
    id = Number(payload.sub);
    pv = payload.pv;
  } catch {
    return null;
  }
  const [a] = await db.select().from(schema.admins).where(eq(schema.admins.id, id)).limit(1);
  if (!a || !a.isActive || pv !== passwordVersion(a.passwordHash)) return null;
  return { id: a.id, email: a.email, name: a.name, role: a.role };
});

/** Use at the top of every admin page and server action. */
export async function requireAdmin(): Promise<AdminSession> {
  const s = await getSession();
  if (!s) redirect('/admin/login');
  return s;
}

/** Signed in and allowed to use this part of the panel; otherwise back to the dashboard with a notice. */
export async function requirePermission(permission: Permission): Promise<AdminSession> {
  const s = await requireAdmin();
  if (!can(s.role, permission)) redirect('/admin?flash=denied');
  return s;
}

export const hashPassword = (pw: string) => bcrypt.hash(pw, 12);
export const checkPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

/** Number of admin accounts (0 means the store still needs its first-run setup). */
export async function adminCount() {
  const rows = await db.select({ id: schema.admins.id }).from(schema.admins).limit(1);
  return rows.length;
}
