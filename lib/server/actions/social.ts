'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireUser } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { Prisma } from '@/lib/db/generated/client';
import { resolveConfig } from '@/lib/game/config';
import { checkRateLimit } from '@/lib/server/rate-limit';
import { requireWorldId } from '@/lib/server/world';
import { guarded, type ActionResult } from './result';

const FollowInput = z.object({ faithId: z.string().min(1).max(64) });

/** Follow or unfollow a faith (a vanity count, no game effect). */
export async function toggleFollow(input: z.infer<typeof FollowInput>): Promise<ActionResult<{ following: boolean }>> {
  return guarded(async () => {
    const user = await requireUser('follow a faith');
    const { faithId } = FollowInput.parse(input);
    const client = await db();
    const worldId = await requireWorldId(client);
    const world = await client.world.findUniqueOrThrow({ where: { id: worldId }, select: { configOverrides: true } });
    const faith = await client.faith.findUnique({ where: { id: faithId }, select: { slug: true, hidden: true, name: true } });
    if (!faith || faith.hidden) return { ok: false, error: 'That faith is not available.' };
    const limit = await checkRateLimit(client, user.id, 'follow', resolveConfig(world.configOverrides).followRateLimit);
    if (!limit.ok) return { ok: false, error: limit.message };
    const existing = await client.follow.findUnique({ where: { userId_faithId: { userId: user.id, faithId } } });
    if (existing) await client.follow.delete({ where: { userId_faithId: { userId: user.id, faithId } } });
    else await client.follow.create({ data: { userId: user.id, faithId } });
    revalidatePath(`/f/${faith.slug}`);
    return { ok: true, message: existing ? `Unfollowed ${faith.name}.` : `Following ${faith.name}.`, data: { following: !existing } };
  });
}

const ReportInput = z.object({
  targetType: z.enum(['faith', 'revision', 'encounter', 'post', 'card']),
  targetId: z.string().min(1).max(64),
  reason: z.enum(['real_religion_or_person', 'hateful', 'sexual', 'spam', 'other']),
  note: z.string().trim().max(500).optional(),
});
export type ReportInput = z.infer<typeof ReportInput>;

/** Resolves which faith reported content belongs to (drives auto-hide). */
async function faithOf(client: Awaited<ReturnType<typeof db>>, type: ReportInput['targetType'], id: string): Promise<string | null> {
  switch (type) {
    case 'faith':
      return (await client.faith.findUnique({ where: { id }, select: { id: true } }))?.id ?? null;
    case 'revision':
      return (await client.gospelRevision.findUnique({ where: { id }, select: { faithId: true } }))?.faithId ?? null;
    case 'encounter':
      return (await client.encounter.findUnique({ where: { id }, select: { faithId: true } }))?.faithId ?? null;
    case 'post': {
      const p = await client.draftPost.findUnique({ where: { id }, select: { event: { select: { faithId: true } }, encounter: { select: { faithId: true } } } });
      return p?.event?.faithId ?? p?.encounter?.faithId ?? null;
    }
    case 'card': {
      const c = await client.conversionCard.findUnique({ where: { id }, select: { event: { select: { faithId: true } } } });
      return c?.event.faithId ?? null;
    }
  }
}

/**
 * Report content to the admin queue. A faith with reportHideThreshold unique open reports is
 * auto-hidden from public pages (its apostle keeps preaching) until an admin resolves it.
 */
export async function reportContent(input: ReportInput): Promise<ActionResult> {
  return guarded(async () => {
    const user = await requireUser('report');
    const data = ReportInput.parse(input);
    const client = await db();
    const worldId = await requireWorldId(client);
    const config = resolveConfig((await client.world.findUniqueOrThrow({ where: { id: worldId }, select: { configOverrides: true } })).configOverrides);
    const faithId = await faithOf(client, data.targetType, data.targetId);
    if (!faithId) return { ok: false, error: 'That content no longer exists.' };
    const limit = await checkRateLimit(client, user.id, 'report', config.reportRateLimit);
    if (!limit.ok) return { ok: false, error: limit.message };
    try {
      await client.report.create({ data: { reporterId: user.id, targetType: data.targetType, targetId: data.targetId, faithId, reason: data.reason, note: data.note || null } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return { ok: false, error: 'You already reported this. An admin will look at it.' };
      throw e;
    }
    const reporters = await client.report.findMany({ where: { faithId, status: 'open' }, distinct: ['reporterId'], select: { reporterId: true } });
    if (reporters.length >= config.reportHideThreshold) {
      await client.faith.update({ where: { id: faithId }, data: { hidden: true, hiddenReason: `Auto-hidden after ${reporters.length} reports` } });
    }
    revalidatePath('/', 'layout');
    return { ok: true, message: 'Report sent. An admin will review it.' };
  });
}
