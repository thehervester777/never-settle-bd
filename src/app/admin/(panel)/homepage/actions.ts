'use server';

import { revalidatePath } from 'next/cache';
import { asc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/db';
import { SLIDE_MEDIA } from '@/db/schema';
import { requirePermission } from '@/lib/auth';
import { logActivity } from '@/lib/activity';

type Result = { ok: boolean; message: string; field?: string };

/** Uploaded here (/uploads/…), shipped with the store (/images/…), or a full https link. */
const mediaUrl = z.string().trim().max(500).refine((v) => /^\/(uploads|images)\/[\w./-]+$/.test(v) || /^https?:\/\/\S+$/.test(v), 'Upload a file or paste a full link starting with https://');
const optionalMedia = z.union([mediaUrl, z.literal('')]).optional().transform((v) => v || null);
const link = z.string().trim().max(300).refine((v) => !v || v.startsWith('/') || /^https?:\/\/\S+$/.test(v), 'Links start with / (a page in your store) or https://');

const slideSchema = z.object({
  id: z.number().int().positive().optional(),
  mediaType: z.enum(SLIDE_MEDIA),
  mediaUrl,
  mobileMediaUrl: optionalMedia,
  posterUrl: optionalMedia,
  eyebrow: z.string().trim().max(80).default(''),
  heading: z.string().transform((v) => v.replace(/\r/g, '').trim()).pipe(z.string().max(120, 'Keep the heading under 120 characters')).default(''),
  text: z.string().trim().max(300, 'Keep the text under 300 characters').default(''),
  ctaLabel: z.string().trim().max(60).default(''),
  ctaHref: link.default(''),
  cta2Label: z.string().trim().max(60).default(''),
  cta2Href: link.default(''),
  isActive: z.boolean().default(true),
}).superRefine((s, ctx) => {
  for (const [label, href, n] of [[s.ctaLabel, s.ctaHref, ''], [s.cta2Label, s.cta2Href, '2']] as const) {
    if (label && !href) ctx.addIssue({ code: 'custom', path: [`cta${n}Href`], message: 'Add the link for this button' });
    if (href && !label) ctx.addIssue({ code: 'custom', path: [`cta${n}Label`], message: 'Add the button text' });
  }
});
export type SlideInput = z.input<typeof slideSchema>;

const refresh = () => { revalidatePath('/'); revalidatePath('/admin/homepage'); };
const name = (s: { heading: string; eyebrow: string }, id?: number) => (s.heading.replace(/\n/g, ' ') || s.eyebrow || `slide ${id ?? ''}`.trim()).slice(0, 80);

export async function saveSlide(input: SlideInput): Promise<Result> {
  const admin = await requirePermission('settings');
  const parsed = slideSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message, field: String(parsed.error.issues[0].path[0] ?? '') };
  const { id, ...values } = parsed.data;
  if (id) {
    await db.update(schema.homeSlides).set(values).where(eq(schema.homeSlides.id, id));
    await logActivity(admin, 'slide.update', 'slide', id, `Updated homepage slide “${name(values, id)}”`);
  } else {
    const [{ next }] = await db.select({ next: sql<number>`COALESCE(MAX(${schema.homeSlides.sortOrder}), 0) + 1` }).from(schema.homeSlides);
    const [r] = await db.insert(schema.homeSlides).values({ ...values, sortOrder: Number(next) });
    await logActivity(admin, 'slide.create', 'slide', Number(r.insertId), `Added homepage slide “${name(values)}” (${values.mediaType === 'VIDEO' ? 'video' : 'picture'})`);
  }
  refresh();
  return { ok: true, message: id ? 'Slide updated. It’s live on the homepage.' : 'Slide added to the homepage.' };
}

export async function setSlideActive(id: number, active: boolean): Promise<Result> {
  const admin = await requirePermission('settings');
  const [s] = await db.select().from(schema.homeSlides).where(eq(schema.homeSlides.id, id)).limit(1);
  if (!s) return { ok: false, message: 'Slide not found.' };
  await db.update(schema.homeSlides).set({ isActive: active }).where(eq(schema.homeSlides.id, id));
  await logActivity(admin, active ? 'slide.show' : 'slide.hide', 'slide', id, `${active ? 'Showed' : 'Hid'} homepage slide “${name(s, id)}”`);
  refresh();
  return { ok: true, message: active ? 'Slide is showing on the homepage' : 'Slide hidden from the homepage' };
}

/** Moves a slide one place up (-1) or down (1). */
export async function moveSlide(id: number, dir: -1 | 1): Promise<Result> {
  const admin = await requirePermission('settings');
  const rows = await db.select({ id: schema.homeSlides.id }).from(schema.homeSlides).orderBy(asc(schema.homeSlides.sortOrder), asc(schema.homeSlides.id));
  const i = rows.findIndex((r) => r.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= rows.length) return { ok: true, message: 'Already in place' };
  [rows[i], rows[j]] = [rows[j], rows[i]];
  await db.transaction(async (tx) => {
    for (const [n, r] of rows.entries()) await tx.update(schema.homeSlides).set({ sortOrder: n + 1 }).where(eq(schema.homeSlides.id, r.id));
  });
  await logActivity(admin, 'slide.move', 'slide', id, `Moved homepage slide ${dir < 0 ? 'up' : 'down'} to position ${j + 1}`);
  refresh();
  return { ok: true, message: `Moved to position ${j + 1}` };
}

export async function deleteSlide(id: number): Promise<Result> {
  const admin = await requirePermission('settings');
  const [s] = await db.select().from(schema.homeSlides).where(eq(schema.homeSlides.id, id)).limit(1);
  if (!s) return { ok: false, message: 'Already deleted.' };
  await db.delete(schema.homeSlides).where(eq(schema.homeSlides.id, id));
  await logActivity(admin, 'slide.delete', 'slide', id, `Deleted homepage slide “${name(s, id)}”`);
  refresh();
  return { ok: true, message: 'Slide deleted' };
}
