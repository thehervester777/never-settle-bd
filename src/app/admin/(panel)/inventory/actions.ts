'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { adjustStock, ADJUST_MODES, type AdjustMode } from '@/lib/inventory';
import { toPoisha } from '@/lib/money';

export async function adjustStockAction(input: { variantId: number; mode: AdjustMode; quantity: number; unitCostTaka?: string; note?: string }) {
  const admin = await requirePermission('inventory');
  if (!(input.mode in ADJUST_MODES)) return { ok: false, message: 'Choose what happened.' };
  // Only people who may see costs can change them through a restock.
  const unitCost = can(admin.role, 'costs') && input.unitCostTaka ? toPoisha(input.unitCostTaka) : null;
  if (unitCost !== null && (!Number.isFinite(unitCost) || unitCost < 0)) return { ok: false, message: 'Enter a valid purchase price.' };
  const res = await adjustStock({ variantId: Number(input.variantId), mode: input.mode, quantity: Number(input.quantity), unitCost, note: input.note?.trim() }, admin);
  revalidatePath('/admin', 'layout');
  return res.ok ? { ok: true, message: `Stock is now ${res.stock}` } : { ok: false, message: res.error };
}
