'use client';

import { motion, useReducedMotion, useScroll, useTransform, type Variants } from 'framer-motion';
import { Fragment, useRef } from 'react';

export const EASE = [0.16, 1, 0.3, 1] as const;

/*
 * Reduced motion is handled once, app-wide, by <MotionProvider> (MotionConfig reducedMotion="user"):
 * for visitors who ask for less motion, movement is skipped and only opacity fades remain.
 */

/** Fades and lifts content in when it scrolls into view. */
export function Reveal({ children, delay = 0, y = 40, className, as = 'div' }: {
  children: React.ReactNode; delay?: number; y?: number; className?: string; as?: 'div' | 'li' | 'section' | 'p';
}) {
  const Tag = motion[as];
  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.9, ease: EASE, delay }}
    >
      {children}
    </Tag>
  );
}

const groupV: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const itemV: Variants = { hidden: { opacity: 0, y: 50 }, show: { opacity: 1, y: 0, transition: { duration: 0.9, ease: EASE } } };

/** Staggers its direct <StaggerItem> children as the group enters the viewport. */
export function Stagger({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={groupV} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.1 }}>
      {children}
    </motion.div>
  );
}
export function StaggerItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return <motion.div className={className} variants={itemV}>{children}</motion.div>;
}

const wordV: Variants = {
  hidden: { y: '110%' },
  show: (delay: number) => ({ y: '0%', transition: { duration: 1, ease: EASE, delay } }),
};

/**
 * Word-by-word masked headline reveal.
 * The heading itself watches the viewport (the words start hidden below their masks, where the
 * browser would never report them as visible) and passes the "show" state down to each word.
 */
export function SplitText({ text, className, as = 'h2', delay = 0, onMount = false }: {
  text: string; className?: string; as?: 'h1' | 'h2' | 'h3' | 'p'; delay?: number; onMount?: boolean;
}) {
  const Tag = motion[as];
  const lines = text.split('\n');
  let i = 0;
  return (
    <Tag
      className={className}
      initial="hidden"
      {...(onMount ? { animate: 'show' } : { whileInView: 'show', viewport: { once: true, amount: 0.3 } })}
    >
      {lines.map((line, li) => (
        <span key={li} className="block">
          {line.split(' ').map((word, wi) => {
            const idx = i++;
            return (
              <Fragment key={wi}>
                <span className="inline-block overflow-hidden pb-[0.04em] align-top">
                  <motion.span className="inline-block will-change-transform" variants={wordV} custom={delay + idx * 0.06}>
                    {word}
                  </motion.span>
                </span>
                {/* Real spaces keep the heading readable for screen readers, search engines and copy-paste */}
                {' '}
              </Fragment>
            );
          })}
        </span>
      ))}
    </Tag>
  );
}

const clipV: Variants = {
  hidden: { clipPath: 'inset(100% 0% 0% 0%)' },
  show: { clipPath: 'inset(0% 0% 0% 0%)', transition: { duration: 1.3, ease: EASE } },
};
const clipInstantV: Variants = { hidden: clipV.hidden, show: { clipPath: 'inset(0% 0% 0% 0%)', transition: { duration: 0 } } };
const zoomV: Variants = { hidden: { scale: 1.2 }, show: { scale: 1, transition: { duration: 1.6, ease: EASE } } };

/**
 * Image that wipes up into view with a slight zoom-out.
 * An unclipped wrapper watches the viewport (browsers treat a fully clipped element as invisible).
 */
export function ClipReveal({ children, className }: { children: React.ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div className={className} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }}>
      <motion.div className="h-full w-full" variants={reduce ? clipInstantV : clipV}>
        <motion.div className="h-full w-full" variants={zoomV}>{children}</motion.div>
      </motion.div>
    </motion.div>
  );
}

/** Moves its content slower than the page scroll (parallax). */
export function Parallax({ children, strength = 0.15, className }: { children: React.ReactNode; strength?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [`${-strength * 50}%`, `${strength * 50}%`]);
  return (
    // Positioned by the caller when it passes absolute/fixed; otherwise relative (needed for the inner layer).
    <div ref={ref} className={`overflow-hidden ${/\b(absolute|fixed)\b/.test(className ?? '') ? '' : 'relative'} ${className ?? ''}`}>
      <motion.div className="absolute inset-[-12%_0]" style={reduce ? undefined : { y }}>{children}</motion.div>
    </div>
  );
}
