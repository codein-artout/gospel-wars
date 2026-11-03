'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { runTick } from '@/lib/engine';
import { tickHeadline } from '@/lib/engine/describe';
import { resolveConfig } from '@/lib/game/config';
import { checkRateLimit } from '@/lib/server/rate-limit';
import { requireWorldId } from '@/lib/server/world';
import { guarded, type ActionResult } from './result';

const N = z.number().int().min(1).max(50);

/** Admin: advance the world one tick, or N ticks. Same runTick as the cron and the CLI. */
export async function advanceTicks(n: number = 1): Promise<ActionResult<{ tick: number; conversions: number }>> {
  return guarded(async () => {
    const admin = await requireAdmin();
    const count = N.parse(n);
    const client = await db();
    const worldId = await requireWorldId(client);
    const world = await client.world.findUniqueOrThrow({ where: { id: worldId }, select: { configOverrides: true } });
    const config = resolveConfig(world.configOverrides);
    const limit = await checkRateLimit(client, admin.id, 'tick', config.tickRateLimit);
    if (!limit.ok) return { ok: false, error: limit.message };
    let last = null;
    let conversions = 0;
    for (let i = 0; i < count; i++) {
      last = await runTick(client, worldId);
      if (last.status !== 'done') break;
      conversions += last.conversions;
    }
    await client.adminAction.create({ data: { adminId: admin.id, action: 'advance_tick', targetType: 'world', targetId: worldId, data: { n: count, tick: last?.tick ?? null } } });
    revalidatePath('/', 'layout');
    if (!last) return { ok: false, error: 'No tick ran.' };
    const message = count === 1 || last.status !== 'done' ? tickHeadline(last) : `Ran ${count} ticks to tick ${last.tick}. ${conversions} ${conversions === 1 ? 'conversion' : 'conversions'}.`;
    return last.status === 'done' ? { ok: true, message, data: { tick: last.tick, conversions } } : { ok: false, error: message };
  });
}
