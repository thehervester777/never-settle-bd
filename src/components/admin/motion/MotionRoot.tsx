'use client';

import Lenis from 'lenis';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AdminIcon } from '../AdminIcon';
import { finePointer, gsap, reducedMotion, ScrollTrigger, useGSAP } from './gsap';

type Motion = { scrollTo: (target: number | HTMLElement, opts?: { immediate?: boolean }) => void };
const Ctx = createContext<Motion>({ scrollTo: (t) => window.scrollTo({ top: typeof t === 'number' ? t : t.offsetTop }) });
export const useAdminMotion = () => useContext(Ctx);

/** Links that open real pages of the panel (not downloads, print views or API calls). */
function panelLink(e: MouseEvent): URL | null {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return null;
  const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
  if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download') || a.hasAttribute('data-no-transition')) return null;
  const url = new URL(a.href, window.location.href);
  if (url.origin !== window.location.origin || !url.pathname.startsWith('/admin')) return null;
  if (/\/(export|print)(\/|$)|^\/admin\/(login|setup|print)/.test(url.pathname)) return null;
  // Same page with other filters: the content updates in place, no page transition.
  if (url.pathname === window.location.pathname) return null;
  return url;
}

/**
 * The admin panel's motion layer: smooth (inertia) scrolling with Lenis driven by the GSAP ticker so
 * ScrollTrigger stays in sync, page exit transitions with a loading line, a scroll progress line,
 * back-to-top, and a soft light that follows the pointer over cards.
 */
export function MotionRoot({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const lenis = useRef<Lenis | null>(null);
  const loader = useRef<HTMLDivElement>(null);
  const progress = useRef<HTMLDivElement>(null);
  const leaving = useRef<{ to: string; safety: number } | null>(null);
  const [showTop, setShowTop] = useState(false);

  const scrollTo = useCallback<Motion['scrollTo']>((target, opts) => {
    if (lenis.current) lenis.current.scrollTo(target, { immediate: opts?.immediate, duration: 1.2 });
    else window.scrollTo({ top: typeof target === 'number' ? target : target.getBoundingClientRect().top + window.scrollY, behavior: opts?.immediate || reducedMotion() ? 'auto' : 'smooth' });
  }, []);

  // Smooth scrolling (not for visitors who turn animations off)
  useEffect(() => {
    if (reducedMotion()) return;
    const l = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      allowNestedScroll: true, // menus, dialogs and wide tables keep their own native scrolling
      prevent: (node) => node.hasAttribute?.('data-lenis-prevent'),
    });
    lenis.current = l;
    l.on('scroll', ScrollTrigger.update);
    const tick = (time: number) => l.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(tick);
      gsap.ticker.lagSmoothing(500, 33);
      l.destroy();
      lenis.current = null;
    };
  }, []);

  // Scroll progress line + back-to-top button
  useGSAP(() => {
    const st = ScrollTrigger.create({
      start: 0, end: 'max',
      onUpdate: (self) => {
        if (progress.current) gsap.set(progress.current, { scaleX: self.progress });
        setShowTop(self.scroll() > window.innerHeight * 0.9);
      },
    });
    return () => st.kill();
  });

  // Page exit: fade the current page away, then open the next one; a loading line runs meanwhile.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const url = panelLink(e);
      if (!url) return;
      e.preventDefault();
      const to = url.pathname + url.search + url.hash;
      if (leaving.current) return;
      const page = document.querySelector<HTMLElement>('[data-page]');
      lenis.current?.stop();
      if (loader.current) gsap.fromTo(loader.current, { scaleX: 0, autoAlpha: 1 }, { scaleX: 0.75, duration: 2.4, ease: 'power3.out' });
      const go = () => router.push(to);
      // If the next page never arrives (offline, server error), bring this one back.
      const safety = window.setTimeout(() => {
        leaving.current = null;
        lenis.current?.start();
        if (page) gsap.to(page, { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.3 });
        if (loader.current) gsap.to(loader.current, { autoAlpha: 0, duration: 0.3 });
      }, 8000);
      leaving.current = { to, safety };
      if (!page || reducedMotion()) { go(); return; }
      gsap.to(page, { autoAlpha: 0, y: -14, filter: 'blur(6px)', duration: 0.24, ease: 'power2.in', onComplete: go });
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [router]);

  // The next page has arrived
  useEffect(() => {
    const was = leaving.current;
    lenis.current?.start();
    if (was) {
      window.clearTimeout(was.safety);
      leaving.current = null;
      lenis.current?.scrollTo(0, { immediate: true, force: true });
      if (loader.current) gsap.to(loader.current, { scaleX: 1, duration: 0.25, ease: 'power2.out', onComplete: () => { gsap.to(loader.current, { autoAlpha: 0, duration: 0.3 }); } });
    }
    lenis.current?.resize();
    const id = requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  // Soft light that follows the pointer over cards (CSS reads --mx / --my); number tiles also tilt in 3D.
  useEffect(() => {
    if (!finePointer()) return;
    const tilt = !reducedMotion();
    let card: HTMLElement | null = null;
    let frame = 0;
    const settle = (el: HTMLElement | null) => {
      if (!el) return;
      el.style.removeProperty('--mx');
      el.style.removeProperty('--my');
      if (tilt && el.hasAttribute('data-tilt')) gsap.to(el, { rotationX: 0, rotationY: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.6)', overwrite: 'auto', clearProps: 'transform' });
    };
    const onMove = (e: PointerEvent) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const next = (e.target as Element | null)?.closest?.('.admin-card') as HTMLElement | null;
        if (next !== card) { settle(card); card = next; }
        if (!card) return;
        const r = card.getBoundingClientRect();
        const x = e.clientX - r.left, y = e.clientY - r.top;
        card.style.setProperty('--mx', `${x}px`);
        card.style.setProperty('--my', `${y}px`);
        if (tilt && card.hasAttribute('data-tilt')) {
          gsap.to(card, {
            rotationY: (x / r.width - 0.5) * 9, rotationX: -(y / r.height - 0.5) * 9, y: -3,
            transformPerspective: 900, duration: 0.5, ease: 'power3.out', overwrite: 'auto',
          });
        }
      });
    };
    const onLeave = () => { settle(card); card = null; };
    document.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <Ctx.Provider value={{ scrollTo }}>
      <div ref={loader} aria-hidden="true" className="no-print pointer-events-none fixed inset-x-0 top-0 z-[80] h-[3px] origin-left scale-x-0 bg-accent opacity-0 shadow-[0_0_12px_rgba(212,255,58,0.8)]" />
      {children}
      <div ref={progress} aria-hidden="true" data-scroll-progress className="no-print pointer-events-none fixed left-0 right-0 top-16 z-30 h-[2px] origin-left scale-x-0 bg-gradient-to-r from-accent via-lime-300 to-accent lg:left-[264px]" />
      <button
        type="button" onClick={() => scrollTo(0)} aria-label="Back to top" tabIndex={showTop ? 0 : -1}
        className={`no-print fixed bottom-6 right-6 z-40 grid h-11 w-11 place-items-center rounded-full bg-ink text-accent shadow-xl shadow-black/20 transition-all duration-500 ease-out hover:scale-105 ${showTop ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'}`}
      >
        <AdminIcon name="arrow-up" className="h-4 w-4" />
      </button>
    </Ctx.Provider>
  );
}
