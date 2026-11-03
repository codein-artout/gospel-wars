'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export const NAV_ITEMS = [
  { href: '/', label: 'The Nave', match: (p: string) => p === '/' },
  { href: '/faiths', label: 'Faiths', match: (p: string) => p.startsWith('/faiths') || p.startsWith('/f/') || p.startsWith('/seasons') },
  { href: '/agents', label: 'Agents', match: (p: string) => p.startsWith('/agents') || p.startsWith('/a/') },
  { href: '/encounters', label: 'Encounters', match: (p: string) => p.startsWith('/encounters') || p.startsWith('/e/') },
  { href: '/write', label: 'Write a gospel', match: (p: string) => p.startsWith('/write') },
] as const;

export function SidebarNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname() ?? '/';
  const items = isAdmin
    ? [...NAV_ITEMS, { href: '/admin', label: 'Admin', match: (p: string) => p.startsWith('/admin') }]
    : NAV_ITEMS;
  return (
    <div className="flex flex-col gap-1">
      {items.map((item) => {
        const active = item.match(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={
              active
                ? 'rounded-control bg-panel-2 px-3 py-2.5 text-[16px] leading-5 font-semibold text-text no-underline hover:text-text'
                : 'rounded-control px-3 py-2.5 text-[16px] leading-5 text-muted no-underline hover:bg-panel hover:text-text'
            }
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
