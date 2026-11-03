import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { db } from '@/lib/db/client';

/** An encounter or a chronicle event must exist (and not belong to a hidden faith) before the page streams. */
export default async function EncounterLayout({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await db();
  const [enc, ev] = await Promise.all([
    client.encounter.findUnique({ where: { id }, select: { faith: { select: { hidden: true } } } }),
    client.chronicleEvent.findUnique({ where: { id }, select: { faith: { select: { hidden: true } } } }),
  ]);
  const found = enc ?? ev;
  if (!found || found.faith?.hidden) notFound();
  return children;
}
