import type { ReactNode } from 'react';

/** A sermon turn on vellum with a lead border. */
export function SermonBlock({ who, color, children }: { who: string; color: string; children: ReactNode }) {
  return (
    <div className="rounded-control px-5 py-4" style={{ background: 'var(--vellum)', color: 'var(--ink)', border: '3px solid var(--lead)' }}>
      <span className="font-sans text-[13px] font-semibold" style={{ color: `color-mix(in srgb, ${color} 42%, var(--ink))` }}>
        {who}
      </span>
      <p className="m-0 mt-1.5 font-scripture text-[18px] leading-[1.65]">{children}</p>
    </div>
  );
}

/** An agent's reply on a panel, indented 48px (16px on phone). */
export function ReplyBlock({ who, children }: { who: string; children: ReactNode }) {
  return (
    <div className="ml-7 rounded-control border border-edge px-5 py-4 md:ml-12" style={{ background: 'var(--panel-3)' }}>
      <span className="font-sans text-[13px] font-semibold text-gold">{who}</span>
      <p className="m-0 mt-1.5 font-scripture text-[18px] leading-[1.65] text-text">{children}</p>
    </div>
  );
}
