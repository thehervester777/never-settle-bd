'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useCart } from '@/components/cart/CartProvider';
import { Icon } from '@/components/ui/Icon';

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * A product opened from the store shows as a full-screen sheet over the page the shopper was on.
 * The address bar has the product link, and ✕, Escape or Back return to the same spot in the list.
 * Opening the link directly (or refreshing) shows the normal product page instead.
 */
export function ProductOverlay({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const { count, open: openCart } = useCart();
  const [closing, setClosing] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  // Products opened from inside the overlay (e.g. "You may also like") stack up; ✕ goes back past all of them.
  const stack = useRef<string[]>([pathname]);

  useEffect(() => {
    const s = stack.current;
    if (s.length > 1 && s[s.length - 2] === pathname) s.pop();
    else if (s[s.length - 1] !== pathname) s.push(pathname);
    panel.current?.scrollTo({ top: 0 });
  }, [pathname]);

  const close = useCallback(() => setClosing(true), []);
  const leave = () => { if (closing) window.history.go(-stack.current.length); };

  useEffect(() => {
    const html = document.documentElement;
    const before = html.style.overflow;
    html.style.overflow = 'hidden';
    panel.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      // Leave Escape to whatever is open on top (cart, zoomed photo, search).
      if (e.key === 'Escape' && !document.body.classList.contains('scroll-locked')) close();
    };
    window.addEventListener('keydown', onKey);
    return () => { html.style.overflow = before; window.removeEventListener('keydown', onKey); };
  }, [close]);

  return (
    <motion.div
      ref={panel}
      role="dialog" aria-modal="true" aria-label="Product" tabIndex={-1}
      className="fixed inset-0 z-[70] overflow-y-auto overscroll-contain bg-paper outline-none"
      initial={reduce ? { opacity: 0 } : { y: '100%' }}
      animate={closing ? (reduce ? { opacity: 0 } : { y: '100%' }) : (reduce ? { opacity: 1 } : { y: 0 })}
      transition={{ duration: closing ? 0.4 : 0.6, ease: EASE }}
      onAnimationComplete={leave}
    >
      <div className="sticky top-0 z-20 border-b border-ink/10 bg-paper/95 backdrop-blur">
        <div className="container flex h-14 items-center justify-between md:h-16">
          <button type="button" onClick={close} className="-ml-2 flex items-center gap-2 p-2 text-xs font-semibold uppercase tracking-[0.18em]" aria-label="Close and go back">
            <Icon name="close" className="h-5 w-5" /> <span className="hidden sm:inline">Close</span>
          </button>
          <Link href="/" className="font-display text-xl uppercase tracking-wide md:text-2xl">Never Settle</Link>
          <button type="button" onClick={openCart} className="relative -mr-2 p-2" aria-label={`Open cart, ${count} item${count === 1 ? '' : 's'}`}>
            <Icon name="cart" className="h-6 w-6" />
            {count > 0 && <span className="absolute right-0 top-0 grid h-4 min-w-[1rem] place-items-center rounded-full bg-ink px-1 text-[0.6rem] font-semibold text-paper">{count}</span>}
          </button>
        </div>
      </div>
      {children}
    </motion.div>
  );
}

/** Shown in the overlay while the product loads, so the sheet opens the moment a product is tapped. */
export function ProductOverlaySkeleton() {
  return (
    <div className="pb-16 md:container md:pb-24 md:pt-6" aria-busy="true" aria-label="Loading product">
      <div className="hidden py-4 md:block"><div className="h-3 w-48 animate-pulse bg-bone" /></div>
      <div className="grid gap-8 md:grid-cols-12 md:gap-10 lg:gap-16">
        <div className="md:col-span-7">
          <div className="grid gap-2 md:grid-cols-2">
            <div className="animate-pulse bg-bone" style={{ aspectRatio: '4 / 5' }} />
            <div className="hidden animate-pulse bg-bone md:block" style={{ aspectRatio: '4 / 5' }} />
          </div>
        </div>
        <div className="container space-y-4 md:col-span-5 md:px-0">
          <div className="h-3 w-24 animate-pulse bg-bone" />
          <div className="h-12 w-3/4 animate-pulse bg-bone" />
          <div className="h-6 w-28 animate-pulse bg-bone" />
          <div className="flex gap-2 pt-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-10 w-14 animate-pulse bg-bone" />)}</div>
          <div className="h-14 w-full animate-pulse bg-bone" />
        </div>
      </div>
    </div>
  );
}

/** The browser tab shows the open product's name, and the page's own title again once it closes. */
export function OverlayTitle({ title }: { title: string }) {
  useEffect(() => {
    const before = document.title;
    document.title = title;
    return () => { document.title = before; };
  }, [title]);
  return null;
}
