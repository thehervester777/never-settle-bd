'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { addExpense, deleteExpense } from '@/app/admin/(panel)/finance/expenses/actions';
import { AdminIcon } from './AdminIcon';
import { toast } from './toast';

export function ExpenseForm({ categories, today }: { categories: readonly string[]; today: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const [form, setForm] = useState({ spentOn: today, category: categories[0], description: '', amount: '' });
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await addExpense(form);
          toast(res.message, res.ok ? 'ok' : 'warn');
          if (res.ok) { setForm((f) => ({ ...f, description: '', amount: '' })); router.refresh(); }
        });
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <div><label className="alabel" htmlFor="spentOn">Date</label><input id="spentOn" type="date" required value={form.spentOn} max={today} onChange={(e) => setForm({ ...form, spentOn: e.target.value })} className="ainput" /></div>
        <div><label className="alabel" htmlFor="amount">Amount (৳)</label><input id="amount" type="number" min="1" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="ainput font-semibold" placeholder="0" /></div>
      </div>
      <div>
        <label className="alabel" htmlFor="category">Category</label>
        <select id="category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="aselect">
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      <div><label className="alabel" htmlFor="description">Description</label><input id="description" value={form.description} maxLength={255} onChange={(e) => setForm({ ...form, description: e.target.value })} className="ainput" placeholder="e.g. October Facebook ads" /></div>
      <button className="abtn abtn-primary w-full py-2.5" disabled={pending}><AdminIcon name="plus" className="h-4 w-4" /> {pending ? 'Adding…' : 'Add expense'}</button>
    </form>
  );
}

export function DeleteExpense({ id }: { id: number }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button" disabled={pending} aria-label="Delete expense"
      onClick={() => confirm('Delete this expense?') && start(async () => { const r = await deleteExpense(id); toast(r.message, r.ok ? 'ok' : 'warn'); router.refresh(); })}
      className="rounded-lg p-1.5 text-ink/35 transition hover:bg-red-50 hover:text-red-600"
    >
      <AdminIcon name="trash" className="h-4 w-4" />
    </button>
  );
}
