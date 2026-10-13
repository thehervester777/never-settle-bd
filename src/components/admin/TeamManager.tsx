'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useState, useTransition } from 'react';
import type { AdminRole } from '@/db/schema';
import { createMember, resetPassword, updateMember } from '@/app/admin/(panel)/team/actions';
import { AdminIcon } from './AdminIcon';
import { Modal } from './Modal';
import { StatusBadge } from './StatusBadge';
import { toast } from './toast';

export type Member = { id: number; name: string; email: string; role: AdminRole; isActive: boolean; lastLogin: string; joined: string; isMe: boolean };
type RoleInfo = Record<AdminRole, { label: string; summary: string }>;

const ROLE_STYLE: Record<AdminRole, string> = {
  OWNER: 'bg-ink text-accent', MANAGER: 'bg-sky-50 text-sky-800', ACCOUNTANT: 'bg-violet-50 text-violet-800', STAFF: 'bg-neutral-100 text-neutral-700',
};

/** A strong random password the owner can hand over (letters and digits only, easy to read out). */
function generatePassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint32Array(14));
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

function useRun() {
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (fn: () => Promise<{ ok: boolean; message: string }>, after?: () => void) => start(async () => {
    const r = await fn();
    toast(r.message, r.ok ? 'ok' : 'warn');
    if (r.ok) { after?.(); router.refresh(); }
  });
  return [pending, run] as const;
}

function PasswordField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="alabel" htmlFor="pw">Temporary password</label>
      <div className="flex gap-2">
        <input id="pw" value={value} onChange={(e) => onChange(e.target.value)} minLength={10} required className="ainput font-mono" autoComplete="new-password" />
        <button type="button" onClick={() => onChange(generatePassword())} className="abtn abtn-outline shrink-0"><AdminIcon name="refresh" className="h-4 w-4" /> Generate</button>
      </div>
      <p className="ahint">Share it with them privately; they can change it under My account.</p>
    </div>
  );
}

export function TeamManager({ members, roles }: { members: Member[]; roles: RoleInfo }) {
  const [adding, setAdding] = useState(false);
  const [resetFor, setResetFor] = useState<Member | null>(null);
  const [form, setForm] = useState({ name: '', email: '', role: 'STAFF' as AdminRole, password: '' });
  const [pw, setPw] = useState('');
  const [pending, run] = useRun();

  return (
    <>
      <div className="mb-4 flex justify-end">
        <button type="button" onClick={() => { setForm({ name: '', email: '', role: 'STAFF', password: generatePassword() }); setAdding(true); }} className="abtn abtn-primary"><AdminIcon name="plus" className="h-4 w-4" /> Add team member</button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {members.map((m, i) => (
          <motion.article key={m.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className={`admin-card flex flex-col ${m.isActive ? '' : 'opacity-60'}`}>
            <div className="flex items-start gap-3">
              <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-bold ${ROLE_STYLE[m.role]}`}>{m.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{m.name} {m.isMe && <span className="text-xs font-normal text-ink/45">(you)</span>}</p>
                <p className="truncate text-sm text-ink/50">{m.email}</p>
              </div>
              <StatusBadge status={m.isActive ? 'ACTIVE' : 'DISABLED'} label={m.isActive ? 'Active' : 'Off'} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-ink/50">
              <span>Last sign-in<br /><span className="text-sm text-ink">{m.lastLogin}</span></span>
              <span>Joined<br /><span className="text-sm text-ink">{m.joined}</span></span>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-black/[0.05] pt-4">
              {m.isMe ? (
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ROLE_STYLE[m.role]}`}>{roles[m.role].label}</span>
              ) : (
                <>
                  <select aria-label={`Role for ${m.name}`} value={m.role} disabled={pending} onChange={(e) => run(() => updateMember(m.id, { role: e.target.value as AdminRole }))} className="aselect w-auto py-1.5 text-xs">
                    {(Object.keys(roles) as AdminRole[]).map((r) => <option key={r} value={r}>{roles[r].label}</option>)}
                  </select>
                  <button type="button" disabled={pending} onClick={() => { setPw(generatePassword()); setResetFor(m); }} className="abtn abtn-sm abtn-ghost"><AdminIcon name="lock" className="h-3.5 w-3.5" /> Reset password</button>
                  <button type="button" disabled={pending}
                    onClick={() => (m.isActive ? confirm(`Turn off ${m.name}’s account? They’ll be signed out immediately.`) : true) && run(() => updateMember(m.id, { isActive: !m.isActive }))}
                    className={`abtn abtn-sm ml-auto ${m.isActive ? 'abtn-ghost text-red-600 hover:bg-red-50' : 'abtn-outline'}`}>
                    {m.isActive ? 'Turn off' : 'Turn on'}
                  </button>
                </>
              )}
            </div>
          </motion.article>
        ))}
      </div>

      <Modal open={adding} onClose={() => setAdding(false)} title="Add a team member" description="They sign in at /admin with their email and this password.">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); run(() => createMember(form), () => setAdding(false)); }}>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="alabel" htmlFor="m-name">Name</label><input id="m-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="ainput" /></div>
            <div><label className="alabel" htmlFor="m-email">Email</label><input id="m-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="ainput" /></div>
          </div>
          <fieldset>
            <legend className="alabel">Role</legend>
            <div className="space-y-2">
              {(Object.keys(roles) as AdminRole[]).map((r) => (
                <label key={r} className={`flex cursor-pointer gap-3 rounded-2xl border p-3 transition ${form.role === r ? 'border-ink bg-[#fafaf6]' : 'border-black/10 hover:border-black/25'}`}>
                  <input type="radio" name="role" className="mt-1 h-4 w-4 text-ink focus:ring-accent" checked={form.role === r} onChange={() => setForm({ ...form, role: r })} />
                  <span><span className="block text-sm font-semibold">{roles[r].label}</span><span className="text-xs text-ink/55">{roles[r].summary}</span></span>
                </label>
              ))}
            </div>
          </fieldset>
          <PasswordField value={form.password} onChange={(password) => setForm({ ...form, password })} />
          <button className="abtn abtn-primary w-full py-3" disabled={pending}>{pending ? 'Adding…' : 'Add member'}</button>
        </form>
      </Modal>

      <Modal open={!!resetFor} onClose={() => setResetFor(null)} title={`Reset ${resetFor?.name ?? ''}’s password`} description="They’ll be signed out everywhere and need the new password to sign in.">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (resetFor) run(() => resetPassword(resetFor.id, pw), () => setResetFor(null)); }}>
          <PasswordField value={pw} onChange={setPw} />
          <button className="abtn abtn-primary w-full py-3" disabled={pending}>Set new password</button>
        </form>
      </Modal>
    </>
  );
}
