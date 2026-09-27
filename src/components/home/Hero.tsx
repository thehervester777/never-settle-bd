'use client';

import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { EASE } from '@/components/motion/Reveal';

export type Slide = { image: string; eyebrow: string; heading: string; text: string; cta: { label: string; href: string }; cta2?: { label: string; href: string } };

const SPEED = 6000;

export function Hero({ slides }: { slides: Slide[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduce = useReducedMotion();
  const touchX = useRef<number | null>(null);
  const go = useCallback((n: number) => setIndex((n + slides.length) % slides.length), [slides.length]);

  useEffect(() => {
    // No auto-advancing slideshow for visitors who ask for reduced motion
    if (paused || reduce || slides.length < 2) return;
    const t = setTimeout(() => go(index + 1), SPEED);
    return () => clearTimeout(t);
  }, [index, paused, reduce, go, slides.length]);

  const s = slides[index];
  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <section
      className="relative h-[calc(100svh-2.25rem)] min-h-[560px] overflow-hidden bg-ink text-paper"
      aria-roledescription="carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touchX.current == null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 50) go(index + (dx < 0 ? 1 : -1));
        touchX.current = null;
      }}
    >
      <AnimatePresence initial={false}>
        <motion.div key={index} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1, ease: EASE }}>
          <motion.img
            src={s.image}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            initial={{ scale: 1.12 }}
            animate={{ scale: 1 }}
            transition={{ duration: 7, ease: EASE }}
            fetchPriority={index === 0 ? 'high' : 'auto'}
          />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgb(0 0 0 / .25) 0%, transparent 30%, transparent 45%, rgb(0 0 0 / .55) 100%)' }} />
        </motion.div>
      </AnimatePresence>

      <div className="container relative flex h-full items-end pb-28 pt-28">
        <div key={index} className="max-w-5xl">
          <motion.p className="eyebrow mb-5 inline-flex items-center gap-3" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: EASE, delay: 0.55 }}>
            <span className="inline-block h-2 w-2 rounded-full bg-accent" />{s.eyebrow}
          </motion.p>
          <h1 className="font-display text-display-xl uppercase" aria-label={s.heading.replace('\n', ' ')}>
            {s.heading.split('\n').map((line, li) => (
              <span key={li} className="block overflow-hidden pb-[0.04em]" aria-hidden="true">
                <motion.span className="block" initial={{ y: '110%' }} animate={{ y: '0%' }} transition={{ duration: 1, ease: EASE, delay: 0.25 + li * 0.08 }}>
                  {line}
                </motion.span>
              </span>
            ))}
          </h1>
          <motion.p className="mt-6 max-w-md text-base text-paper/85 md:text-lg" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: EASE, delay: 0.65 }}>
            {s.text}
          </motion.p>
          <motion.div className="mt-8 flex flex-wrap gap-3" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: EASE, delay: 0.75 }}>
            <Link href={s.cta.href} className="btn btn-accent px-5 sm:px-7">{s.cta.label} <Icon name="arrow-right" className="h-4 w-4" /></Link>
            {s.cta2 && <Link href={s.cta2.href} className="btn btn-outline px-5 text-paper hover:border-paper sm:px-7">{s.cta2.label}</Link>}
          </motion.div>
        </div>
      </div>

      {slides.length > 1 && (
        <div className="container absolute inset-x-0 bottom-6 flex items-center justify-between gap-6">
          <div className="flex flex-1 items-center gap-2" role="tablist">
            {slides.map((_, i) => (
              <button key={i} role="tab" aria-selected={i === index} aria-label={`Go to slide ${i + 1}`} onClick={() => go(i)} className="relative h-8 max-w-[7rem] flex-1">
                <span className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 bg-paper/30" />
                <motion.span
                  key={`${i}-${index}-${paused}`}
                  className="absolute inset-x-0 top-1/2 h-[2px] origin-left -translate-y-1/2 bg-paper"
                  initial={{ scaleX: i < index ? 1 : 0 }}
                  animate={{ scaleX: i < index ? 1 : i === index && !paused ? 1 : 0 }}
                  transition={{ duration: i === index && !paused ? SPEED / 1000 : 0, ease: 'linear' }}
                />
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <span className="mr-3 font-display text-lg tabular-nums">{pad(index + 1)} / {pad(slides.length)}</span>
            <button onClick={() => go(index - 1)} className="grid h-11 w-11 place-items-center border border-paper/40 transition-colors hover:bg-paper hover:text-ink" aria-label="Previous slide"><Icon name="arrow-left" className="h-4 w-4" /></button>
            <button onClick={() => go(index + 1)} className="grid h-11 w-11 place-items-center border border-paper/40 transition-colors hover:bg-paper hover:text-ink" aria-label="Next slide"><Icon name="arrow-right" className="h-4 w-4" /></button>
          </div>
        </div>
      )}
    </section>
  );
}
