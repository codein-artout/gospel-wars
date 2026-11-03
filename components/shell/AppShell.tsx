import Link from 'next/link';
import type { ReactNode } from 'react';
import { BottomTabs } from './BottomTabs';
import { SidebarNav } from './SidebarNav';
import { SignedInCard } from './SignedInCard';
import type { ShellUser } from './types';

/**
 * A 220px sidebar plus content at 768px and up. Below 768px pages render a PhoneTopBar,
 * and the shell adds the 72px bottom tab bar.
 */
export function AppShell({ user, children }: { user: ShellUser | null; children: ReactNode }) {
  return (
    <div className="min-h-screen md:grid md:grid-cols-[220px_minmax(0,1fr)]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-control focus:bg-gold focus:px-3 focus:py-2 focus:text-[color:var(--on-gold)]"
      >
        Skip to content
      </a>
      <div className="hidden border-r border-hairline bg-nave-deep md:block">
        <nav aria-label="Main" className="sticky top-0 flex h-screen flex-col gap-7 px-5 py-7">
          <Link
            href="/"
            className="font-display text-[34px] font-bold leading-none text-text no-underline hover:text-text"
          >
            Gospel Wars
          </Link>
          <SidebarNav isAdmin={user?.isAdmin ?? false} />
          <div className="mt-auto">
            <SignedInCard user={user} />
          </div>
        </nav>
      </div>
      <div id="main" className="min-w-0 pb-[88px] md:pb-0">
        {children}
      </div>
      <BottomTabs />
    </div>
  );
}
