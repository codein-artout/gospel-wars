import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { db } from '@/lib/db/client';

export default async function AgentLayout({ children, params }: { children: ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const client = await db();
  if (!(await client.agent.findUnique({ where: { slug }, select: { id: true } }))) notFound();
  return children;
}
