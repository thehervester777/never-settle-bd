'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/db';
import { EXPENSE_CATEGORIES } from '@/db/schema';
import { requirePermission } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { formatBDT, toPoisha } from '@/lib/money';
import { isDay } from '@/lib/dates';

const expenseSchema = z.object({
  spentOn: z.string().refine(isDay, 'Choose a date'),
  category: z.enum(EXPENSE_CATEGORIES),
  description: z.string().trim().max(255).default(''),
  amount: z.coerce.number().positive('Enter an amount').max(100_000_000),
});

export async function addExpense(input: unknown) {
  const admin = await requirePermission('finance');
  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const e = parsed.data;
  const amount = toPoisha(e.amount);
  const [r] = await db.insert(schema.expenses).values({ spentOn: e.spentOn, category: e.category, description: e.description, amount, adminId: admin.id });
  await logActivity(admin, 'expense.create', 'expense', Number(r.insertId), `Added expense ${formatBDT(amount)} · ${e.category}${e.description ? ` (${e.description})` : ''}`);
  revalidatePath('/admin/finance', 'layout');
  return { ok: true, message: `Expense of ${formatBDT(amount)} added` };
}

export async function deleteExpense(id: number) {
  const admin = await requirePermission('finance');
  const [e] = await db.select().from(schema.expenses).where(eq(schema.expenses.id, id)).limit(1);
  if (!e) return { ok: false, message: 'Already deleted.' };
  await db.delete(schema.expenses).where(eq(schema.expenses.id, id));
  await logActivity(admin, 'expense.delete', 'expense', id, `Deleted expense ${formatBDT(e.amount)} · ${e.category} (${e.spentOn})`);
  revalidatePath('/admin/finance', 'layout');
  return { ok: true, message: 'Expense deleted' };
}
