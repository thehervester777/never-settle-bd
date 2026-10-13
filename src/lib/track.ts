/**
 * One call per shopper action, sent to every ad platform that is switched on in the admin
 * (Meta Pixel, TikTok Pixel, Google Analytics 4 and Google Ads). Browser-only; does nothing
 * when a platform isn't set up. Prices come in poisha and are sent in taka.
 *
 * Product ids match the catalog feed (/feeds/products.xml): each size/colour is `v{variantId}`
 * and the product it belongs to is `p{productId}`, so dynamic ads can show exactly what was viewed.
 */

export type TrackItem = { variantId?: number | null; productId: number; name: string; price: number; quantity: number; variant?: string; category?: string };

type Fn = (...args: unknown[]) => void;
type W = Window & { fbq?: Fn; ttq?: { track: Fn; identify: Fn; page: Fn }; gtag?: Fn; __nsTrack?: { adsPurchase?: string }; __nsPending?: (() => void)[] };

export const itemId = (i: Pick<TrackItem, 'variantId' | 'productId'>) => (i.variantId ? `v${i.variantId}` : `p${i.productId}`);
const taka = (poisha: number) => Math.round(poisha) / 100;
const CURRENCY = 'BDT';

function call(fn: () => void) {
  try { fn(); } catch { /* a blocked or half-loaded tag must never break the store */ }
}

/** Runs now if the tags are set up, otherwise as soon as <Tracking> has loaded them. */
function whenReady(fn: (w: W) => void) {
  if (typeof window === 'undefined') return;
  const w = window as W;
  if (w.__nsTrack) call(() => fn(w));
  else (w.__nsPending ??= []).push(() => fn(w));
}

function sendAll(meta: [string, Record<string, unknown>, Record<string, unknown>?] | null, tiktok: [string, Record<string, unknown>, Record<string, unknown>?] | null, google: [string, Record<string, unknown>] | null) {
  whenReady((w) => {
    if (meta && w.fbq) call(() => (meta[2] ? w.fbq!('track', meta[0], meta[1], meta[2]) : w.fbq!('track', meta[0], meta[1])));
    if (tiktok && w.ttq) call(() => (tiktok[2] ? w.ttq!.track(tiktok[0], tiktok[1], tiktok[2]) : w.ttq!.track(tiktok[0], tiktok[1])));
    if (google && w.gtag) call(() => w.gtag!('event', google[0], google[1]));
  });
}

const metaItems = (items: TrackItem[]) => ({
  content_ids: items.map(itemId),
  content_type: 'product',
  contents: items.map((i) => ({ id: itemId(i), quantity: i.quantity, item_price: taka(i.price) })),
  num_items: items.reduce((s, i) => s + i.quantity, 0),
});
const tiktokItems = (items: TrackItem[]) => items.map((i) => ({ content_id: itemId(i), content_type: 'product', content_name: i.name, quantity: i.quantity, price: taka(i.price) }));
const googleItems = (items: TrackItem[]) => items.map((i) => ({
  item_id: itemId(i), item_name: i.name, item_brand: 'NEVER SETTLE', price: taka(i.price), quantity: i.quantity,
  ...(i.variant ? { item_variant: i.variant } : {}), ...(i.category ? { item_category: i.category } : {}),
}));
const total = (items: TrackItem[]) => items.reduce((s, i) => s + i.price * i.quantity, 0);

export function trackViewItem(item: TrackItem) {
  const value = taka(item.price);
  sendAll(
    // The whole product (all sizes) for Meta; the catalog groups sizes under item_group_id p{id}.
    ['ViewContent', { content_ids: [`p${item.productId}`], content_type: 'product_group', content_name: item.name, content_category: item.category, value, currency: CURRENCY }],
    ['ViewContent', { contents: [{ content_id: `p${item.productId}`, content_type: 'product_group', content_name: item.name, price: value }], value, currency: CURRENCY }],
    ['view_item', { currency: CURRENCY, value, items: googleItems([item]) }],
  );
}

export function trackAddToCart(item: TrackItem) {
  const value = taka(item.price * item.quantity);
  sendAll(
    ['AddToCart', { ...metaItems([item]), content_name: item.name, value, currency: CURRENCY }],
    ['AddToCart', { contents: tiktokItems([item]), value, currency: CURRENCY }],
    ['add_to_cart', { currency: CURRENCY, value, items: googleItems([item]) }],
  );
}

export function trackBeginCheckout(items: TrackItem[]) {
  const value = taka(total(items));
  sendAll(
    ['InitiateCheckout', { ...metaItems(items), value, currency: CURRENCY }],
    ['InitiateCheckout', { contents: tiktokItems(items), value, currency: CURRENCY }],
    ['begin_checkout', { currency: CURRENCY, value, items: googleItems(items) }],
  );
}

export type PurchaseUser = { email?: string; phone?: string; phoneE164?: string; externalId?: string };

/**
 * The order number is the event id, so Meta and TikTok drop the copy that the server also sends
 * (Conversions API) and Google counts the transaction once.
 */
export function trackPurchase(p: { number: string; value: number; shipping: number; discount: number; coupon?: string | null; items: TrackItem[]; user?: PurchaseUser }) {
  whenReady((w) => purchase(w, p));
}

function purchase(w: W, p: Parameters<typeof trackPurchase>[0]) {
  const value = taka(p.value);
  if (p.user && w.ttq) call(() => w.ttq!.identify({ ...(p.user!.email ? { email: p.user!.email } : {}), ...(p.user!.phoneE164 ? { phone_number: p.user!.phoneE164 } : {}), ...(p.user!.externalId ? { external_id: p.user!.externalId } : {}) }));
  if (p.user && w.gtag) call(() => w.gtag!('set', 'user_data', { ...(p.user!.email ? { sha256_email_address: p.user!.email } : {}), ...(p.user!.phoneE164 ? { sha256_phone_number: p.user!.phoneE164 } : {}) }));
  sendAll(
    ['Purchase', { ...metaItems(p.items), value, currency: CURRENCY, order_id: p.number }, { eventID: p.number }],
    ['CompletePayment', { contents: tiktokItems(p.items), value, currency: CURRENCY, order_id: p.number }, { event_id: p.number }],
    ['purchase', { transaction_id: p.number, currency: CURRENCY, value, shipping: taka(p.shipping), ...(p.coupon ? { coupon: p.coupon } : {}), ...(p.discount ? { discount: taka(p.discount) } : {}), items: googleItems(p.items) }],
  );
  const sendTo = w.__nsTrack?.adsPurchase;
  if (sendTo && w.gtag) call(() => w.gtag!('event', 'conversion', { send_to: sendTo, value, currency: CURRENCY, transaction_id: p.number }));
}

export function trackSearch(query: string) {
  const q = query.trim().slice(0, 100);
  if (!q) return;
  sendAll(['Search', { search_string: q }], ['Search', { query: q }], ['search', { search_term: q }]);
}

export function trackLead(form: 'newsletter' | 'contact') {
  if (form === 'newsletter') sendAll(['Lead', { content_name: 'Newsletter' }], ['Subscribe', {}], ['generate_lead', { lead_source: 'newsletter' }]);
  else sendAll(['Contact', { content_name: 'Contact form' }], ['Contact', {}], ['generate_lead', { lead_source: 'contact_form' }]);
}

export function trackChat(channel: 'whatsapp' | 'messenger', context: string) {
  sendAll(['Contact', { content_name: `${channel} · ${context}`.slice(0, 100) }], ['Contact', {}], ['contact', { method: channel, context }]);
}
