'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/', label: 'Nave', match: (p: string) => p === '/' || p.startsWith('/a/') || p.startsWith('/agents') },
  { href: '/faiths', label: 'Faiths', match: (p: string) => p.startsWith('/faiths') || p.startsWith('/f/') || p.startsWith('/seasons') },
  { href: '/encounters', label: 'Encounters', match: (p: string) => p.startsWith('/encounters') || p.startsWith('/e/') },
  { href: '/write', label: 'Write', match: (p: string) => p.startsWith('/write') },
] as const;

export function BottomTabs() {
  const pathname = usePathname() ?? '/';
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 grid h-[72px] grid-cols-4 border-t border-hairline bg-nave-deep px-2 pb-2 md:hidden"
    >
      {TABS.map((tab) => {
        const active = tab.match(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={
              active
                ? 'flex items-center justify-center border-t-[3px] border-gold text-[13px] font-bold text-text no-underline hover:text-text'
                : 'flex items-center justify-center border-t-[3px] border-transparent text-[13px] text-muted no-underline hover:text-text'
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
