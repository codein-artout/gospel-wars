import type { ReactNode } from 'react';

/** Meta line in --faint 14px, gothic 56px title, actions on the right (wrapping below on narrow widths). */
export function PageHeader({ meta, title, actions, titleId }: { meta?: ReactNode; title: string; actions?: ReactNode; titleId?: string }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="flex min-w-0 flex-col gap-1 md:gap-1.5">
        {meta ? <span className="text-[13px] text-faint md:text-[14px]">{meta}</span> : null}
        <h1 id={titleId} className="m-0 font-display text-[44px] font-bold leading-none md:text-[56px]">
          {title}
        </h1>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </header>
  );
}
