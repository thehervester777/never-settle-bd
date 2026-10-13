'use client';

import { useEffect } from 'react';
import { trackPurchase, trackSearch, trackViewItem, type PurchaseUser, type TrackItem } from '@/lib/track';

/** Product page view (ViewContent / view_item). */
export function ViewItemTracker({ item }: { item: TrackItem }) {
  useEffect(() => { trackViewItem(item); }, [item.productId]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export function SearchTracker({ query }: { query: string }) {
  useEffect(() => { trackSearch(query); }, [query]);
  return null;
}

type Purchase = { number: string; value: number; shipping: number; discount: number; coupon: string | null; items: TrackItem[]; user: PurchaseUser };

/**
 * Sends the Purchase from the order confirmation page, once per order in this browser
 * (reloading the page or opening the link again doesn't count the sale twice).
 */
export function PurchaseTracker({ purchase }: { purchase: Purchase }) {
  useEffect(() => {
    const key = `ns_tracked_${purchase.number}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, '1');
    } catch { /* storage unavailable: the event id still prevents double counting on Meta, TikTok and Google */ }
    trackPurchase(purchase);
  }, [purchase]);
  return null;
}
