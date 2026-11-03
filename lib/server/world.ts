import type { Db } from '@/lib/db/client';

/** v1 runs one public world, chosen by GW_WORLD (default "nave"). */
export function worldSlug(): string {
  return process.env.GW_WORLD || 'nave';
}

export async function getWorldId(db: Db): Promise<string | null> {
  const w = await db.world.findUnique({ where: { slug: worldSlug() }, select: { id: true } });
  return w?.id ?? null;
}

export class NoWorldError extends Error {
  constructor() {
    super(`No world "${worldSlug()}" exists yet. Run pnpm db:migrate && pnpm db:seed.`);
  }
}

export async function requireWorldId(db: Db): Promise<string> {
  const id = await getWorldId(db);
  if (!id) throw new NoWorldError();
  return id;
}
