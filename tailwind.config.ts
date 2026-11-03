import type { Config } from 'tailwindcss';

// Tokens live as CSS variables in app/globals.css (DESIGN.md). This file maps them for utilities.
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        nave: { DEFAULT: 'var(--nave)', deep: 'var(--nave-deep)', well: 'var(--nave-well)' },
        panel: { DEFAULT: 'var(--panel)', 2: 'var(--panel-2)' },
        hairline: 'var(--hairline)',
        edge: 'var(--edge)',
        lead: 'var(--lead)',
        text: { DEFAULT: 'var(--text)', 2: 'var(--text-2)' },
        muted: 'var(--muted)',
        faint: 'var(--faint)',
        gold: { DEFAULT: 'var(--gold)', bright: 'var(--gold-bright)' },
        vellum: 'var(--vellum)',
        ink: 'var(--ink)',
        heresy: { DEFAULT: 'var(--heresy)', text: 'var(--heresy-text)', bg: 'var(--heresy-bg)' },
        grace: { DEFAULT: 'var(--grace)', bg: 'var(--grace-bg)' },
        pewter: 'var(--glass-unaligned)',
      },
      fontFamily: {
        display: ['var(--font-display)'],
        sans: ['var(--font-sans)'],
        scripture: ['var(--font-scripture)'],
        mono: ['var(--font-mono)'],
      },
      borderRadius: {
        lancet: '999px 999px 3px 3px',
        arch: '160px 160px 6px 6px',
        'arch-sm': '120px 120px 6px 6px',
        panel: '6px',
        control: '4px',
      },
    },
  },
};

export default config;
