'use client';

import { useEffect, useRef } from 'react';

/** Scales a single line of text to exactly fill its container's width. */
export function FitText({ children, className }: { children: React.ReactNode; className?: string }) {
  const box = useRef<HTMLParagraphElement>(null);
  const text = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = box.current!;
    const span = text.current!;
    const fit = () => {
      el.style.fontSize = '100px';
      const cs = getComputedStyle(el);
      const avail = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const natural = span.getBoundingClientRect().width; // width of the words at 100px
      if (natural > 0 && avail > 0) el.style.fontSize = `${Math.floor(((100 * avail) / natural) * 0.995 * 100) / 100}px`;
    };
    fit();
    document.fonts?.ready.then(fit);
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <p ref={box} className={className} style={{ fontSize: '14vw', whiteSpace: 'nowrap' }}>
      <span ref={text} className="inline-block">{children}</span>
    </p>
  );
}
