import type { ReactNode } from 'react';

/** Shades of the faith's glass for the hero band, in the mockup's rhythm (base, dark, light, darkest, …). */
const RHYTHM = ['base', 'dark', 'light', 'darkest', 'base', 'mid', 'light', 'dark', 'base', 'darkest', 'mid', 'light', 'base', 'dark', 'mid', 'darkest', 'light', 'base'] as const;
const SHADE: Record<(typeof RHYTHM)[number], (c: string) => string> = {
  base: (c) => c,
  dark: (c) => `color-mix(in srgb, ${c} 78%, black)`,
  light: (c) => `color-mix(in srgb, ${c} 72%, white)`,
  darkest: (c) => `color-mix(in srgb, ${c} 60%, black)`,
  mid: (c) => `color-mix(in srgb, ${c} 90%, black)`,
};

/** Full-width glass band: faith-colored lancets at 55% under a dark scrim. */
export function GlassBandHero({ color, children }: { color: string; children: ReactNode }) {
  return (
    <header className="relative overflow-hidden px-4 pb-6 pt-5 md:px-9 md:pb-8 md:pt-10" style={{ borderBottom: '3px solid var(--lead)', background: `color-mix(in srgb, ${color} 16%, #120c10)` }}>
      <div aria-hidden="true" className="absolute inset-0 grid grid-cols-8 gap-1 p-1 md:grid-cols-[repeat(18,minmax(0,1fr))]" style={{ opacity: 0.55 }}>
        {RHYTHM.map((s, i) => (
          <span key={i} className={i >= 8 ? 'max-md:hidden' : undefined} style={{ background: SHADE[s](color), borderRadius: 'var(--lancet-sm)' }} />
        ))}
      </div>
      <div aria-hidden="true" className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgb(25 20 48 / 0.35), rgb(25 20 48 / 0.92) 70%)' }} />
      <div className="relative">{children}</div>
    </header>
  );
}
