'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

export type TrackingConfig = { metaPixelId: string; tiktokPixelId: string; ga4Id: string; googleAdsId: string; googleAdsPurchaseLabel: string };

type Fn = ((...args: unknown[]) => void) & Record<string, unknown>;
type W = Window & Record<string, unknown> & {
  fbq?: Fn; ttq?: Fn & { page: () => void; load: (id: string) => void }; dataLayer?: unknown[]; gtag?: Fn;
  __nsTrack?: { adsPurchase?: string }; __nsPending?: (() => void)[];
};

function addScript(src: string) {
  const s = document.createElement('script');
  s.async = true;
  s.src = src;
  document.head.appendChild(s);
}

/* The official loader snippets, set up in code so events can be queued before the scripts arrive. */

function loadMeta(w: W, id: string) {
  if (w.fbq) return;
  const n = function (...args: unknown[]) {
    if (n.callMethod) (n.callMethod as (...a: unknown[]) => void)(...args);
    else (n.queue as unknown[]).push(args);
  } as Fn;
  w.fbq = n;
  if (!w._fbq) w._fbq = n;
  n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
  n.disablePushState = true; // page views are sent below, once per page, instead of on every history change
  addScript('https://connect.facebook.net/en_US/fbevents.js');
  w.fbq('init', id);
}

function loadTikTok(w: W, id: string) {
  if (w.ttq) return;
  w.TiktokAnalyticsObject = 'ttq';
  const ttq = [] as unknown as Fn & { methods: string[]; _i: Record<string, unknown>; _t: Record<string, number>; _o: Record<string, unknown>; push: (x: unknown) => void };
  ttq.methods = ['page', 'track', 'identify', 'instances', 'debug', 'on', 'off', 'once', 'ready', 'alias', 'group', 'enableCookie', 'disableCookie', 'holdConsent', 'revokeConsent', 'grantConsent'];
  const defer = (t: Record<string, unknown> & { push: (x: unknown) => void }, m: string) => { t[m] = (...args: unknown[]) => t.push([m, ...args]); };
  for (const m of ttq.methods) defer(ttq, m);
  ttq.instance = (t: string) => { const e = (ttq._i[t] ?? []) as unknown as Record<string, unknown> & { push: (x: unknown) => void }; for (const m of ttq.methods) defer(e, m); return e; };
  ttq.load = (e: string, o?: unknown) => {
    const r = 'https://analytics.tiktok.com/i18n/pixel/events.js';
    ttq._i = ttq._i || {}; ttq._i[e] = []; (ttq._i[e] as Record<string, unknown>)._u = r;
    ttq._t = ttq._t || {}; ttq._t[e] = +new Date();
    ttq._o = ttq._o || {}; ttq._o[e] = o || {};
    addScript(`${r}?sdkid=${encodeURIComponent(e)}&lib=ttq`);
  };
  w.ttq = ttq as unknown as W['ttq'];
  w.ttq!.load(id);
}

function loadGoogle(w: W, ga4: string, ads: string) {
  if (w.gtag) return;
  w.dataLayer = w.dataLayer || [];
  // gtag must queue the `arguments` object itself, not an array copy.
  // eslint-disable-next-line prefer-rest-params
  w.gtag = function gtag() { w.dataLayer!.push(arguments); } as unknown as Fn;
  w.gtag('js', new Date());
  if (ga4) w.gtag('config', ga4);
  if (ads) w.gtag('config', ads);
  addScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga4 || ads)}`);
}

/**
 * Loads the ad and analytics tags that are switched on in Admin → Marketing → Tracking and sends
 * a page view for every page. GA4 counts page changes itself (enhanced measurement).
 */
export function Tracking({ config }: { config: TrackingConfig }) {
  const pathname = usePathname();
  const ready = useRef(false);

  useEffect(() => {
    const w = window as unknown as W;
    if (config.metaPixelId) loadMeta(w, config.metaPixelId);
    if (config.tiktokPixelId) loadTikTok(w, config.tiktokPixelId);
    if (config.ga4Id || config.googleAdsId) loadGoogle(w, config.ga4Id, config.googleAdsId);
    w.__nsTrack = { adsPurchase: config.googleAdsId && config.googleAdsPurchaseLabel ? `${config.googleAdsId}/${config.googleAdsPurchaseLabel}` : undefined };
    ready.current = true;
  }, [config]);

  useEffect(() => {
    if (!ready.current) return;
    const w = window as unknown as W;
    try { w.fbq?.('track', 'PageView'); } catch { /* ignore */ }
    try { w.ttq?.page(); } catch { /* ignore */ }
    // Events a page sent before the tags were set up (its effects can run first).
    const pending = w.__nsPending?.splice(0) ?? [];
    for (const fn of pending) { try { fn(); } catch { /* ignore */ } }
  }, [pathname]);

  return null;
}
