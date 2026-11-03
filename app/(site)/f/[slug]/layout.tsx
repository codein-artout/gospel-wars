import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { getSessionUser } from '@/lib/auth/session';
import { db } from '@/lib/db/client';

/** Existence and visibility check above the loading boundary, so a missing faith is a real 404. */
export default async function FaithLayout({ children, params }: { children: ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const client = await db();
  const faith = await client.faith.findUnique({ where: { slug }, select: { hidden: true, prophetId: true } });
  if (!faith) notFound();
  if (faith.hidden) {
    const viewer = await getSessionUser();
    if (!viewer || (!viewer.isAdmin && viewer.id !== faith.prophetId)) notFound();
  }
  return children;
}
