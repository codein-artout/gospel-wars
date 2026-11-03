import Link from 'next/link';
import type { ReactNode } from 'react';

type Props =
  | { back?: undefined; title?: undefined; action?: ReactNode }
  | { back: { href: string; label: string }; title?: string; action?: ReactNode };

/** The 60px phone top bar: wordmark and one action, or a back link and a title. Hidden at 768px and up. */
export function PhoneTopBar(props: Props) {
  return (
    <header className="sticky top-0 z-30 flex h-[60px] items-center justify-between gap-3 border-b border-hairline bg-nave-deep px-4 md:hidden">
      {props.back ? (
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={props.back.href}
            aria-label={`Back to ${props.back.label}`}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-control text-text"
          >
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <span className="truncate text-[15px] font-semibold">{props.title ?? props.back.label}</span>
        </div>
      ) : (
        <Link href="/" className="font-display text-[28px] font-bold leading-none text-text no-underline hover:text-text">
          Gospel Wars
        </Link>
      )}
      {props.action}
    </header>
  );
}
