import 'server-only';
import crypto from 'crypto';
import { getSecretSettings, getSettings, setInternalValue } from '@/lib/settings';

/**
 * Meta Conversions API: the server reports each order straight to Meta, so purchases still count
 * when the browser pixel is blocked (ad blockers, iOS, in-app browsers). The browser pixel sends the
 * same event with the order number as its event id and Meta keeps one of them.
 * Customer details are normalised and SHA-256 hashed before they leave the server.
 */

const sha = (v: string) => crypto.createHash('sha256').update(v).digest('hex');

/** 01712345678 → 8801712345678 (country code, digits only). */
export const intlPhone = (phone: string) => {
  const d = phone.replace(/\D/g, '');
  return d.startsWith('880') ? d : d.startsWith('0') ? `880${d.slice(1)}` : d;
};

/** Hashed identifiers for the browser tags (TikTok identify, Google enhanced conversions). */
export function hashedShopper(o: { email?: string | null; phone: string }) {
  const phone = intlPhone(o.phone);
  return {
    email: o.email ? sha(o.email.trim().toLowerCase()) : undefined,
    phone: sha(phone),
    phoneE164: sha(`+${phone}`),
    externalId: sha(phone),
  };
}

const nameParts = (full: string) => {
  const clean = full.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').trim().split(/\s+/).filter(Boolean);
  return { fn: clean[0] ?? '', ln: clean.length > 1 ? clean[clean.length - 1] : '' };
};

export type CapiContext = { ip?: string; userAgent?: string; fbp?: string; fbc?: string; url?: string };
export type CapiResult = { ok: boolean; message: string };

const graphUrl = () => (process.env.META_GRAPH_URL || 'https://graph.facebook.com/v23.0').replace(/\/$/, '');

async function post(pixelId: string, token: string, testCode: string, events: Record<string, unknown>[]): Promise<CapiResult> {
  try {
    const res = await fetch(`${graphUrl()}/${encodeURIComponent(pixelId)}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: events, access_token: token, ...(testCode ? { test_event_code: testCode } : {}) }),
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    });
    const body = (await res.json().catch(() => ({}))) as { events_received?: number; error?: { message?: string } };
    if (!res.ok) return { ok: false, message: body.error?.message?.slice(0, 300) || `Meta answered ${res.status}` };
    return { ok: true, message: `Meta received ${body.events_received ?? events.length} event${(body.events_received ?? events.length) === 1 ? '' : 's'}${testCode ? ' (test mode)' : ''}` };
  } catch (e) {
    return { ok: false, message: e instanceof Error && e.name === 'TimeoutError' ? 'Meta did not answer in time' : 'Could not reach Meta' };
  }
}

async function config() {
  const [s, secret] = await Promise.all([getSettings(), getSecretSettings()]);
  return s.metaPixelId && secret.metaCapiToken ? { pixelId: s.metaPixelId, token: secret.metaCapiToken, testCode: secret.metaTestEventCode } : null;
}

export const capiEnabled = async () => !!(await config());

function userData(o: { email?: string | null; phone: string; customerName: string; city: string }, ctx: CapiContext) {
  const phone = intlPhone(o.phone);
  const { fn, ln } = nameParts(o.customerName);
  const ct = o.city.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  return {
    ph: [sha(phone)],
    ...(o.email ? { em: [sha(o.email.trim().toLowerCase())] } : {}),
    ...(fn ? { fn: [sha(fn)] } : {}),
    ...(ln ? { ln: [sha(ln)] } : {}),
    ...(ct ? { ct: [sha(ct)] } : {}),
    country: [sha('bd')],
    external_id: [sha(phone)],
    ...(ctx.ip ? { client_ip_address: ctx.ip } : {}),
    ...(ctx.userAgent ? { client_user_agent: ctx.userAgent } : {}),
    ...(ctx.fbp ? { fbp: ctx.fbp } : {}),
    ...(ctx.fbc ? { fbc: ctx.fbc } : {}),
  };
}

type PurchaseOrder = {
  number: string; total: number; shippingFee: number; email?: string | null; phone: string; customerName: string; city: string; createdAt?: Date;
  lines: { variantId: number; quantity: number; price: number }[];
};

/** Sends the Purchase for a new order. Never throws; the outcome is kept for the admin's setup page. */
export async function sendPurchaseToMeta(order: PurchaseOrder, ctx: CapiContext): Promise<CapiResult | null> {
  const cfg = await config();
  if (!cfg) return null;
  const site = process.env.NEXT_PUBLIC_SITE_URL || '';
  const event = {
    event_name: 'Purchase',
    event_time: Math.floor((order.createdAt?.getTime() ?? Date.now()) / 1000),
    event_id: order.number,
    action_source: 'website',
    event_source_url: ctx.url || `${site}/checkout`,
    user_data: userData(order, ctx),
    custom_data: {
      currency: 'BDT',
      value: order.total / 100,
      order_id: order.number,
      content_type: 'product',
      content_ids: order.lines.map((l) => `v${l.variantId}`),
      contents: order.lines.map((l) => ({ id: `v${l.variantId}`, quantity: l.quantity, item_price: l.price / 100 })),
      num_items: order.lines.reduce((s, l) => s + l.quantity, 0),
    },
  };
  const result = await post(cfg.pixelId, cfg.token, cfg.testCode, [event]);
  if (!result.ok) console.error(`[meta] Purchase ${order.number} not sent: ${result.message}`);
  await setInternalValue('_metaCapiLast', { ...result, at: new Date().toISOString(), event: `Purchase ${order.number}` }).catch(() => {});
  return result;
}

/** A PageView sent from the setup page to check the token (shows under Test events when a test code is set). */
export async function sendMetaTestEvent(ctx: CapiContext): Promise<CapiResult> {
  const cfg = await config();
  if (!cfg) return { ok: false, message: 'Add the Pixel ID and the Conversions API token first.' };
  const result = await post(cfg.pixelId, cfg.token, cfg.testCode, [{
    event_name: 'PageView', event_time: Math.floor(Date.now() / 1000), event_id: `test-${crypto.randomBytes(6).toString('hex')}`, action_source: 'website',
    event_source_url: process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com',
    user_data: { ...(ctx.ip ? { client_ip_address: ctx.ip } : {}), client_user_agent: ctx.userAgent || 'never-settle-admin-test' },
  }]);
  await setInternalValue('_metaCapiLast', { ...result, at: new Date().toISOString(), event: 'Test PageView' }).catch(() => {});
  return result;
}

/** fbp / fbc from the Meta cookies, or fbc rebuilt from an fbclid we saved with the visit. */
export function metaCookies(cookie: (name: string) => string | undefined, fbclid?: string, clickTime?: number) {
  const fbp = cookie('_fbp');
  const fbc = cookie('_fbc') || (fbclid ? `fb.1.${clickTime ?? Date.now()}.${fbclid}` : undefined);
  return { fbp, fbc };
}
