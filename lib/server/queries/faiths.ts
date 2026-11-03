import type { StandingRow } from '@/components/faiths/StandingsTable';
import { db, type Db } from '@/lib/db/client';
import { flockShare, rankFaiths, rankProphets, type ProphetRecord } from '@/lib/game/rules/leaderboard';
import { leadFor, loadWorldHeader, type WorldHeader } from './common';

export type Podium = { rank: number; name: string; slug: string; color: string; lead: 'solid' | 'agent'; summary: string };
export type BossView = { id: string; slug: string; name: string; skepticism: number; resisted: number; title: string; convertedBy: string | null };

export type StandingsData = {
  header: WorldHeader;
  podium: Podium[];
  rows: StandingRow[];
  bosses: BossView[];
  seasons: { number: number; name: string; status: 'active' | 'closed' }[];
};

const signed = (n: number) => (n > 0 ? `up ${n}` : n < 0 ? `down ${Math.abs(n)}` : 'level');

/** Member counts per faith key ("unaligned" included) among the non-boss population. */
async function memberCounts(client: Db, worldId: string): Promise<{ counts: Map<string, number>; nonBoss: number }> {
  const groups = await client.agent.groupBy({ by: ['faithId'], where: { worldId, isBoss: false, isFounder: false }, _count: { _all: true } });
  const counts = new Map<string, number>();
  let nonBoss = 0;
  for (const g of groups) {
    counts.set(g.faithId ?? 'unaligned', g._count._all);
    nonBoss += g._count._all;
  }
  return { counts, nonBoss };
}

export async function loadStandings(): Promise<StandingsData | null> {
  const client = await db();
  const header = await loadWorldHeader(client);
  if (!header) return null;
  const worldId = header.id;
  const [faiths, { counts, nonBoss }, baseline, bosses, seasons] = await Promise.all([
    client.faith.findMany({
      where: { worldId, status: 'active', hidden: false },
      include: {
        prophet: { select: { handle: true } },
        apostle: { select: { style: true, name: true } },
        parent: { select: { shortName: true } },
        founderAgent: { select: { name: true } },
        _count: { select: { children: true } },
      },
    }),
    memberCounts(client, worldId),
    client.shareSnapshot.findMany({ where: { worldId, tick: header.season.startTick }, select: { faithKey: true, members: true } }),
    client.agent.findMany({ where: { worldId, isBoss: true }, orderBy: { seat: 'asc' }, include: { faith: { select: { prophet: { select: { handle: true } }, shortName: true } } } }),
    client.season.findMany({ where: { worldId }, orderBy: { number: 'asc' }, select: { number: true, name: true, status: true } }),
  ]);
  const base = new Map(baseline.map((b) => [b.faithKey, b.members]));
  // Faiths that lost members to a schism this season.
  const schismParents = new Set(
    (await client.faith.findMany({ where: { worldId, parentId: { not: null }, forkedAtTick: { gt: header.season.startTick } }, select: { parentId: true } })).map((f) => f.parentId!),
  );

  const ranked = rankFaiths(
    faiths.map((f) => ({ id: f.id, members: counts.get(f.id) ?? 0, conversionsThisSeason: f.conversionsThisSeason, foundedTick: f.foundedTick, f })),
    nonBoss,
  );
  const rows: StandingRow[] = ranked.map((r) => {
    const f = r.f;
    const delta = r.members - (base.get(f.id) ?? 0);
    const lineage = f.founderType === 'agent'
      ? `Started by an agent, ${f.founderAgent?.name ?? 'unknown'}, at tick ${f.foundedTick}`
      : f.parent
        ? `Schism of the ${f.parent.shortName}, tick ${f.forkedAtTick ?? f.foundedTick}`
        : f._count.children > 0
          ? `Founding faith, parent of ${f._count.children} ${f._count.children === 1 ? 'schism' : 'schisms'}`
          : 'Founding faith';
    return {
      key: f.id,
      rank: r.rank,
      name: f.name,
      slug: f.slug,
      color: f.color,
      lead: leadFor(f.founderType),
      lineage,
      prophet: f.prophet ? `@${f.prophet.handle}` : 'No human prophet',
      style: f.apostle?.style ?? '',
      share: r.share,
      members: r.members,
      delta,
      heresies: f.strikes,
      silenced: f.silenced,
    };
  });
  const unaligned = counts.get('unaligned') ?? 0;
  rows.push({
    key: 'unaligned',
    rank: null,
    name: 'Unaligned',
    slug: null,
    color: header.config.unalignedColor,
    lineage: 'Agents with no faith',
    prophet: '',
    style: '',
    share: flockShare(unaligned, nonBoss),
    delta: unaligned - (base.get('unaligned') ?? 0),
    heresies: null,
  });

  const podium: Podium[] = ranked.slice(0, 3).map((r, i) => {
    const pct = `${(r.share * 100).toFixed(1)}%`;
    const delta = r.members - (base.get(r.id) ?? 0);
    const agents = Math.abs(delta) === 1 ? 'agent' : 'agents';
    const summary =
      i === 0
        ? `${pct} of the world, ${signed(delta)}${delta ? ` ${agents}` : ''} this season`
        : delta < 0 && schismParents.has(r.id)
          ? `${pct}, ${signed(delta)} after the schism`
          : `${pct}, ${signed(delta)} this season`;
    return { rank: r.rank, name: r.f.name, slug: r.f.slug, color: r.f.color, lead: leadFor(r.f.founderType), summary };
  });

  return {
    header,
    podium,
    rows,
    bosses: bosses.map((b) => ({
      id: b.id,
      slug: b.slug,
      name: b.name,
      skepticism: b.skepticism,
      resisted: b.bossResistances,
      title: b.bossTitle ?? header.config.bosses.find((x) => x.name === b.name)?.title ?? 'Confessor',
      convertedBy: b.faith ? (b.faith.prophet ? `@${b.faith.prophet.handle}` : `the ${b.faith.shortName}`) : null,
    })),
    seasons: seasons.map((s) => ({ number: s.number, name: s.name, status: s.status })),
  };
}

export type AllTimeRow = ProphetRecord & { rank: number; faith: { name: string; slug: string; color: string } | null };

/** All-time view: prophets by best finish (archived seasons plus the live one), then total conversions. */
export async function loadAllTime(header: WorldHeader): Promise<AllTimeRow[]> {
  const client = await db();
  const worldId = header.id;
  const [faiths, closed, conversions] = await Promise.all([
    client.faith.findMany({ where: { worldId, prophetId: { not: null }, hidden: false }, select: { id: true, name: true, slug: true, color: true, status: true, prophetId: true, prophet: { select: { handle: true } } } }),
    client.season.findMany({ where: { worldId, status: 'closed' }, select: { finalStandings: true } }),
    client.encounter.groupBy({ by: ['faithId'], where: { worldId, converted: true }, _count: { _all: true } }),
  ]);
  const live = await loadStandings();
  const liveRank = new Map((live?.rows ?? []).filter((r) => r.rank !== null).map((r) => [r.key, r.rank!]));
  const convByFaith = new Map(conversions.map((c) => [c.faithId, c._count._all]));
  const best = new Map<string, number>();
  for (const s of closed) {
    for (const st of (s.finalStandings as { faithId: string; rank: number; prophetId: string | null }[] | null) ?? []) {
      if (st.prophetId) best.set(st.prophetId, Math.min(best.get(st.prophetId) ?? Infinity, st.rank));
    }
  }
  const byProphet = new Map<string, { handle: string; conversions: number; faith: AllTimeRow['faith'] }>();
  for (const f of faiths) {
    const pid = f.prophetId!;
    const cur = byProphet.get(pid) ?? { handle: f.prophet!.handle, conversions: 0, faith: null };
    cur.conversions += convByFaith.get(f.id) ?? 0;
    if (f.status === 'active') cur.faith = { name: f.name, slug: f.slug, color: f.color };
    const lr = liveRank.get(f.id);
    if (lr !== undefined) best.set(pid, Math.min(best.get(pid) ?? Infinity, lr));
    byProphet.set(pid, cur);
  }
  const ranked = rankProphets([...byProphet.entries()].map(([prophetId, v]) => ({ prophetId, handle: v.handle, bestFinish: Number.isFinite(best.get(prophetId) ?? Infinity) ? best.get(prophetId)! : null, totalConversions: v.conversions })));
  return ranked.map((r) => ({ ...r, faith: byProphet.get(r.prophetId)?.faith ?? null }));
}

export type SeasonArchive = {
  header: WorldHeader;
  season: { number: number; name: string; status: 'active' | 'closed'; startTick: number; closedAtTick: number | null };
  standings: { faithId: string; name: string; slug: string | null; color: string; members: number; share: number; rank: number; prophet: string | null; strikes: number }[];
  awards: { kind: string; title: string; detail: string; faith: { name: string; slug: string; color: string } | null; prophet: string | null }[];
};

export async function loadSeason(number: number): Promise<SeasonArchive | null> {
  const client = await db();
  const header = await loadWorldHeader(client);
  if (!header) return null;
  const s = await client.season.findUnique({ where: { worldId_number: { worldId: header.id, number } }, include: { awards: { include: { faith: { select: { name: true, slug: true, color: true } }, user: { select: { handle: true } } } } } });
  if (!s) return null;
  let standings: SeasonArchive['standings'];
  if (s.status === 'closed') {
    const raw = (s.finalStandings as { faithId: string; name: string; members: number; share: number; rank: number; prophetId: string | null; strikes: number }[] | null) ?? [];
    const faiths = await client.faith.findMany({ where: { id: { in: raw.map((r) => r.faithId) } }, select: { id: true, slug: true, color: true, hidden: true, prophet: { select: { handle: true } } } });
    const byId = new Map(faiths.map((f) => [f.id, f]));
    standings = raw
      .filter((r) => !byId.get(r.faithId)?.hidden)
      .map((r) => {
        const f = byId.get(r.faithId);
        return { faithId: r.faithId, name: r.name, slug: f?.slug ?? null, color: f?.color ?? header.config.unalignedColor, members: r.members, share: r.share, rank: r.rank, prophet: f?.prophet ? `@${f.prophet.handle}` : null, strikes: r.strikes };
      });
  } else {
    const live = await loadStandings();
    standings = (live?.rows ?? [])
      .filter((r) => r.rank !== null)
      .map((r) => ({ faithId: r.key, name: r.name, slug: r.slug, color: r.color, members: r.members ?? 0, share: r.share, rank: r.rank!, prophet: r.prophet.startsWith('@') ? r.prophet : null, strikes: r.heresies ?? 0 }));
  }
  return {
    header,
    season: { number: s.number, name: s.name, status: s.status, startTick: s.startTick, closedAtTick: s.closedAtTick },
    standings,
    awards: s.awards.map((a) => ({ kind: a.kind, title: a.title, detail: a.detail, faith: a.faith, prophet: a.user ? `@${a.user.handle}` : null })),
  };
}
