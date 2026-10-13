import 'server-only';
import crypto from 'crypto';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import type { AdminRole } from '@/db/schema';
import { can, type Permission } from '@/lib/permissions';

const COOKIE = 'ns_admin';
const MAX_AGE = 60 * 60 * 12; // 12 hours

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error('AUTH_SECRET must be set to a random string of at least 32 characters.');
  return new TextEncoder().encode(s);
}

export type AdminSession = { id: number; email: string; name: string; role: AdminRole };

// Changes whenever the password does, so a password change signs out every other browser.
const passwordVersion = (hash: string) => crypto.createHash('sha256').update(hash).digest('hex').slice(0, 16);

type LoginResult = { ok: true; admin: AdminSession } | { ok: false; reason: 'invalid' | 'disabled' };

export async function verifyLogin(email: string, password: string): Promise<LoginResult> {
  const [admin] = await db.select().from(schema.admins).where(eq(schema.admins.email, email.toLowerCase().trim())).limit(1);
  // Compare against a dummy hash when the email is unknown so response time doesn't reveal which emails exist.
  const ok = await bcrypt.compare(password, admin?.passwordHash ?? '$2b$12$C6UzMDM.H6dfI/f/IKcEeO5nZtFhA4l5X7Qf6c5pX9e4Yb2mJ8x0K');
  if (!admin || !ok) return { ok: false, reason: 'invalid' };
  if (!admin.isActive) return { ok: false, reason: 'disabled' };
  await db.update(schema.admins).set({ lastLoginAt: new Date() }).where(eq(schema.admins.id, admin.id));
  return { ok: true, admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role } };
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
    secure: (process.env.NEXT_PUBLIC_SITE_URL || '').startsWith('https://'),
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
