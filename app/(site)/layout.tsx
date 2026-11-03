import type { ReactNode } from 'react';
import { AppShell } from '@/components/shell/AppShell';

export default async function SiteLayout({ children }: { children: ReactNode }) {
  return <AppShell user={null}>{children}</AppShell>;
}
