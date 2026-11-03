import type { ReactNode } from 'react';

/** 3px gold border, gothic headline, actions. The headline fades in once on load. */
export function OutcomeBanner({ headline, tone = 'gold', children }: { headline: string; tone?: 'gold' | 'heresy' | 'quiet'; children?: ReactNode }) {
  const border = tone === 'heresy' ? 'var(--heresy)' : tone === 'quiet' ? 'var(--edge-quiet)' : 'var(--gold)';
  const color = tone === 'heresy' ? 'var(--heresy-text)' : tone === 'quiet' ? 'var(--text)' : 'var(--gold-bright)';
  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-panel px-[22px] py-[18px] max-md:flex-col max-md:items-stretch"
      style={{ border: `3px solid ${border}`, background: 'var(--outcome-bg)' }}
    >
      <span className="reveal-once font-display text-[28px] font-bold leading-[1.05] md:text-[34px]" style={{ color }}>
        {headline}
      </span>
      {children ? <div className="flex flex-wrap gap-3 max-md:flex-col">{children}</div> : null}
    </div>
  );
}
