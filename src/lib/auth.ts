import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';

const COOKIE = 'ns_admin';
const MAX_AGE = 60 * 60 * 12; // 12 hours

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error('AUTH_SECRET must be set to a random string of at least 32 characters.');
  return new TextEncoder().encode(s);
}

export type AdminSession = { id: number; email: string; name: string };

export async function verifyLogin(email: string, password: string): Promise<AdminSession | null> {
  const [admin] = await db.select().from(schema.admins).where(eq(schema.admins.email, email.toLowerCase().trim())).limit(1);
  // Compare against a dummy hash when the email is unknown so response time doesn't reveal which emails exist.
  const ok = await bcrypt.compare(password, admin?.passwordHash ?? '$2b$12$C6UzMDM.H6dfI/f/IKcEeO5nZtFhA4l5X7Qf6c5pX9e4Yb2mJ8x0K');
  return admin && ok ? { id: admin.id, email: admin.email, name: admin.name } : null;
}

export async function startSession(admin: AdminSession) {
  const token = await new SignJWT({ email: admin.email, name: admin.name })
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

export async function getSession(): Promise<AdminSession | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return { id: Number(payload.sub), email: String(payload.email), name: String(payload.name) };
  } catch {
    return null;
  }
}

/** Use at the top of every admin page and server action. */
export async function requireAdmin(): Promise<AdminSession> {
  const s = await getSession();
  if (!s) redirect('/admin/login');
  return s;
}

export const hashPassword = (pw: string) => bcrypt.hash(pw, 12);

/** Number of admin accounts (0 means the store still needs its first-run setup). */
export async function adminCount() {
  const rows = await db.select({ id: schema.admins.id }).from(schema.admins).limit(1);
  return rows.length;
}
