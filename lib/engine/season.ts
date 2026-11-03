import type { Tx } from '@/lib/db/client';
import type { Prisma } from '@/lib/db/generated/client';
import { resolveConfig } from '@/lib/game/config';
import { stableId } from '@/lib/game/rng';
import { seasonClose } from '@/lib/game/rules/season';
import type { LLMClient } from '@/lib/llm/client';
import type { Moderation } from '@/lib/moderation';
import type { AgentRow, ApostleRow, FaithRow, WorldState } from './state';
import * as T from './text';

export type SeasonClosePlan = {
  closingSeasonId: string;
  nextSeason: { id: string; number: number; name: string; startTick: number };
  finalStandings: unknown;
  awards: Prisma.SeasonAwardCreateManyInput[];
  faithIds: string[];
  apostleIds: string[];
  agentResets: { id: string; conviction: number; summaryLine: string }[];
};

type EventFn = (e: Omit<Prisma.ChronicleEventCreateManyInput, 'id' | 'worldId' | 'seasonId' | 'tick' | 'seq'>) => string;

/** Season close (GAME.md §11): awards, archive, reset. Mutates the in-memory agents to their reset state. */
export async function planSeasonClose(
  state: WorldState,
  agents: Map<string, AgentRow>,
  faithById: Map<string, FaithRow>,
  apostleByFaith: Map<string, ApostleRow>,
  tick: number,
  event: EventFn,
  _llm: LLMClient,
  _moderation: Moderation,
): Promise<SeasonClosePlan> {
  const { config, season, world } = state;
  const population = [...agents.values()].filter((a) => !a.isFounder);
  const nonBossCount = population.filter((a) => !a.isBoss).length;
  // Bosses converted this season, by faith (from this season's chronicle, plus this tick's in-memory state).
  const bossConverts = new Map<string, string[]>();
  for (const a of population) if (a.isBoss && a.faithId) bossConverts.set(a.faithId, [...(bossConverts.get(a.faithId) ?? []), a.name]);

  const faiths = [...faithById.values()].map((f) => ({
    id: f.id,
    name: f.name,
    shortName: f.shortName,
    members: population.filter((a) => !a.isBoss && a.faithId === f.id).length,
    conversionsThisSeason: f.conversionsThisSeason,
    foundedTick: f.foundedTick,
    prophetId: f.prophetId,
    apostleWins: apostleByFaith.get(f.id)?.winsThisSeason ?? 0,
    strikes: f.strikes,
    bossesConverted: bossConverts.get(f.id) ?? [],
  }));
  const result = seasonClose({ faiths, agents: population.map((a) => ({ id: a.id, skepticism: a.traits.skepticism, faithId: a.faithId, isBoss: a.isBoss })), nonBossCount }, config);

  const champion = result.standings[0];
  event({
    kind: 'season',
    text: T.seasonClosedSentence(season.number, champion && champion.members > 0 ? { name: champion.name, share: champion.share } : null),
    faithId: champion?.id ?? null,
    data: { awards: result.awards.map((a) => ({ kind: a.kind, faithId: a.faithId, title: a.title })) },
  });

  for (const r of result.resets) {
    const a = agents.get(r.id)!;
    agents.set(r.id, { ...a, faithId: null, conviction: r.conviction, leanings: {}, convertedAtTick: null, memorySummary: r.summaryLine, memorySinceSummary: 0 });
  }

  const number = season.number + 1;
  return {
    closingSeasonId: season.id,
    nextSeason: { id: stableId('season', world.id, number), number, name: config.seasonNames[(number - 1) % config.seasonNames.length]!, startTick: tick },
    finalStandings: result.standings.map((s) => ({ faithId: s.id, name: s.name, members: s.members, share: s.share, rank: s.rank, prophetId: s.prophetId, strikes: s.strikes })),
    awards: result.awards.map((a, i) => ({ id: stableId('award', season.id, i), seasonId: season.id, kind: a.kind, faithId: a.faithId, userId: a.prophetId, title: a.title, detail: a.detail })),
    faithIds: [...faithById.keys()],
    apostleIds: [...apostleByFaith.values()].map((a) => a.id),
    agentResets: result.resets.map((r) => ({ id: r.id, conviction: r.conviction, summaryLine: r.summaryLine })),
  };
}

export async function writeSeasonClose(tx: Tx, worldId: string, p: SeasonClosePlan, tick: number): Promise<void> {
  await tx.season.update({ where: { id: p.closingSeasonId }, data: { status: 'closed', closedAtTick: tick, finalStandings: p.finalStandings as Prisma.InputJsonValue } });
  if (p.awards.length) await tx.seasonAward.createMany({ data: p.awards });
  await tx.season.create({ data: { id: p.nextSeason.id, worldId, number: p.nextSeason.number, name: p.nextSeason.name, startTick: p.nextSeason.startTick } });
  await tx.world.update({ where: { id: worldId }, data: { currentSeasonId: p.nextSeason.id } });
  // Faiths carry into the new season with fresh edits and no strikes.
  await tx.faith.updateMany({ where: { id: { in: p.faithIds } }, data: { strikes: 0, silenced: false, silencedAtTick: null, editsThisSeason: 0, conversionsThisSeason: 0 } });
  await tx.apostle.updateMany({ where: { id: { in: p.apostleIds } }, data: { winsThisSeason: 0, styleChangesThisSeason: 0 } });
  // The Narthex gets first claim on free glass colors, first come first served.
  const active = await tx.faith.findMany({ where: { worldId, status: 'active' }, select: { color: true } });
  const taken = new Set(active.map((f) => f.color.toUpperCase()));
  const queued = await tx.faith.findMany({ where: { worldId, status: 'queued' }, orderBy: { queuedAt: 'asc' } });
  const world = await tx.world.findUniqueOrThrow({ where: { id: worldId } });
  const config = resolveConfig(world.configOverrides);
  let activeCount = active.length;
  for (const q of queued) {
    if (activeCount >= config.maxActiveFaiths) break;
    const color = taken.has(q.color.toUpperCase()) ? config.glassPalette.find((c) => !taken.has(c.hex.toUpperCase()))?.hex : q.color;
    if (!color) break;
    taken.add(color.toUpperCase());
    activeCount++;
    await tx.faith.update({ where: { id: q.id }, data: { status: 'active', color, seasonId: p.nextSeason.id, foundedTick: tick, queuedAt: null } });
  }
  // Agents reset; every open journey span closes and an Unaligned one opens.
  for (const r of p.agentResets) {
    await tx.agent.update({ where: { id: r.id }, data: { faithId: null, conviction: r.conviction, leanings: {}, convertedAtTick: null, memorySummary: r.summaryLine, memorySinceSummary: 0 } });
  }
  const ids = p.agentResets.map((r) => r.id);
  await tx.faithSpan.updateMany({ where: { agentId: { in: ids }, toTick: null }, data: { toTick: tick } });
  await tx.faithSpan.createMany({ data: ids.map((agentId) => ({ id: stableId('span-season', agentId, tick), agentId, faithId: null, fromTick: tick })) });
}
