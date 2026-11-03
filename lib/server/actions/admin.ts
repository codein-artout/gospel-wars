'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin, type SessionUser } from '@/lib/auth/session';
import { db, type Db } from '@/lib/db/client';
import type { Prisma } from '@/lib/db/generated/client';
import { replayEncounter, type ReplayResult } from '@/lib/engine/replay';
import { validateOverrides } from '@/lib/game/config';
import { LogSocialProvider } from '@/lib/social';
import { requireWorldId } from '@/lib/server/world';
import { guarded, type ActionResult } from './result';

const Id = z.string().min(1).max(80);

async function audit(client: Db, admin: SessionUser, action: string, targetType: string, targetId: string, data: Prisma.InputJsonValue = {}) {
  await client.adminAction.create({ data: { adminId: admin.id, action, targetType, targetId, data } });
}

function done(message: string): ActionResult {
  revalidatePath('/', 'layout');
  return { ok: true, message };
}

export async function adminReplay(encounterId: string): Promise<ActionResult<ReplayResult>> {
  return guarded(async () => {
    const admin = await requireAdmin();
    const id = Id.parse(encounterId.trim());
    const client = await db();
    const exists = await client.encounter.findUnique({ where: { id }, select: { id: true } });
    if (!exists) return { ok: false, error: 'No encounter with that id. Copy it from an encounter URL (/e/enc_…).' };
    const r = await replayEncounter(client, id);
    await audit(client, admin, 'replay_encounter', 'encounter', id, { identical: r.identical });
    return { ok: true, message: r.identical ? 'Identical. Same seed, same inputs, same result.' : `${r.differences.length} differences.`, data: r };
  });
}

export async function adminResolveReport(reportId: string, decision: 'dismiss' | 'uphold'): Promise<ActionResult> {
  return guarded(async () => {
    const admin = await requireAdmin();
    const id = Id.parse(reportId);
    const d = z.enum(['dismiss', 'uphold']).parse(decision);
    const client = await db();
    const report = await client.report.findUnique({ where: { id } });
    if (!report) return { ok: false, error: 'That report no longer exists.' };
    await client.report.update({ where: { id }, data: { status: d === 'uphold' ? 'resolved' : 'dismissed', resolvedById: admin.id, resolvedAt: new Date() } });
    if (report.faithId) {
      if (d === 'uphold') {
        await client.faith.update({ where: { id: report.faithId }, data: { hidden: true, hiddenReason: 'Hidden by an admin after a report' } });
      } else {
        // Dismissing the last open report lifts an automatic hide.
        const open = await client.report.count({ where: { faithId: report.faithId, status: 'open' } });
        const faith = await client.faith.findUnique({ where: { id: report.faithId }, select: { hiddenReason: true } });
        if (open === 0 && faith?.hiddenReason?.startsWith('Auto-hidden')) await client.faith.update({ where: { id: report.faithId }, data: { hidden: false, hiddenReason: null } });
      }
    }
    await audit(client, admin, `report_${d}`, 'report', id);
    return done(d === 'uphold' ? 'Report upheld. The faith is hidden.' : 'Report dismissed.');
  });
}

export async function adminSetFaithHidden(faithId: string, hidden: boolean): Promise<ActionResult> {
  return guarded(async () => {
    const admin = await requireAdmin();
    const id = Id.parse(faithId);
    const client = await db();
    await client.faith.update({ where: { id }, data: { hidden, hiddenReason: hidden ? 'Hidden by an admin' : null } });
    if (!hidden) await client.report.updateMany({ where: { faithId: id, status: 'open' }, data: { status: 'dismissed', resolvedById: admin.id, resolvedAt: new Date() } });
    await audit(client, admin, hidden ? 'hide_faith' : 'unhide_faith', 'faith', id);
    return done(hidden ? 'Faith hidden from public pages.' : 'Faith visible again.');
  });
}

export async function adminSetSilenced(faithId: string, silenced: boolean): Promise<ActionResult> {
  return guarded(async () => {
    const admin = await requireAdmin();
    const id = Id.parse(faithId);
    const client = await db();
    const w = await client.world.findUniqueOrThrow({ where: { id: await requireWorldId(client) }, select: { currentTick: true } });
    await client.faith.update({ where: { id }, data: { silenced, silencedAtTick: silenced ? w.currentTick : null } });
    await audit(client, admin, silenced ? 'silence_apostle' : 'unsilence_apostle', 'faith', id);
    return done(silenced ? 'Apostle silenced for the rest of the season.' : 'Apostle may preach again.');
  });
}

export async function adminSetBanned(userId: string, banned: boolean): Promise<ActionResult> {
  return guarded(async () => {
    const admin = await requireAdmin();
    const id = Id.parse(userId);
    if (id === admin.id) return { ok: false, error: 'You cannot ban yourself.' };
    const client = await db();
    await client.user.update({ where: { id }, data: { banned, bannedAt: banned ? new Date() : null } });
    await audit(client, admin, banned ? 'ban_user' : 'unban_user', 'user', id);
    return done(banned ? 'User banned. They are signed out on their next request.' : 'User unbanned.');
  });
}

/** Deletes a revision; a faith whose current revision is deleted falls back to the previous one. */
export async function adminDeleteRevision(revisionId: string): Promise<ActionResult> {
  return guarded(async () => {
    const admin = await requireAdmin();
    const id = Id.parse(revisionId);
    const client = await db();
    const rev = await client.gospelRevision.findUnique({ where: { id }, include: { faith: { select: { id: true, currentRevisionId: true } } } });
    if (!rev || rev.deletedAt) return { ok: false, error: 'That revision is already gone.' };
    const previous = await client.gospelRevision.findFirst({ where: { faithId: rev.faithId, deletedAt: null, id: { not: id }, number: { lt: rev.number } }, orderBy: { number: 'desc' } });
    if (!previous && rev.faith.currentRevisionId === id) return { ok: false, error: 'This is the only revision. Hide the faith instead.' };
    await client.$transaction([
      client.gospelRevision.update({ where: { id }, data: { deletedAt: new Date() } }),
      ...(rev.faith.currentRevisionId === id && previous ? [client.faith.update({ where: { id: rev.faithId }, data: { currentRevisionId: previous.id } })] : []),
    ]);
    await audit(client, admin, 'delete_revision', 'revision', id);
    return done(previous ? `Revision ${rev.number} deleted. The faith preaches revision ${previous.number}.` : `Revision ${rev.number} deleted.`);
  });
}

/** Approve sends the draft to the log provider (no real posting in v1); discard drops it. */
export async function adminReviewPost(postId: string, decision: 'approve' | 'discard'): Promise<ActionResult> {
  return guarded(async () => {
    const admin = await requireAdmin();
    const id = Id.parse(postId);
    const d = z.enum(['approve', 'discard']).parse(decision);
    const client = await db();
    const post = await client.draftPost.findUnique({ where: { id } });
    if (!post || post.status !== 'draft') return { ok: false, error: 'That post was already reviewed.' };
    if (d === 'discard') {
      await client.draftPost.update({ where: { id }, data: { status: 'discarded', reviewedById: admin.id, reviewedAt: new Date() } });
      await audit(client, admin, 'discard_post', 'post', id);
      return done('Post discarded.');
    }
    await client.draftPost.update({ where: { id }, data: { status: 'approved', reviewedById: admin.id, reviewedAt: new Date() } });
    const posted = await new LogSocialProvider(client).post({ id, authorName: post.authorName, text: post.text });
    await client.draftPost.update({ where: { id }, data: { status: 'posted', postedId: posted.id, postedUrl: posted.url } });
    await audit(client, admin, 'approve_post', 'post', id, { url: posted.url });
    return done('Post approved and written to the log. Real posting is off in v1.');
  });
}

/** Saves per-world config overrides after full zod validation. */
export async function adminSaveConfig(json: string): Promise<ActionResult> {
  return guarded(async () => {
    const admin = await requireAdmin();
    const text = z.string().max(100_000).parse(json);
    let parsed: unknown;
    try {
      parsed = text.trim() ? JSON.parse(text) : {};
    } catch (e) {
      return { ok: false, error: `That is not valid JSON: ${e instanceof Error ? e.message : 'parse error'}.` };
    }
    const v = validateOverrides(parsed);
    if (!v.ok) return { ok: false, error: 'The overrides do not validate.', problems: v.issues.map((i) => (i.path ? `${i.path}: ${i.message}` : i.message)) };
    const client = await db();
    const worldId = await requireWorldId(client);
    await client.world.update({ where: { id: worldId }, data: { configOverrides: parsed as Prisma.InputJsonValue } });
    await audit(client, admin, 'save_config', 'world', worldId, { keys: Object.keys(parsed as object) });
    return done('Config overrides saved. They apply from the next tick.');
  });
}

/** Wipes and rebuilds the demo world (140 ticks on the MockProvider). */
export async function adminReseed(confirm: string): Promise<ActionResult> {
  return guarded(async () => {
    const admin = await requireAdmin();
    if (confirm !== 'RESEED') return { ok: false, error: 'Type RESEED to confirm.' };
    const client = await db();
    const { seedDemoWorld } = await import('@/lib/seed/demo');
    await seedDemoWorld(client, () => undefined);
    // The admin's account is recreated by the seed only if it is a demo account; log against the new id when present.
    const again = await client.user.findUnique({ where: { email: admin.email } });
    if (again) await client.adminAction.create({ data: { adminId: again.id, action: 'reseed_world', targetType: 'world', targetId: 'nave' } });
    return done('World reseeded with 140 ticks of history.');
  });
}
