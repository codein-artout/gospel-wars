import { notFound, redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { getSessionUser } from '@/lib/auth/session';

/** Admins only. Others get a real 404: the console is not advertised. */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/signin?callbackUrl=/admin');
  if (!user.isAdmin) notFound();
  return children;
}
