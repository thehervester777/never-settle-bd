'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { AdminIcon } from './AdminIcon';
import { Segmented } from './ui';
import { finePointer, gsap, reducedMotion, useGSAP } from './motion/gsap';

type Chip = { label: string; value: number; href: string; tone?: 'warn' };

const NOISE = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(t);
  }, []);
  if (!now) return null;
  return <>{now.toLocaleString('en-GB', { timeZone: 'Asia/Dhaka', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })}</>;
}

/**
 * The dashboard's opening scene: drifting light behind the greeting that follows the pointer a little,
 * and gives way as you scroll (ScrollTrigger scrub), with the key numbers floating over its edge.
 */
export function DashboardHero({ greeting, name, description, periods, current, chips }: {
  greeting: string; name: string; description: string; periods: { key: string; label: string; href: string }[]; current: string; chips: Chip[];
}) {
  const root = useRef<HTMLElement>(null);

  useGSAP(() => {
    if (reducedMotion()) return;
    const hero = root.current!;
    // Opening: the panel unfolds from a smaller frame and the light blooms.
    gsap.fromTo(hero, { clipPath: 'inset(6% 5% 22% 5% round 44px)' }, { clipPath: 'inset(0% 0% 0% 0% round 28px)', duration: 1.5, ease: 'expo.out', clearProps: 'clipPath' });
    gsap.from('[data-hero-tilt]', { opacity: 0, scale: 0.7, duration: 2.2, ease: 'expo.out' });
    // Light drifting on its own; each loop picks a new direction.
    const drift = gsap.utils.toArray<HTMLElement>('[data-blob]').map((b, i) => gsap.to(b, {
      x: () => gsap.utils.random(-90, 90), y: () => gsap.utils.random(-50, 50), scale: () => gsap.utils.random(0.85, 1.25),
      duration: 7 + i * 1.7, ease: 'sine.inOut', repeat: -1, yoyo: true, repeatRefresh: true,
    }));

    // Scrolling away: the greeting lifts and fades, the light sinks slower behind it (parallax).
    gsap.timeline({
      scrollTrigger: {
        trigger: hero, start: 'top top+=64', end: 'bottom top+=64', scrub: 0.7,
        onToggle: (self) => drift.forEach((d) => (self.isActive || self.progress < 1 ? d.resume() : d.pause())),
      },
    })
      .to('[data-hero-content]', { y: -80, opacity: 0.1, ease: 'none' }, 0)
      .to('[data-hero-light]', { y: 120, scale: 1.18, ease: 'none' }, 0)
      .to('[data-hero-grid]', { y: 40, opacity: 0.2, ease: 'none' }, 0);

    if (!finePointer()) return;
    // The light leans towards the pointer.
    const lx = gsap.quickTo('[data-hero-tilt]', 'x', { duration: 1.2, ease: 'power3' });
    const ly = gsap.quickTo('[data-hero-tilt]', 'y', { duration: 1.2, ease: 'power3' });
    const onMove = (e: PointerEvent) => {
      const r = hero.getBoundingClientRect();
      lx(((e.clientX - r.left) / r.width - 0.5) * 70);
      ly(((e.clientY - r.top) / r.height - 0.5) * 50);
    };
    const onLeave = () => { lx(0); ly(0); };
    hero.addEventListener('pointermove', onMove);
    hero.addEventListener('pointerleave', onLeave);
    return () => { hero.removeEventListener('pointermove', onMove); hero.removeEventListener('pointerleave', onLeave); };
  }, { scope: root });

  return (
    <section ref={root} data-page-head className="relative isolate mb-0 overflow-hidden rounded-[24px] bg-[#0b0b0c] px-5 pb-[5.5rem] pt-5 text-white sm:rounded-[28px] sm:px-6 md:px-10 md:pb-28 md:pt-9">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div data-hero-light className="absolute inset-0">
          <div data-hero-tilt className="absolute inset-0">
            <div data-blob className="absolute -left-[12%] -top-[45%] h-[460px] w-[460px] rounded-full bg-[radial-gradient(circle,rgba(212,255,58,0.55),transparent_62%)] opacity-80 blur-2xl" />
            <div data-blob className="absolute -right-[8%] -top-[10%] h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(42,120,214,0.6),transparent_62%)] opacity-80 blur-2xl" />
            <div data-blob className="absolute -bottom-[60%] left-[30%] h-[440px] w-[440px] rounded-full bg-[radial-gradient(circle,rgba(235,104,52,0.45),transparent_62%)] opacity-70 blur-2xl" />
          </div>
        </div>
        <div data-hero-grid className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(ellipse_at_30%_40%,black_20%,transparent_70%)]" />
        <div className="absolute inset-0 opacity-[0.09] mix-blend-overlay" style={{ backgroundImage: NOISE }} />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/50 to-transparent" />
      </div>

      <div data-hero-content className="relative">
        <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
          <p data-page-sub className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[0.7rem] font-medium uppercase tracking-[0.18em] text-white/70 backdrop-blur">
            <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-accent" /></span>
            Live · <Clock />
          </p>
          <div data-page-sub><Segmented tone="dark" current={current} items={periods} /></div>
        </div>
        <h1 data-page-title className="mt-6 max-w-4xl text-[2.1rem] font-semibold leading-[1.02] tracking-[-0.035em] sm:mt-8 sm:text-5xl md:text-6xl">
          {greeting}, <span className="text-accent">{name}</span>
        </h1>
        <p data-page-sub className="mt-3 max-w-xl text-sm text-white/60 sm:mt-4 md:text-base">{description}</p>
        {chips.length > 0 && (
          <div data-page-sub className="mt-5 flex flex-wrap gap-1.5 sm:mt-6 sm:gap-2">
            {chips.map((c) => (
              <Link key={c.label} href={c.href}
                className={`group inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs backdrop-blur transition hover:-translate-y-0.5 sm:gap-2 sm:px-3.5 sm:py-1.5 sm:text-sm ${c.tone === 'warn' && c.value > 0 ? 'border-amber-300/30 bg-amber-300/10 text-amber-100 hover:bg-amber-300/20' : 'border-white/10 bg-white/[0.06] text-white/80 hover:bg-white/[0.12]'}`}>
                <span className="font-semibold tabular text-white">{c.value}</span> {c.label}
                <AdminIcon name="chevron" className="h-3.5 w-3.5 opacity-50 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
