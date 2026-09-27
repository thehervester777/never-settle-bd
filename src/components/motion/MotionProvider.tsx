'use client';

import { MotionConfig } from 'framer-motion';

/** Respects the visitor's "reduce motion" setting everywhere: movement is skipped, fades remain. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
