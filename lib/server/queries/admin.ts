import { db } from '@/lib/db/client';
import { loadWorldHeader } from './common';

/** Everything the admin console shows, in a fixed number of queries. */
export async function loadAdmin(q: string | undefined) {
  const client = await db();
  const header = await loadWorldHeader(client);
  if (!header) return null;
  const worldId = header.id;
  const search = q?.trim();
  const [world, runs, reports, posts, postCounts, faiths, users, actions, recent] = await Promise.all([
    client.world.findUniqueOrThrow({ where: { id: worldId }, select: { configOverrides: true } }),
    client.tickRun.findMany({ where: { worldId }, orderBy: { tick: 'desc' }, take: 8 }),
    client.report.findMany({
      where: { status: 'open' },
      orderBy: { createdAt: 'asc' },
      take: 50,
      include: { reporter: { select: { handle: true } }, faith: { select: { name: true, slug: true, hidden: true } } },
    }),
    client.draftPost.findMany({ where: { worldId, status: 'draft' }, orderBy: { createdAt: 'desc' }, take: 25, include: { event: { select: { text: true, tick: true } } } }),
    client.draftPost.groupBy({ by: ['status'], where: { worldId }, _count: { _all: true } }),
    client.faith.findMany({
      where: { worldId },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
      include: { prophet: { select: { handle: true } }, revisions: { where: { deletedAt: null }, orderBy: { number: 'desc' }, select: { id: true, number: true, createdAtTick: true } }, _count: { select: { reports: { where: { status: 'open' } } } } },
    }),
    client.user.findMany({
      where: search ? { OR: [{ handle: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }] } : {},
      orderBy: { createdAt: 'desc' },
      take: 25,
      select: { id: true, handle: true, email: true, banned: true, createdAt: true },
    }),
    client.adminAction.findMany({ orderBy: { createdAt: 'desc' }, take: 12, include: { admin: { select: { handle: true } } } }),
    client.encounter.findMany({ where: { worldId }, orderBy: [{ tick: 'desc' }, { index: 'asc' }], take: 6, select: { id: true, tick: true, index: true, preacherName: true, target: { select: { name: true } } } }),
  ]);
  return {
    header,
    overrides: JSON.stringify(world.configOverrides ?? {}, null, 2),
    runs: runs.map((r) => ({ tick: r.tick, status: r.status, llmCalls: r.llmCalls, fallbacks: r.fallbacks, encounters: (r.summary as { encounters?: number }).encounters ?? 0, conversions: (r.summary as { conversions?: number }).conversions ?? 0, ms: (r.summary as { ms?: number }).ms ?? 0, error: r.error })),
    reports: reports.map((r) => ({ id: r.id, reason: r.reason, note: r.note, targetType: r.targetType, targetId: r.targetId, reporter: r.reporter.handle, faith: r.faith, createdAt: r.createdAt.toISOString() })),
    posts: posts.map((p) => ({ id: p.id, author: p.authorName, text: p.text, event: p.event?.text ?? null, tick: p.event?.tick ?? null })),
    postCounts: Object.fromEntries(postCounts.map((c) => [c.status, c._count._all])) as Record<string, number>,
    faiths: faiths.map((f) => ({ id: f.id, slug: f.slug, name: f.name, color: f.color, status: f.status, hidden: f.hidden, silenced: f.silenced, strikes: f.strikes, prophet: f.prophet?.handle ?? null, founderType: f.founderType, openReports: f._count.reports, revisions: f.revisions })),
    users: users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() })),
    actions: actions.map((a) => ({ id: a.id, admin: a.admin.handle, action: a.action, targetType: a.targetType, targetId: a.targetId, at: a.createdAt.toISOString() })),
    recent: recent.map((e) => ({ id: e.id, label: `Tick ${e.tick}, encounter ${e.index}: ${e.preacherName} to ${e.target.name}` })),
  };
}
