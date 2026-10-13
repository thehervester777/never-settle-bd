'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/db';
import { COUPON_TYPES } from '@/db/schema';
import { requirePermission } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { formatBDT, toPoisha } from '@/lib/money';
import { isDay } from '@/lib/dates';
import { normalizeCode } from '@/lib/attribution';
import { AD_CATEGORY, AD_PLATFORMS } from '@/lib/marketing-reports';
import { couponSummary } from '@/lib/coupons';
import { sendMetaTestEvent } from '@/lib/meta-capi';
import { clientIp } from '@/lib/rate-limit';
import { getSecretSettings, saveSettings, type SecretSettings, type StoreSettings } from '@/lib/settings';

type Result = { ok: boolean; message: string };

/* ---------------------------------------------------------------- Ad spend */

const spendSchema = z.object({
  spentOn: z.string().refine(isDay, 'Choose a date'),
  platform: z.enum(AD_PLATFORMS.map((p) => p.key) as [string, ...string[]]),
  amount: z.coerce.number().positive('Enter the amount spent').max(100_000_000),
  note: z.string().trim().max(200).default(''),
});

/** Ad spend is an expense in "Marketing & ads", so it also shows in the profit & loss. */
export async function addAdSpend(input: unknown): Promise<Result> {
  const admin = await requirePermission('marketing');
  const parsed = spendSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const { spentOn, platform, amount, note } = parsed.data;
  const p = AD_PLATFORMS.find((x) => x.key === platform)!;
  const value = toPoisha(amount);
  const description = `${p.prefix}${note ? ` · ${note}` : ''}`.slice(0, 255);
  const [r] = await db.insert(schema.expenses).values({ spentOn, category: AD_CATEGORY, description, amount: value, adminId: admin.id });
  await logActivity(admin, 'expense.create', 'expense', Number(r.insertId), `Logged ad spend ${formatBDT(value)} · ${description}`);
  revalidatePath('/admin/marketing');
  revalidatePath('/admin/finance', 'layout');
  return { ok: true, message: `${formatBDT(value)} of ${p.label} spend logged` };
}

export async function deleteAdSpend(id: number): Promise<Result> {
  const admin = await requirePermission('marketing');
  const [e] = await db.select().from(schema.expenses).where(and(eq(schema.expenses.id, id), eq(schema.expenses.category, AD_CATEGORY))).limit(1);
  if (!e) return { ok: false, message: 'Already deleted.' };
  await db.delete(schema.expenses).where(eq(schema.expenses.id, id));
  await logActivity(admin, 'expense.delete', 'expense', id, `Deleted ad spend ${formatBDT(e.amount)} · ${e.description} (${e.spentOn})`);
  revalidatePath('/admin/marketing');
  revalidatePath('/admin/finance', 'layout');
  return { ok: true, message: 'Ad spend deleted' };
}

/* ---------------------------------------------------------------- Discount codes */

const dateTime = z.string().trim().optional().transform((v, ctx) => {
  if (!v) return null;
  // <input type="datetime-local"> gives Dhaka wall-clock time without a zone
  const d = new Date(/[zZ]|[+-]\d\d:\d\d$/.test(v) ? v : `${v}${v.length === 16 ? ':00' : ''}+06:00`);
  if (Number.isNaN(d.getTime())) { ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a valid date and time' }); return z.NEVER; }
  return d;
});

const couponSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  code: z.string().transform(normalizeCode).refine((v) => v.length >= 3, 'Codes need at least 3 letters or numbers (A–Z, 0–9, - and _)'),
  description: z.string().trim().max(160).default(''),
  type: z.enum(COUPON_TYPES),
  value: z.coerce.number().min(0).max(10_000_000).default(0),
  minSubtotal: z.coerce.number().min(0).max(10_000_000).default(0),
  maxDiscount: z.coerce.number().min(0).max(10_000_000).optional().nullable(),
  usageLimit: z.coerce.number().int().min(0).max(1_000_000).optional().nullable(),
  oncePerCustomer: z.coerce.boolean().default(false),
  startsAt: dateTime,
  endsAt: dateTime,
  isActive: z.coerce.boolean().default(true),
}).superRefine((c, ctx) => {
  if (c.type === 'PERCENT' && (c.value < 1 || c.value > 100)) ctx.addIssue({ code: 'custom', path: ['value'], message: 'A percentage is between 1 and 100' });
  if (c.type === 'FIXED' && c.value <= 0) ctx.addIssue({ code: 'custom', path: ['value'], message: 'Enter the amount off' });
  if (c.startsAt && c.endsAt && c.endsAt <= c.startsAt) ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'The end must be after the start' });
});

export type CouponInput = z.input<typeof couponSchema>;

export async function saveCoupon(input: CouponInput): Promise<Result & { field?: string }> {
  const admin = await requirePermission('marketing');
  const parsed = couponSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message, field: String(parsed.error.issues[0].path[0] ?? '') };
  const c = parsed.data;
  const values = {
    code: c.code, description: c.description, type: c.type,
    value: c.type === 'PERCENT' ? Math.round(c.value) : c.type === 'FIXED' ? toPoisha(c.value) : 0,
    minSubtotal: toPoisha(c.minSubtotal),
    maxDiscount: c.type === 'PERCENT' && c.maxDiscount ? toPoisha(c.maxDiscount) : null,
    usageLimit: c.usageLimit ? c.usageLimit : null,
    oncePerCustomer: c.oncePerCustomer, startsAt: c.startsAt, endsAt: c.endsAt, isActive: c.isActive,
  };
  const [clash] = await db.select({ id: schema.coupons.id }).from(schema.coupons).where(eq(schema.coupons.code, c.code)).limit(1);
  if (clash && clash.id !== c.id) return { ok: false, message: `There is already a code called ${c.code}.`, field: 'code' };

  if (c.id) {
    await db.update(schema.coupons).set(values).where(eq(schema.coupons.id, c.id));
    await logActivity(admin, 'coupon.update', 'coupon', c.code, `Updated discount code ${c.code} · ${couponSummary(values)}`);
  } else {
    await db.insert(schema.coupons).values(values);
    await logActivity(admin, 'coupon.create', 'coupon', c.code, `Created discount code ${c.code} · ${couponSummary(values)}`);
  }
  revalidatePath('/admin/marketing', 'layout');
  return { ok: true, message: c.id ? `${c.code} updated` : `${c.code} created` };
}

export async function setCouponActive(id: number, active: boolean): Promise<Result> {
  const admin = await requirePermission('marketing');
  const [c] = await db.select().from(schema.coupons).where(eq(schema.coupons.id, id)).limit(1);
  if (!c) return { ok: false, message: 'Code not found.' };
  await db.update(schema.coupons).set({ isActive: active }).where(eq(schema.coupons.id, id));
  await logActivity(admin, active ? 'coupon.resume' : 'coupon.pause', 'coupon', c.code, `${active ? 'Turned on' : 'Paused'} discount code ${c.code}`);
  revalidatePath('/admin/marketing', 'layout');
  return { ok: true, message: `${c.code} ${active ? 'is live again' : 'paused'}` };
}

export async function deleteCoupon(id: number): Promise<Result> {
  const admin = await requirePermission('marketing');
  const [c] = await db.select().from(schema.coupons).where(eq(schema.coupons.id, id)).limit(1);
  if (!c) return { ok: false, message: 'Already deleted.' };
  await db.delete(schema.coupons).where(eq(schema.coupons.id, id));
  await logActivity(admin, 'coupon.delete', 'coupon', c.code, `Deleted discount code ${c.code} (used ${c.usedCount} times)`);
  revalidatePath('/admin/marketing', 'layout');
  return { ok: true, message: `${c.code} deleted. Past orders keep their discount.` };
}

/* ---------------------------------------------------------------- Conversions API check */

export async function testConversionsApi(): Promise<Result> {
  await requirePermission('marketing');
  const h = await headers();
  const ip = clientIp(h);
  const r = await sendMetaTestEvent({ ip: ip === 'local' ? undefined : ip, userAgent: h.get('user-agent') ?? undefined });
  revalidatePath('/admin/marketing/setup');
  return r;
}

/* ---------------------------------------------------------------- Pixels, verification, chat */

export type TrackingState = { ok?: boolean; message?: string; errors?: Record<string, string> };

/** Pasting the whole <meta … content="…"> tag works too. */
const metaContent = (v: string) => v.match(/content=["']([^"']+)["']/i)?.[1] ?? v;

const FIELDS: { key: keyof StoreSettings; clean: (v: string) => string; valid: RegExp; error: string }[] = [
  { key: 'metaPixelId', clean: (v) => v.replace(/\D/g, ''), valid: /^\d{10,20}$/, error: 'A Meta Pixel ID is a number of 15–16 digits (Events Manager → Data sources).' },
  { key: 'tiktokPixelId', clean: (v) => v.toUpperCase().replace(/[^A-Z0-9]/g, ''), valid: /^[A-Z0-9]{12,30}$/, error: 'Copy the Pixel ID from TikTok Events Manager (letters and numbers, e.g. C4ABCD…).' },
  { key: 'ga4Id', clean: (v) => v.toUpperCase().replace(/\s/g, ''), valid: /^G-[A-Z0-9]{4,20}$/, error: 'A GA4 Measurement ID starts with G-, e.g. G-AB12CD34EF.' },
  { key: 'googleAdsId', clean: (v) => v.toUpperCase().replace(/\s/g, ''), valid: /^AW-\d{6,15}$/, error: 'A Google Ads ID starts with AW-, e.g. AW-123456789.' },
  { key: 'googleAdsPurchaseLabel', clean: (v) => v.replace(/^AW-\d+\//i, '').trim(), valid: /^[A-Za-z0-9_-]{4,40}$/, error: 'The conversion label is the part after the slash in AW-123456789/AbC-D_efG.' },
  { key: 'metaDomainVerification', clean: (v) => metaContent(v).trim(), valid: /^[A-Za-z0-9]{10,64}$/, error: 'Paste the code (or the whole meta tag) from Business settings → Brand safety → Domains.' },
  { key: 'googleSiteVerification', clean: (v) => metaContent(v).trim(), valid: /^[A-Za-z0-9_-]{10,100}$/, error: 'Paste the code (or the whole meta tag) from Google Search Console → HTML tag.' },
  {
    key: 'whatsappNumber',
    clean: (v) => { const d = v.replace(/\D/g, ''); return /^01\d{9}$/.test(d) ? `880${d.slice(1)}` : d; },
    valid: /^\d{10,15}$/, error: 'Enter the WhatsApp number, e.g. 01712345678 or +8801712345678.',
  },
  {
    key: 'messengerPage',
    clean: (v) => v.trim().replace(/^https?:\/\/(www\.|m\.)?(m\.me|facebook\.com|fb\.com)\//i, '').replace(/[/?#].*$/, ''),
    valid: /^[A-Za-z0-9.]{3,60}$/, error: 'Enter your Facebook Page username (facebook.com/username) or m.me link.',
  },
];

export async function saveTracking(_prev: TrackingState, form: FormData): Promise<TrackingState> {
  const admin = await requirePermission('marketing');
  const errors: Record<string, string> = {};
  const values: Partial<StoreSettings & SecretSettings> = {};
  for (const f of FIELDS) {
    const raw = String(form.get(f.key) ?? '').trim().slice(0, 300);
    const v = raw ? f.clean(raw) : '';
    if (v && !f.valid.test(v)) errors[f.key] = f.error;
    else (values as Record<string, string>)[f.key] = v;
  }
  if (values.googleAdsPurchaseLabel && !values.googleAdsId && !errors.googleAdsId) errors.googleAdsId = 'Add the Google Ads ID that this conversion label belongs to.';

  const token = String(form.get('metaCapiToken') ?? '').trim();
  if (form.get('clearCapiToken') === 'on') values.metaCapiToken = '';
  else if (token) {
    if (!/^[A-Za-z0-9_-]{50,600}$/.test(token)) errors.metaCapiToken = 'That doesn’t look like a Conversions API access token. Generate one in Events Manager → your pixel → Settings.';
    else values.metaCapiToken = token;
  }
  const testCode = String(form.get('metaTestEventCode') ?? '').trim().toUpperCase();
  if (testCode && !/^[A-Z0-9]{4,30}$/.test(testCode)) errors.metaTestEventCode = 'Test codes look like TEST12345 (Events Manager → Test events).';
  else values.metaTestEventCode = testCode;

  if (Object.keys(errors).length) return { ok: false, message: 'Please fix the highlighted fields.', errors };
  await saveSettings(values);
  const secret = await getSecretSettings();
  await logActivity(admin, 'settings.tracking', 'settings', null, `Updated ad tracking: ${[
    values.metaPixelId && 'Meta Pixel', secret.metaCapiToken && 'Conversions API', values.tiktokPixelId && 'TikTok', values.ga4Id && 'GA4', values.googleAdsId && 'Google Ads',
  ].filter(Boolean).join(', ') || 'all off'}`);
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Tracking settings saved. They are live in the store now.' };
}
