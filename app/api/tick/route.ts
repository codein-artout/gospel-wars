import { db } from '@/lib/db/client';
import { worldSlug } from '@/lib/server/world';

export const dynamic = 'force-dynamic';

/** Lightweight poll target for the Nave: the current tick only. */
export async function GET(): Promise<Response> {
  try {
    const client = await db();
    const w = await client.world.findUnique({ where: { slug: worldSlug() }, select: { currentTick: true, updatedAt: true } });
    return Response.json({ tick: w?.currentTick ?? 0, updatedAt: w?.updatedAt ?? null }, { headers: { 'cache-control': 'no-store' } });
  } catch {
    return Response.json({ tick: 0, updatedAt: null, error: 'unavailable' }, { status: 503, headers: { 'cache-control': 'no-store' } });
  }
}
