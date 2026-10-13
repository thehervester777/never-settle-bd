'use client';

import { animate, useInView, useReducedMotion } from 'framer-motion';
import { useEffect, useRef } from 'react';

export type NumberFormat = 'bdt' | 'int' | 'pct' | 'ratio';

export function formatNumber(v: number, format: NumberFormat) {
  if (format === 'bdt') return `${v < 0 ? '−' : ''}৳${Math.round(Math.abs(v) / 100).toLocaleString('en-US')}`;
  if (format === 'pct') return `${(v * 100).toFixed(1)}%`;
  if (format === 'ratio') return `${v.toFixed(2)}×`;
  return Math.round(v).toLocaleString('en-US');
}

/** Counts up from zero when it scrolls into view. Money values are in poisha. */
export function AnimatedNumber({ value, format = 'int', className }: { value: number; format?: NumberFormat; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el || !inView) return;
    if (reduce) { el.textContent = formatNumber(value, format); return; }
    const controls = animate(0, value, { duration: 1.1, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => { el.textContent = formatNumber(v, format); } });
    return () => controls.stop();
  }, [value, format, inView, reduce]);
  return <span ref={ref} className={className}>{formatNumber(value, format)}</span>;
}
