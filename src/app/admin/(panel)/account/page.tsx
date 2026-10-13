import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { checkPassword, hashPassword, requireAdmin, startSession } from '@/lib/auth';
import { ROLE_INFO } from '@/lib/permissions';
import { logActivity } from '@/lib/activity';
import { fmtDate } from '@/lib/dates';
import { Card, PageHeader } from '@/components/admin/ui';

export const metadata = { title: 'My account' };

async function saveName(formData: FormData) {
  'use server';
  const admin = await requireAdmin();
  const name = String(formData.get('name') ?? '').trim().slice(0, 120);
  if (name.length < 2) redirect('/admin/account?e=name');
  await db.update(schema.admins).set({ name }).where(eq(schema.admins.id, admin.id));
  redirect('/admin/account?flash=saved');
}

async function changePassword(formData: FormData) {
  'use server';
  const admin = await requireAdmin();
  const current = String(formData.get('current') ?? '');
  const next = String(formData.get('next') ?? '');
  const confirm = String(formData.get('confirm') ?? '');
  const [row] = await db.select().from(schema.admins).where(eq(schema.admins.id, admin.id)).limit(1);
  if (!row || !(await checkPassword(current, row.passwordHash))) redirect('/admin/account?e=current');
  if (next.length < 10) redirect('/admin/account?e=short');
  if (next !== confirm) redirect('/admin/account?e=match');
  await db.update(schema.admins).set({ passwordHash: await hashPassword(next) }).where(eq(schema.admins.id, admin.id));
  await startSession({ id: admin.id }); // keep this browser signed in; every other one is signed out
  await logActivity(admin, 'auth.password', 'admin', admin.id, 'Changed their password');
  redirect('/admin/account?flash=password');
}

const ERRORS: Record<string, string> = {
  name: 'Enter your name.',
  current: 'Your current password is wrong.',
  short: 'Use a new password of at least 10 characters.',
  match: 'The two new passwords don’t match.',
};

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const admin = await requireAdmin();
  const { e } = await searchParams;
  const [row] = await db.select().from(schema.admins).where(eq(schema.admins.id, admin.id)).limit(1);
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="My account" description={`${ROLE_INFO[admin.role].label} · member since ${fmtDate(row.createdAt)}`} />
      {e && ERRORS[e] && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 ring-1 ring-inset ring-red-200" role="alert">{ERRORS[e]}</p>}
      <Card title="Profile">
        <form action={saveName} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div><label className="alabel" htmlFor="name">Name</label><input id="name" name="name" defaultValue={admin.name} required className="ainput" /></div>
          <div><label className="alabel" htmlFor="email">Email</label><input id="email" value={admin.email} disabled className="ainput bg-[#f7f7f4] text-ink/60" /></div>
          <button className="abtn abtn-primary">Save</button>
        </form>
        <p className="ahint mt-3">{ROLE_INFO[admin.role].summary} Only an owner can change your email or role.</p>
      </Card>
      <Card title="Password" description="Changing it signs you out on every other device.">
        <form action={changePassword} className="grid gap-4 sm:grid-cols-3">
          <div><label className="alabel" htmlFor="current">Current password</label><input id="current" name="current" type="password" required autoComplete="current-password" className="ainput" /></div>
          <div><label className="alabel" htmlFor="next">New password</label><input id="next" name="next" type="password" required minLength={10} autoComplete="new-password" className="ainput" /></div>
          <div><label className="alabel" htmlFor="confirm">Confirm new password</label><input id="confirm" name="confirm" type="password" required minLength={10} autoComplete="new-password" className="ainput" /></div>
          <div className="sm:col-span-3"><button className="abtn abtn-primary">Change password</button></div>
        </form>
      </Card>
    </div>
  );
}
