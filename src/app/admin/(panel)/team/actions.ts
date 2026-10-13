'use server';

import { revalidatePath } from 'next/cache';
import { and, count, eq, ne } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/db';
import { ADMIN_ROLES, type AdminRole } from '@/db/schema';
import { hashPassword, requirePermission } from '@/lib/auth';
import { ROLE_INFO } from '@/lib/permissions';
import { logActivity } from '@/lib/activity';

type Result = { ok: boolean; message: string };

const memberSchema = z.object({
  name: z.string().trim().min(2, 'Enter their name').max(120),
  email: z.string().trim().toLowerCase().email('Enter a valid email').max(160),
  role: z.enum(ADMIN_ROLES),
  password: z.string().min(10, 'Use a password of at least 10 characters').max(200),
});

/** At least one active owner must remain, so nobody can lock the store out of its own panel. */
async function otherActiveOwners(exceptId: number) {
  const [r] = await db.select({ n: count() }).from(schema.admins).where(and(eq(schema.admins.role, 'OWNER'), eq(schema.admins.isActive, true), ne(schema.admins.id, exceptId)));
  return Number(r.n);
}

export async function createMember(input: unknown): Promise<Result> {
  const admin = await requirePermission('users');
  const parsed = memberSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const m = parsed.data;
  const [exists] = await db.select({ id: schema.admins.id }).from(schema.admins).where(eq(schema.admins.email, m.email)).limit(1);
  if (exists) return { ok: false, message: 'Someone with that email already has an account.' };
  const [r] = await db.insert(schema.admins).values({ name: m.name, email: m.email, role: m.role, passwordHash: await hashPassword(m.password) });
  await logActivity(admin, 'team.create', 'admin', Number(r.insertId), `Added ${m.name} as ${ROLE_INFO[m.role].label}`);
  revalidatePath('/admin/team');
  return { ok: true, message: `${m.name} can now sign in` };
}

export async function updateMember(id: number, change: { role?: AdminRole; isActive?: boolean }): Promise<Result> {
  const admin = await requirePermission('users');
  if (id === admin.id) return { ok: false, message: 'You can’t change your own role or turn off your own account.' };
  const [m] = await db.select().from(schema.admins).where(eq(schema.admins.id, id)).limit(1);
  if (!m) return { ok: false, message: 'Account not found.' };
  const role = change.role && ADMIN_ROLES.includes(change.role) ? change.role : m.role;
  const isActive = change.isActive ?? m.isActive;
  const losesOwner = m.role === 'OWNER' && m.isActive && (role !== 'OWNER' || !isActive);
  if (losesOwner && (await otherActiveOwners(id)) === 0) return { ok: false, message: 'The store needs at least one active owner.' };
  await db.update(schema.admins).set({ role, isActive }).where(eq(schema.admins.id, id));
  const what = change.isActive !== undefined && change.isActive !== m.isActive
    ? `${isActive ? 'Turned on' : 'Turned off'} ${m.name}’s account`
    : `Changed ${m.name}’s role: ${ROLE_INFO[m.role].label} → ${ROLE_INFO[role].label}`;
  await logActivity(admin, 'team.update', 'admin', id, what);
  revalidatePath('/admin/team');
  return { ok: true, message: what };
}

export async function resetPassword(id: number, password: string): Promise<Result> {
  const admin = await requirePermission('users');
  if (typeof password !== 'string' || password.length < 10 || password.length > 200) return { ok: false, message: 'Use a password of at least 10 characters.' };
  const [m] = await db.select().from(schema.admins).where(eq(schema.admins.id, id)).limit(1);
  if (!m) return { ok: false, message: 'Account not found.' };
  // A new hash signs them out everywhere (sessions carry a fingerprint of the old one).
  await db.update(schema.admins).set({ passwordHash: await hashPassword(password) }).where(eq(schema.admins.id, id));
  await logActivity(admin, 'team.password', 'admin', id, `Reset ${m.name}’s password`);
  return { ok: true, message: `Password reset. ${m.name} has been signed out everywhere.` };
}
