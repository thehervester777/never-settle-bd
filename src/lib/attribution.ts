/**
 * Where a shopper came from. The browser keeps the last campaign click (UTM tags, ad click ids,
 * referring site) in a first-party cookie for 30 days; checkout reads it and saves it on the order.
 * Shared by browser and server code, so no server-only imports here.
 */

export const ATTR_COOKIE = 'ns_attr';
export const ATTR_DAYS = 30;
export const COUPON_STORAGE = 'ns_coupon';

export type Attribution = {
  s?: string; // utm_source
  m?: string; // utm_medium
  c?: string; // utm_campaign
  ct?: string; // utm_content (usually the ad)
  t?: string; // utm_term
  fbclid?: string;
  gclid?: string;
  wbraid?: string;
  gbraid?: string;
  ttclid?: string;
  ref?: string; // referring host
  app?: string; // in-app browser (facebook, instagram, tiktok) when nothing else is known
  land?: string; // landing page path
  ts?: number; // when this visit was recorded (ms)
};

export const PARAMS: [param: string, key: keyof Attribution][] = [
  ['utm_source', 's'], ['utm_medium', 'm'], ['utm_campaign', 'c'], ['utm_content', 'ct'], ['utm_term', 't'],
  ['fbclid', 'fbclid'], ['gclid', 'gclid'], ['wbraid', 'wbraid'], ['gbraid', 'gbraid'], ['ttclid', 'ttclid'],
];

const clean = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : undefined) || undefined;

export function parseAttribution(raw: string | undefined | null): Attribution | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw.startsWith('%7B') || raw.startsWith('%7b') ? decodeURIComponent(raw) : raw);
    if (!v || typeof v !== 'object') return null;
    const out: Attribution = {};
    for (const [, key] of PARAMS) { const x = clean(v[key]); if (x) (out as Record<string, unknown>)[key] = x; }
    for (const key of ['ref', 'app', 'land'] as const) { const x = clean(v[key]); if (x) out[key] = x; }
    if (typeof v.ts === 'number' && Number.isFinite(v.ts)) out.ts = v.ts;
    return out;
  } catch {
    return null;
  }
}

/** The in-app browser of Facebook, Instagram or TikTok, from the user agent. */
export function inAppBrowser(ua: string): string | undefined {
  if (/Instagram/i.test(ua)) return 'instagram';
  if (/FBAN|FBAV|FB_IAB|FBIOS/i.test(ua)) return /Messenger|MESSENGER/.test(ua) ? 'messenger' : 'facebook';
  if (/musical_ly|BytedanceWebview|TikTok/i.test(ua)) return 'tiktok';
  return undefined;
}

const SOURCE_ALIASES: Record<string, string> = {
  fb: 'facebook', facebook: 'facebook', 'facebook.com': 'facebook', 'm.facebook.com': 'facebook', meta: 'facebook', an: 'facebook',
  ig: 'instagram', instagram: 'instagram', 'instagram.com': 'instagram',
  msg: 'messenger', messenger: 'messenger',
  tiktok: 'tiktok', tt: 'tiktok', 'tiktok.com': 'tiktok',
  google: 'google', adwords: 'google', google_ads: 'google', googleads: 'google',
  youtube: 'youtube', yt: 'youtube', whatsapp: 'whatsapp', wa: 'whatsapp',
  email: 'email', newsletter: 'email', sms: 'sms',
};

const REFERRERS: [RegExp, string, string][] = [
  [/(^|\.)instagram\.com$/, 'instagram', 'social'],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me)$/, 'facebook', 'social'],
  [/(^|\.)messenger\.com$/, 'messenger', 'social'],
  [/(^|\.)tiktok\.com$/, 'tiktok', 'social'],
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'youtube', 'social'],
  [/(^|\.)(whatsapp\.com|wa\.me)$/, 'whatsapp', 'social'],
  [/(^|\.)(t\.co|twitter\.com|x\.com)$/, 'twitter', 'social'],
  [/(^|\.)(linkedin\.com|lnkd\.in)$/, 'linkedin', 'social'],
  [/(^|\.)pinterest\./, 'pinterest', 'social'],
  [/(^|\.)google\./, 'google', 'organic'],
  [/(^|\.)bing\.com$/, 'bing', 'organic'],
  [/(^|\.)(duckduckgo\.com|yahoo\.com|yandex\.)/, 'search', 'organic'],
];

const slug = (v: string, max: number) => v.toLowerCase().replace(/[^a-z0-9._ -]/g, '').trim().slice(0, max);

/** Turns what the browser saw into a source / medium / campaign for reports. */
export function deriveSource(a: Attribution | null, userAgent = ''): { source: string; medium: string; campaign: string | null } {
  const campaign = a?.c ? a.c.slice(0, 120) : null;
  const paidClick = a?.gclid || a?.wbraid || a?.gbraid ? 'google' : a?.ttclid ? 'tiktok' : null;
  if (a?.s) {
    const raw = slug(a.s, 40);
    return { source: SOURCE_ALIASES[raw] ?? (raw || 'unknown'), medium: slug(a.m ?? '', 60) || (paidClick ? 'paid' : 'referral'), campaign };
  }
  if (paidClick === 'google') return { source: 'google', medium: 'cpc', campaign };
  if (paidClick === 'tiktok') return { source: 'tiktok', medium: 'paid_social', campaign };
  if (a?.fbclid) return { source: a.ref && /instagram/.test(a.ref) ? 'instagram' : a.app === 'instagram' ? 'instagram' : 'facebook', medium: 'social', campaign };
  if (a?.ref) {
    const host = a.ref.toLowerCase().replace(/^www\./, '');
    const hit = REFERRERS.find(([re]) => re.test(host));
    return hit ? { source: hit[1], medium: hit[2], campaign } : { source: host.slice(0, 40), medium: 'referral', campaign };
  }
  const app = a?.app ?? inAppBrowser(userAgent);
  if (app) return { source: app, medium: 'social', campaign };
  return { source: 'direct', medium: '(none)', campaign };
}

const LABELS: Record<string, string> = {
  facebook: 'Facebook', instagram: 'Instagram', messenger: 'Messenger', tiktok: 'TikTok', google: 'Google', youtube: 'YouTube',
  whatsapp: 'WhatsApp', twitter: 'X (Twitter)', linkedin: 'LinkedIn', pinterest: 'Pinterest', bing: 'Bing', search: 'Other search',
  email: 'Email', sms: 'SMS', direct: 'Direct', unknown: 'Unknown',
};
export const sourceLabel = (s: string | null | undefined) => (s ? LABELS[s] ?? s : 'Not recorded');

const MEDIUMS: Record<string, string> = {
  paid_social: 'Paid social', paid: 'Paid', cpc: 'Paid search', ppc: 'Paid search', social: 'Social', organic: 'Organic search',
  referral: 'Referral', email: 'Email', '(none)': 'No referrer', story: 'Story', bio: 'Profile link', influencer: 'Influencer',
};
export const mediumLabel = (m: string | null | undefined) => (m ? MEDIUMS[m] ?? m : '');

/** Paid traffic: tagged as paid, or arrived through an ad click id. */
export const isPaidMedium = (m: string | null | undefined) => !!m && /paid|^(cpc|ppc|cpm|cpa|ads?|display|banner)$/.test(m);

/** Codes look like EID20 or SUMMER-SALE. */
export const normalizeCode = (v: unknown) => (typeof v === 'string' ? v.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 40) : '');
