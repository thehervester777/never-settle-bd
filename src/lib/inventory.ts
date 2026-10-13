import 'server-only';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import type { StockReason } from '@/db/schema';
import type { AdminSession } from '@/lib/auth';
import { logActivity } from '@/lib/activity';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type Executor = typeof db | Tx;

export type Movement = {
  variantId: number; productId: number; change: number; balanceAfter: number; reason: StockReason;
  unitCost?: number | null; orderId?: number | null; note?: string | null; adminId?: number | null;
};

export async function recordMovement(ex: Executor, m: Movement) {
  if (m.change === 0 && m.reason !== 'COUNT') return;
  await ex.insert(schema.stockMovements).values({
    variantId: m.variantId, productId: m.productId, change: m.change, balanceAfter: m.balanceAfter, reason: m.reason,
    unitCost: m.unitCost ?? null, orderId: m.orderId ?? null, note: m.note?.slice(0, 255) || null, adminId: m.adminId ?? null,
  });
}

export const ADJUST_MODES = {
  RESTOCK: 'Restock (add units)',
  DAMAGE: 'Damaged / lost (remove units)',
  COUNT: 'Stock count (set the exact number)',
} as const;
export type AdjustMode = keyof typeof ADJUST_MODES;

/**
 * Changes one variant's stock and records why. A restock with a purchase price updates the variant's
 * cost to the weighted average of old and new units, so profit stays accurate when prices change.
 */
export async function adjustStock(
  input: { variantId: number; mode: AdjustMode; quantity: number; unitCost?: number | null; note?: string },
  admin: AdminSession,
): Promise<{ ok: true; stock: number } | { ok: false; error: string }> {
  const { variantId, mode, quantity } = input;
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 1_000_000) return { ok: false, error: 'Enter a whole number.' };
  if (mode !== 'COUNT' && quantity === 0) return { ok: false, error: 'Enter how many units.' };

  const result = await db.transaction(async (tx) => {
    const [v] = await tx.select().from(schema.variants).where(eq(schema.variants.id, variantId)).for('update');
    if (!v) return { ok: false as const, error: 'That item no longer exists.' };
    let change = 0;
    let cost = v.cost;
    if (mode === 'RESTOCK') {
      change = quantity;
      if (input.unitCost && input.unitCost > 0) {
        const onHand = Math.max(v.stock, 0);
        cost = Math.round((onHand * v.cost + quantity * input.unitCost) / (onHand + quantity));
      }
    } else if (mode === 'DAMAGE') {
      if (quantity > v.stock) return { ok: false as const, error: `Only ${v.stock} in stock.` };
      change = -quantity;
    } else {
      change = quantity - v.stock;
    }
    const balance = v.stock + change;
    await tx.update(schema.variants).set({ stock: balance, cost }).where(eq(schema.variants.id, v.id));
    await recordMovement(tx, {
      variantId: v.id, productId: v.productId, change, balanceAfter: balance, reason: mode,
      unitCost: mode === 'RESTOCK' ? input.unitCost ?? null : null, note: input.note, adminId: admin.id,
    });
    const [p] = await tx.select({ title: schema.products.title }).from(schema.products).where(eq(schema.products.id, v.productId)).limit(1);
    return { ok: true as const, stock: balance, label: [p?.title, [v.color, v.size].filter(Boolean).join(' / ')].filter(Boolean).join(' · '), change };
  });

  if (result.ok) {
    const verb = mode === 'RESTOCK' ? `Restocked +${result.change}` : mode === 'DAMAGE' ? `Removed ${-result.change} (damaged/lost)` : `Counted stock: ${result.stock} (${result.change >= 0 ? '+' : ''}${result.change})`;
    await logActivity(admin, 'stock.adjust', 'variant', variantId, `${verb} · ${result.label}`);
    return { ok: true, stock: result.stock };
  }
  return result;
}
