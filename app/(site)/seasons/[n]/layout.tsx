import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { db } from '@/lib/db/client';
import { worldSlug } from '@/lib/server/world';

export default async function SeasonLayout({ children, params }: { children: ReactNode; params: Promise<{ n: string }> }) {
  const { n } = await params;
  const number = Number(n);
  if (!Number.isInteger(number) || number < 1) notFound();
  const client = await db();
  const world = await client.world.findUnique({ where: { slug: worldSlug() }, select: { id: true } });
  if (!world || !(await client.season.findUnique({ where: { worldId_number: { worldId: world.id, number } }, select: { id: true } }))) notFound();
  return children;
}
