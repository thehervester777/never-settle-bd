'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ATTR_COOKIE, ATTR_DAYS, COUPON_STORAGE, PARAMS, inAppBrowser, normalizeCode, parseAttribution, type Attribution } from '@/lib/attribution';

function readCookie(name: string) {
  const hit = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`));
  return hit ? hit.slice(name.length + 1) : null;
}

/**
 * Remembers which ad, post or site brought the shopper here (last click wins, direct visits never
 * overwrite a campaign) and saves a discount code from links like /?code=EID20 for checkout.
 */
export function AttributionCapture() {
  const [code, setCode] = useState('');

  useEffect(() => {
    const url = new URL(window.location.href);
    const next: Attribution = {};
    for (const [param, key] of PARAMS) {
      const v = url.searchParams.get(param);
      if (v) (next as Record<string, string>)[key] = v.slice(0, 200);
    }
    let ref = '';
    try { ref = document.referrer ? new URL(document.referrer).hostname : ''; } catch { /* ignore */ }
    if (ref && ref !== window.location.hostname) next.ref = ref;

    const existing = parseAttribution(readCookie(ATTR_COOKIE));
    const hasCampaign = Object.keys(next).length > 0;
    if (hasCampaign || !existing) {
      const app = inAppBrowser(navigator.userAgent);
      if (app) next.app = app;
      if (hasCampaign || app) {
        next.land = `${url.pathname}`.slice(0, 200);
        next.ts = Date.now();
        const secure = window.location.protocol === 'https:' ? '; Secure' : '';
        document.cookie = `${ATTR_COOKIE}=${encodeURIComponent(JSON.stringify(next))}; Max-Age=${ATTR_DAYS * 86400}; Path=/; SameSite=Lax${secure}`;
      }
    }

    const linkCode = normalizeCode(url.searchParams.get('code') ?? url.searchParams.get('coupon') ?? url.searchParams.get('discount'));
    if (linkCode) {
      try { localStorage.setItem(COUPON_STORAGE, linkCode); } catch { /* storage unavailable */ }
      setCode(linkCode);
      const t = setTimeout(() => setCode(''), 6000);
      return () => clearTimeout(t);
    }
  }, []);

  return (
    <AnimatePresence>
      {code && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-x-4 bottom-4 z-[120] mx-auto flex max-w-md items-center justify-between gap-3 bg-ink px-5 py-4 text-sm text-paper shadow-2xl sm:bottom-6"
        >
          <span>Code <strong className="font-semibold tracking-wider">{code}</strong> saved. It&apos;s applied at checkout.</span>
          <button type="button" onClick={() => setCode('')} className="text-paper/60 hover:text-paper" aria-label="Dismiss">✕</button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
