import type { ReactNode } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { ToastProvider } from '@/components/ui/Toast';
import { loadShellUser } from '@/lib/server/shell';

export default async function SiteLayout({ children }: { children: ReactNode }) {
  const user = await loadShellUser().catch(() => null);
  return (
    <ToastProvider>
      <AppShell user={user}>{children}</AppShell>
    </ToastProvider>
  );
}
