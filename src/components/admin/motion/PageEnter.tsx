'use client';

import { useRef } from 'react';
import { gsap, reducedMotion, ScrollTrigger, SplitText, useGSAP } from './gsap';

/** Top-level cards (not cards inside cards). */
const cardsIn = (root: HTMLElement) => Array.from(root.querySelectorAll<HTMLElement>('.admin-card')).filter((c) => !c.parentElement?.closest('.admin-card'));

/**
 * Every admin page enters the same way: the title rises word by word, the rest of the header follows,
 * and cards lift into place as they scroll into view (ScrollTrigger.batch), so long pages reveal
 * themselves while you scroll instead of all at once.
 */
export function PageEnter({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const el = ref.current!;
    el.setAttribute('data-page-in', '');
    // Explicit start and end: with animations turned off the browser's own CSS fade can report a
    // half-way opacity at this moment, so the end value is never read from the page.
    if (reducedMotion()) {
      gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: 'none', clearProps: 'opacity' });
      return;
    }

    const tl = gsap.timeline();
    tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: 'power1.out', clearProps: 'opacity' }, 0);

    const title = el.querySelector<HTMLElement>('[data-page-title]');
    if (title) {
      const split = SplitText.create(title, { type: 'words', mask: 'words', aria: 'auto' });
      tl.from(split.words, { yPercent: 115, rotate: 4, duration: 1, stagger: 0.06, ease: 'expo.out' }, 0.05);
    }
    tl.from(el.querySelectorAll('[data-page-sub]'), { y: 16, opacity: 0, duration: 0.8, stagger: 0.07, ease: 'expo.out' }, 0.18);

    // The page heading drifts up and fades a little as the page scrolls under it (depth).
    const head = el.querySelector<HTMLElement>('div[data-page-head]');
    if (head) gsap.to(head, { y: -28, opacity: 0.35, ease: 'none', scrollTrigger: { trigger: head, start: 'top top+=72', end: '+=240', scrub: 0.6 } });

    // Other blocks at the top of the page (tabs, filters, range pickers) that aren't cards
    const root = el.firstElementChild as HTMLElement | null;
    const blocks = root ? Array.from(root.children).filter((c) => !c.matches('.admin-card,[data-page-head]') && !c.querySelector('.admin-card,[data-page-head]')) : [];
    if (blocks.length) tl.from(blocks.slice(0, 6), { y: 18, opacity: 0, duration: 0.8, stagger: 0.06, ease: 'expo.out' }, 0.22);

    // Cards rise into place as they scroll into view
    const cards = cardsIn(el);
    gsap.set(cards, { opacity: 0, y: 56, rotationX: 8, scale: 0.985, transformPerspective: 1200, transformOrigin: '50% 0%' });
    let first = true;
    const reveal = (batch: Element[]) => {
      gsap.to(batch, {
        opacity: 1, y: 0, rotationX: 0, scale: 1, duration: 1.1, stagger: 0.08, ease: 'expo.out',
        delay: first ? 0.15 : 0, overwrite: 'auto', clearProps: 'transform',
      });
      first = false;
    };
    ScrollTrigger.batch(cards, { start: 'top 94%', once: true, interval: 0.08, batchMax: 6, onEnter: reveal });
    // Whatever is still hidden when the end of the page is reached shows up too.
    ScrollTrigger.create({ trigger: el, start: 'bottom bottom', once: true, onEnter: () => reveal(cards.filter((c) => Number(gsap.getProperty(c, 'opacity')) < 1)) });

    // Content that changes height (charts measuring themselves, images) moves the trigger points.
    let t = 0;
    const ro = new ResizeObserver(() => { clearTimeout(t); t = window.setTimeout(() => ScrollTrigger.refresh(), 120); });
    ro.observe(el);
    return () => { ro.disconnect(); clearTimeout(t); };
  }, { scope: ref });

  return <div ref={ref} data-page>{children}</div>;
}
