'use server';

import { revalidatePath } from 'next/cache';
import { and, asc, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/db';
import { requirePermission } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { refreshStore } from '@/lib/store-cache';

type Result = { ok: boolean; message: string; field?: string };

/** Collection pages the store already uses for something else. */
const RESERVED = new Set(['all', 'new-in', 'sale', 'f']);
const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 140);

/** Uploaded here (/uploads/…), shipped with the store (/images/…), or a full https link. */
const imageUrl = z.string().trim().max(500).refine((v) => !v || /^\/(uploads|images)\/[\w./-]+$/.test(v) || /^https:\/\/\S+$/.test(v), 'Upload a picture or paste a full link starting with https://');

const categorySchema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().trim().min(1, 'Give the category a name').max(120, 'Keep the name under 120 characters'),
  slug: z.string().trim().max(140).default(''),
  description: z.string().transform((v) => v.replace(/\r/g, '').trim()).pipe(z.string().max(500, 'Keep the description under 500 characters')).default(''),
  image: imageUrl.default(''),
  // Products picked in the editor: ones to bring into this category, and ones moving out of it to another.
  products: z.object({
    add: z.array(z.number().int().positive()).max(10000).default([]),
    moveOut: z.array(z.object({ id: z.number().int().positive(), to: z.number().int().positive() })).max(10000).default([]),
  }).optional(),
});
export type CategoryInput = z.input<typeof categorySchema>;

const refresh = () => { refreshStore(); revalidatePath('/admin/categories'); };

export async function saveCategory(input: CategoryInput): Promise<Result> {
  const admin = await requirePermission('products');
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message, field: String(parsed.error.issues[0].path[0] ?? '') };
  const { id, name, description, image, products } = parsed.data;
  // A name in Bangla only has no Latin letters for the address, so it gets a generated one (it can be changed later).
  const slug = slugify(parsed.data.slug || name) || (parsed.data.slug ? '' : `category-${Date.now().toString(36)}`);
  if (!slug) return { ok: false, message: 'Use letters or numbers in the web address', field: 'slug' };
  if (RESERVED.has(slug)) return { ok: false, message: `“${slug}” is already used by the store. Choose another web address.`, field: 'slug' };
  const [taken] = await db.select({ id: schema.categories.id }).from(schema.categories)
    .where(id ? and(eq(schema.categories.slug, slug), ne(schema.categories.id, id)) : eq(schema.categories.slug, slug)).limit(1);
  if (taken) return { ok: false, message: 'Another category already uses this web address', field: 'slug' };

  const values = { name, slug, description: description || null, image: image || null };
  let categoryId = id;
  if (id) {
    const [before] = await db.select().from(schema.categories).where(eq(schema.categories.id, id)).limit(1);
    if (!before) return { ok: false, message: 'This category was deleted. Reload the page.' };
    await db.update(schema.categories).set(values).where(eq(schema.categories.id, id));
    const what = [before.name !== name && 'name', before.slug !== slug && 'web address', (before.description ?? '') !== description && 'description', (before.image ?? '') !== image && 'picture'].filter(Boolean);
    await logActivity(admin, 'category.update', 'category', id, `Updated category “${name}”${what.length ? ` (${what.join(', ')})` : ''}`);
  } else {
    const [{ next }] = await db.select({ next: sql<number>`COALESCE(MAX(${schema.categories.sortOrder}), 0) + 1` }).from(schema.categories);
    const [r] = await db.insert(schema.categories).values({ ...values, sortOrder: Number(next) });
    categoryId = Number(r.insertId);
    await logActivity(admin, 'category.create', 'category', categoryId, `Added category “${name}”`);
  }
  const moved = products && (products.add.length || products.moveOut.length) ? await placeProducts(categoryId!, name, products, admin) : null;
  refresh();
  if (moved && !moved.ok) return moved;
  const base = id ? 'Category saved. It’s live in the store.' : 'Category added to the store.';
  return { ok: true, message: moved?.message ? `${base} ${moved.message}` : base };
}

/** Puts the picked products into the category, and moves the unpicked ones to the category chosen for them. */
async function placeProducts(categoryId: number, name: string, p: { add: number[]; moveOut: { id: number; to: number }[] }, admin: Awaited<ReturnType<typeof requirePermission>>): Promise<Result> {
  const add = [...new Set(p.add)];
  const moveOut = p.moveOut.filter((m) => m.to !== categoryId && !add.includes(m.id));
  const targets = [...new Set(moveOut.map((m) => m.to))];
  if (targets.length) {
    const found = await db.select({ id: schema.categories.id }).from(schema.categories).where(inArray(schema.categories.id, targets));
    if (found.length !== targets.length) return { ok: false, message: 'A category you chose to move products to was deleted. Reload the page.' };
  }
  await db.transaction(async (tx) => {
    if (add.length) await tx.update(schema.products).set({ categoryId }).where(inArray(schema.products.id, add));
    // Only products still in this category move out (someone may have moved them meanwhile)
    for (const m of moveOut) await tx.update(schema.products).set({ categoryId: m.to }).where(and(eq(schema.products.id, m.id), eq(schema.products.categoryId, categoryId)));
  });
  const parts = [add.length && `${add.length} added`, moveOut.length && `${moveOut.length} moved out`].filter(Boolean).join(', ');
  await logActivity(admin, 'category.products', 'category', categoryId, `Products in “${name}”: ${parts}`);
  return { ok: true, message: `Products: ${parts}.` };
}

/** Moves a category one place up (-1) or down (1). The order is used on the homepage tiles and menus. */
export async function moveCategory(id: number, dir: -1 | 1): Promise<Result> {
  const admin = await requirePermission('products');
  const rows = await db.select({ id: schema.categories.id, name: schema.categories.name }).from(schema.categories).orderBy(asc(schema.categories.sortOrder), asc(schema.categories.name));
  const i = rows.findIndex((r) => r.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= rows.length) return { ok: true, message: 'Already in place' };
  [rows[i], rows[j]] = [rows[j], rows[i]];
  await db.transaction(async (tx) => {
    for (const [n, r] of rows.entries()) await tx.update(schema.categories).set({ sortOrder: n + 1 }).where(eq(schema.categories.id, r.id));
  });
  await logActivity(admin, 'category.move', 'category', id, `Moved category “${rows[j].name}” to position ${j + 1}`);
  refresh();
  return { ok: true, message: `Moved to position ${j + 1}` };
}

export async function deleteCategory(id: number): Promise<Result> {
  const admin = await requirePermission('products');
  const [c] = await db.select().from(schema.categories).where(eq(schema.categories.id, id)).limit(1);
  if (!c) return { ok: false, message: 'Already deleted.' };
  const [{ n }] = await db.select({ n: sql<number>`COUNT(*)` }).from(schema.products).where(eq(schema.products.categoryId, id));
  if (Number(n) > 0) return { ok: false, message: `“${c.name}” still has ${n} product${Number(n) === 1 ? '' : 's'}. Move them to another category first.` };
  await db.delete(schema.categories).where(eq(schema.categories.id, id));
  await logActivity(admin, 'category.delete', 'category', id, `Deleted category “${c.name}”`);
  refresh();
  return { ok: true, message: 'Category deleted' };
}

/** From the product form: adds a category by name only (picture and description can be added later). */
export async function quickAddCategory(name: string): Promise<Result & { category?: { id: number; name: string } }> {
  const r = await saveCategory({ name: String(name ?? '') });
  if (!r.ok) return r;
  // The newest category with this name is the one just added
  const [c] = await db.select({ id: schema.categories.id, name: schema.categories.name }).from(schema.categories)
    .where(eq(schema.categories.name, String(name).trim())).orderBy(desc(schema.categories.id)).limit(1);
  revalidatePath('/admin/products', 'layout');
  return { ok: true, message: `Category “${c?.name ?? name}” added`, category: c };
}
