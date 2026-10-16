'use client';

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { useGSAP } from '@gsap/react';

/*
 * GSAP for the admin panel. Plugins are registered once, in the browser only.
 * Everything animated here also has a calm path for people who turn animations off in their
 * device settings (prefers-reduced-motion): no smooth scrolling, no movement, only quick fades.
 */
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger, SplitText, useGSAP);
  gsap.defaults({ ease: 'expo.out', duration: 0.8 });
  ScrollTrigger.config({ ignoreMobileResize: true });
}

export const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const finePointer = () => typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

export { gsap, ScrollTrigger, SplitText, useGSAP };
