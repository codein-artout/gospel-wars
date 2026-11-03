import type { ChronicleRow } from '@/components/world/ChronicleList';
import type { RosePane } from '@/components/world/RoseWindow';
import type { SelectedAgent } from '@/components/world/SelectedAgentPanel';
import { db, type Db } from '@/lib/db/client';
import { flockShare } from '@/lib/game/rules/leaderboard';
import type { ChronicleKind } from '@/lib/ui/chronicle';
import { leadFor, loadWorldHeader, type WorldHeader } from './common';

export type ShareRow = { key: string; name: string; shortName: string; slug: string | null; color: string; lead: 'solid' | 'agent'; count: number; share: number };

export type NaveData = {
  header: WorldHeader;
  panes: RosePane[];
  agents: SelectedAgent[];
  shares: ShareRow[];
  chronicle: ChronicleRow[];
  latestEncounterId: string | null;
  anyBossConverted: boolean;
};

/** Chronicle rows with the glass of the faith involved (pewter for bosses held, Unaligned). */
export async function loadChronicle(client: Db, worldId: string, opts: { take: number; faithId?: string; agentId?: string }, unaligned: string): Promise<ChronicleRow[]> {
  const events = await client.chronicleEvent.findMany({
    where: {
      worldId,
      ...(opts.faithId ? { OR: [{ faithId: opts.faithId }, { otherFaithId: opts.faithId }] } : {}),
      ...(opts.agentId ? { agentId: opts.agentId } : {}),
    },
    orderBy: [{ tick: 'desc' }, { seq: 'desc' }],
    take: opts.take,
    include: { faith: { select: { color: true, founderType: true, hidden: true } } },
  });
  return events
    .filter((e) => !e.faith?.hidden)
    .map((e) => ({
      id: e.id,
      tick: e.tick,
      kind: e.kind as ChronicleKind,
      text: e.text,
      color: e.kind === 'boss_held' ? unaligned : (e.faith?.color ?? unaligned),
      lead: e.kind === 'boss_held' ? 'solid' : leadFor(e.faith?.founderType),
      href: e.encounterId ? `/e/${e.encounterId}` : e.kind === 'schism' ? `/e/${e.id}` : null,
    }));
}

export async function loadNave(): Promise<NaveData | null> {
  const client = await db();
  const header = await loadWorldHeader(client);
  if (!header) return null;
  const worldId = header.id;
  const unaligned = header.config.unalignedColor;

  const [faiths, agents, memories, latest] = await Promise.all([
    client.faith.findMany({ where: { worldId, status: 'active' }, select: { id: true, slug: true, name: true, shortName: true, color: true, founderType: true, hidden: true, foundedTick: true } }),
    client.agent.findMany({ where: { worldId }, orderBy: { seat: 'asc' }, select: { id: true, slug: true, name: true, persona: true, faithId: true, isBoss: true, isFounder: true, conviction: true, skepticism: true } }),
    client.$queryRaw<{ agentId: string; text: string }[]>`
      SELECT DISTINCT ON (m."agentId") m."agentId", m.text
      FROM "AgentMemory" m JOIN "Agent" a ON a.id = m."agentId"
      WHERE a."worldId" = ${worldId}
      ORDER BY m."agentId", m.tick DESC, m.id DESC`,
    client.encounter.findFirst({ where: { worldId, withheld: false }, orderBy: [{ converted: 'desc' }, { tick: 'desc' }, { index: 'asc' }], select: { id: true, tick: true } }),
  ]);
  const latestAny = await client.encounter.findFirst({ where: { worldId }, orderBy: [{ tick: 'desc' }, { index: 'asc' }], select: { id: true, tick: true } });
  const faithById = new Map(faiths.map((f) => [f.id, f]));
  const memoryByAgent = new Map(memories.map((m) => [m.agentId, m.text]));

  // Founders preach for their faiths and leave the share count, but stay visible in the window (GAME.md §10.3).
  const population = agents.filter((a) => !a.isFounder);
  const panes: RosePane[] = agents.map((a) => {
    const found = a.faithId ? faithById.get(a.faithId) : undefined;
    // Hidden faiths (reported) do not show their name or glass on public pages.
    const f = found && !found.hidden ? found : undefined;
    return {
      id: a.id,
      slug: a.slug,
      name: a.name,
      faithId: found ? found.id : null,
      faithName: f ? f.name : 'Unaligned',
      color: f ? f.color : unaligned,
      isBoss: a.isBoss,
      agentFounded: f?.founderType === 'agent',
      founder: a.isFounder,
    };
  });
  const selected: SelectedAgent[] = agents.map((a) => {
    const found = a.faithId ? faithById.get(a.faithId) : undefined;
    const f = found && !found.hidden ? found : undefined;
    const memory = memoryByAgent.get(a.id) ?? null;
    return {
      id: a.id,
      slug: a.slug,
      name: a.name,
      faithLabel: a.isBoss && !f ? 'Boss skeptic, unconverted' : a.isFounder && f ? `Founder of the ${f.shortName}` : (f?.name ?? 'Unaligned'),
      color: f ? f.color : unaligned,
      isBoss: a.isBoss,
      persona: a.persona,
      conviction: a.conviction,
      skepticism: a.skepticism,
      memory: memory && memory !== '[withheld]' ? memory : null,
    };
  });

  const nonBoss = population.filter((a) => !a.isBoss);
  const counts = new Map<string | null, number>();
  for (const a of nonBoss) counts.set(a.faithId, (counts.get(a.faithId) ?? 0) + 1);
  const shares: ShareRow[] = faiths
    // Empty faiths stay on the Faiths page; the Nave lists faiths with a flock.
    .filter((f) => !f.hidden && (counts.get(f.id) ?? 0) > 0)
    .map((f) => ({ key: f.id, name: f.name, shortName: f.shortName, slug: f.slug, color: f.color, lead: leadFor(f.founderType), count: counts.get(f.id) ?? 0, share: flockShare(counts.get(f.id) ?? 0, nonBoss.length) }))
    .sort((x, y) => y.count - x.count || x.name.localeCompare(y.name));
  // Hidden faiths' members still count; they show under their faith only on admin pages.
  const hiddenMembers = faiths.filter((f) => f.hidden).reduce((s, f) => s + (counts.get(f.id) ?? 0), 0);
  const unalignedCount = (counts.get(null) ?? 0) + hiddenMembers;
  shares.push({ key: 'unaligned', name: 'Unaligned', shortName: 'Unaligned', slug: null, color: unaligned, lead: 'solid', count: unalignedCount, share: flockShare(unalignedCount, nonBoss.length) });

  const chronicle = await loadChronicle(client, worldId, { take: 6 }, unaligned);
  const recent = latest && latestAny && latestAny.tick - latest.tick <= 3 ? latest : latestAny;

  return {
    header,
    panes,
    agents: selected,
    shares,
    chronicle,
    latestEncounterId: recent?.id ?? null,
    anyBossConverted: population.some((a) => a.isBoss && a.faithId !== null),
  };
}
