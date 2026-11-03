import type { LineageNode } from '@/components/faiths/LineageTree';
import { db } from '@/lib/db/client';
import { parseGospel } from '@/lib/game/gospel';
import { flockShare, rankFaiths } from '@/lib/game/rules/leaderboard';
import { loadWorldHeader, type WorldHeader } from './common';

export type FaithPageData = {
  header: WorldHeader;
  faith: {
    id: string;
    slug: string;
    name: string;
    shortName: string;
    color: string;
    founderType: 'human' | 'agent';
    status: 'active' | 'queued' | 'archived';
    silenced: boolean;
    hidden: boolean;
    strikes: number;
    foundedTick: number;
    prophetId: string | null;
    prophetHandle: string | null;
    founderAgent: { name: string; slug: string } | null;
    editsLeft: number;
  };
  apostle: { name: string; style: string; pendingStyle: string | null } | null;
  revision: { id: string; number: number; body: string; tokens: number } | null;
  disputed: { number: number; note: string }[];
  stats: { members: number; share: number; rank: number | null; followers: number };
  lineage: LineageNode;
  flock: { id: string; slug: string; name: string; conviction: number }[];
  moves: { id: string; kind: 'gained' | 'lost'; agent: string; other: string; tick: number; href: string | null }[];
  followedByMe: boolean;
};

export async function loadFaithPage(slug: string, viewerId: string | null, viewerIsAdmin: boolean): Promise<FaithPageData | null> {
  const client = await db();
  const header = await loadWorldHeader(client);
  if (!header) return null;
  const f = await client.faith.findUnique({
    where: { slug },
    include: { prophet: { select: { handle: true } }, apostle: true, currentRevision: true, founderAgent: { select: { name: true, slug: true } } },
  });
  if (!f || f.worldId !== header.id) return null;
  if (f.hidden && !viewerIsAdmin && f.prophetId !== viewerId) return null;

  const [allFaiths, flock, counts, followers, followedByMe, forkEvents, moves] = await Promise.all([
    client.faith.findMany({
      where: { worldId: header.id },
      select: { id: true, slug: true, name: true, shortName: true, color: true, founderType: true, parentId: true, foundedTick: true, forkedAtTick: true, changedDoctrines: true, status: true, conversionsThisSeason: true, hidden: true, prophet: { select: { handle: true } }, founderAgent: { select: { name: true } }, currentRevision: { select: { body: true } } },
    }),
    client.agent.findMany({ where: { faithId: f.id, isBoss: false, isFounder: false }, orderBy: [{ conviction: 'desc' }, { name: 'asc' }], select: { id: true, slug: true, name: true, conviction: true } }),
    client.agent.groupBy({ by: ['faithId'], where: { worldId: header.id, isBoss: false, isFounder: false }, _count: { _all: true } }),
    client.follow.count({ where: { faithId: f.id } }),
    viewerId ? client.follow.findUnique({ where: { userId_faithId: { userId: viewerId, faithId: f.id } }, select: { userId: true } }) : null,
    client.chronicleEvent.findMany({ where: { worldId: header.id, kind: 'schism' }, select: { faithId: true, data: true } }),
    client.chronicleEvent.findMany({
      where: { worldId: header.id, kind: { in: ['conversion', 'agent_preached'] }, OR: [{ faithId: f.id }, { otherFaithId: f.id }] },
      orderBy: [{ tick: 'desc' }, { seq: 'desc' }],
      take: 5,
      include: { agent: { select: { name: true } }, faith: { select: { shortName: true } }, other: { select: { shortName: true } } },
    }),
  ]);

  const countBy = new Map(counts.map((c) => [c.faithId ?? 'unaligned', c._count._all]));
  const nonBoss = [...countBy.values()].reduce((a, b) => a + b, 0);
  const members = countBy.get(f.id) ?? 0;
  const active = allFaiths.filter((x) => x.status === 'active' && !x.hidden);
  const ranked = rankFaiths(active.map((x) => ({ id: x.id, members: countBy.get(x.id) ?? 0, conversionsThisSeason: x.conversionsThisSeason, foundedTick: x.foundedTick })), nonBoss);
  const rank = ranked.find((r) => r.id === f.id)?.rank ?? null;

  // Lineage: from the root ancestor down, unlimited depth.
  const byId = new Map(allFaiths.map((x) => [x.id, x]));
  let root = byId.get(f.id)!;
  for (let guard = 0; root.parentId && byId.has(root.parentId) && guard < 50; guard++) root = byId.get(root.parentId)!;
  const moversByFaith = new Map(forkEvents.map((e) => [e.faithId, Number((e.data as { movers?: number; followers?: number }).movers ?? (e.data as { followers?: number }).followers ?? 0)]));
  const describe = (x: (typeof allFaiths)[number]): string => {
    const doctrines = x.changedDoctrines.length ? ` Changed doctrine ${x.changedDoctrines.join(', ')}.` : '';
    if (!x.parentId) return `Founded tick ${x.foundedTick} by ${x.prophet ? `@${x.prophet.handle}` : 'an agent'}`;
    if (x.founderType === 'agent') {
      const n = countBy.get(x.id) ?? 0;
      return `Started by an agent, ${x.founderAgent?.name ?? 'unknown'}, at tick ${x.forkedAtTick ?? x.foundedTick}. No human prophet. ${n} ${n === 1 ? 'agent' : 'agents'}.`;
    }
    const took = moversByFaith.get(x.id) ?? 0;
    return `Forked by ${x.prophet ? `@${x.prophet.handle}` : 'a prophet'} at tick ${x.forkedAtTick ?? x.foundedTick}.${doctrines} Took ${took} ${took === 1 ? 'agent' : 'agents'}.`;
  };
  const build = (x: (typeof allFaiths)[number]): LineageNode => ({
    id: x.id,
    slug: x.slug,
    name: x.name,
    color: x.color,
    founderType: x.founderType,
    description: describe(x),
    current: x.id === f.id,
    children: allFaiths
      .filter((c) => c.parentId === x.id && !c.hidden)
      .sort((a, b) => (a.forkedAtTick ?? 0) - (b.forkedAtTick ?? 0))
      .map(build),
  });

  // Disputed doctrines: lines a child schism changed.
  const disputed: FaithPageData['disputed'] = [];
  for (const child of allFaiths.filter((c) => c.parentId === f.id && !c.hidden)) {
    const childDoctrines = parseGospel(child.currentRevision?.body ?? '').doctrines;
    for (const n of child.changedDoctrines) {
      const theirs = childDoctrines.find((d) => d.number === n)?.text;
      const existing = disputed.find((d) => d.number === n);
      const note = `Disputed: the ${child.shortName} split here${theirs ? `, holding that “${theirs.replace(/[.]$/, '')}”` : ''}.`;
      if (existing) existing.note = `${existing.note} ${note}`;
      else disputed.push({ number: n, note });
    }
  }

  return {
    header,
    faith: {
      id: f.id,
      slug: f.slug,
      name: f.name,
      shortName: f.shortName,
      color: f.color,
      founderType: f.founderType,
      status: f.status,
      silenced: f.silenced,
      hidden: f.hidden,
      strikes: f.strikes,
      foundedTick: f.foundedTick,
      prophetId: f.prophetId,
      prophetHandle: f.prophet?.handle ?? null,
      founderAgent: f.founderAgent,
      editsLeft: Math.max(0, header.config.gospelEditsPerSeason - f.editsThisSeason),
    },
    apostle: f.apostle ? { name: f.apostle.name, style: f.apostle.style, pendingStyle: f.apostle.pendingStyle } : null,
    revision: f.currentRevision ? { id: f.currentRevision.id, number: f.currentRevision.number, body: f.currentRevision.body, tokens: f.currentRevision.tokens } : null,
    disputed,
    stats: { members, share: flockShare(members, nonBoss), rank, followers },
    lineage: build(root),
    flock,
    moves: moves.map((e) => {
      const gained = e.faithId === f.id;
      return {
        id: e.id,
        kind: gained ? 'gained' : 'lost',
        agent: e.agent?.name ?? 'An agent',
        other: gained ? (e.other ? `the ${e.other.shortName}` : 'no faith') : e.faith ? `the ${e.faith.shortName}` : 'another faith',
        tick: e.tick,
        href: e.encounterId ? `/e/${e.encounterId}` : null,
      };
    }),
    followedByMe: !!followedByMe,
  };
}

export async function loadRevisions(slug: string) {
  const client = await db();
  const f = await client.faith.findUnique({ where: { slug }, select: { id: true, name: true, slug: true, hidden: true, color: true, revisions: { where: { deletedAt: null }, orderBy: { number: 'desc' }, select: { id: true, number: true, body: true, tokens: true, createdAtTick: true, effectiveTick: true, diff: true } } } });
  return f;
}
