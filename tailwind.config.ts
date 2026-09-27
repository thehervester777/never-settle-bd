import type { Config } from 'tailwindcss';
import forms from '@tailwindcss/forms';

const withAlpha = (v: string) => `rgb(var(${v}) / <alpha-value>)`;

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: withAlpha('--color-ink'),
        paper: withAlpha('--color-paper'),
        bone: withAlpha('--color-bone'),
        accent: withAlpha('--color-accent'),
        muted: withAlpha('--color-muted'),
        sale: withAlpha('--color-sale'),
      },
      fontFamily: {
        display: ['var(--font-display)', 'Impact', 'sans-serif'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'display-xl': ['clamp(3.5rem, 13vw, 13rem)', { lineHeight: '0.86', letterSpacing: '-0.01em' }],
        'display-lg': ['clamp(2.75rem, 8vw, 7.5rem)', { lineHeight: '0.9' }],
        'display-md': ['clamp(2rem, 5vw, 4.5rem)', { lineHeight: '0.95' }],
        'display-sm': ['clamp(1.6rem, 3vw, 2.5rem)', { lineHeight: '1' }],
      },
      letterSpacing: { widest2: '0.25em' },
      transitionTimingFunction: { expo: 'cubic-bezier(0.16, 1, 0.3, 1)' },
      keyframes: {
        marquee: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
      },
      animation: { marquee: 'marquee var(--marquee-speed, 35s) linear infinite' },
    },
  },
  // .container is defined in globals.css (fluid up to 1600px with responsive gutters)
  corePlugins: { container: false },
  plugins: [forms({ strategy: 'class' })],
};

export default config;
