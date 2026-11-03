import type { EncounterLogRow } from '@/components/agent/EncounterLog';
import type { JourneySegment } from '@/components/agent/FaithJourneyStrip';
import type { MemoryItem } from '@/components/agent/MemoryList';
import { db } from '@/lib/db/client';
import { traitNote } from '@/lib/game/agents';
import { TRAITS } from '@/lib/game/config';
import { checkPreacherEligibility } from '@/lib/game/rules/preachers';
import { agentStatus } from '@/lib/game/status';
import { OUTCOME_LABEL } from '@/lib/ui/ledger';
import { parseLeanings } from '@/lib/engine/state';
import { loadWorldHeader, type WorldHeader } from './common';

export type AgentPage = {
  header: WorldHeader;
  agent: { id: string; slug: string; name: string; persona: string; isBoss: boolean; isFounder: boolean; conviction: number; color: string; faith: { name: string; slug: string } | null; foundedFaith: { name: string; slug: string } | null };
  meta: string;
  stats: { label: string; value: number }[];
  journey: { segments: JourneySegment[]; labels: string[] };
  traits: { key: string; label: string; value: number; note: string }[];
  leanings: { name: string; color: string; value: number }[];
  threshold: number;
  memories: MemoryItem[];
  summary: string | null;
  encounters: EncounterLogRow[];
};

const TRAIT_LABEL: Record<string, string> = { openness: 'Openness', loyalty: 'Loyalty', pedantry: 'Pedantry', sociability: 'Sociability', skepticism: 'Skepticism' };

export async function loadAgent(slug: string): Promise<AgentPage | null> {
  const client = await db();
  const header = await loadWorldHeader(client);
  if (!header) return null;
  const a = await client.agent.findUnique({ where: { slug }, include: { faith: true, foundedFaith: { select: { name: true, slug: true } } } });
  if (!a || a.worldId !== header.id) return null;
  const config = header.config;
  const [spans, faiths, memories, encounters, population] = await Promise.all([
    client.faithSpan.findMany({ where: { agentId: a.id }, orderBy: { fromTick: 'asc' }, include: { faith: { select: { shortName: true, color: true } } } }),
    client.faith.findMany({ where: { worldId: header.id, status: 'active', hidden: false }, select: { id: true, shortName: true, color: true } }),
    client.agentMemory.findMany({ where: { agentId: a.id, tick: { gt: header.season.startTick } }, orderBy: [{ tick: 'desc' }, { id: 'desc' }], take: config.memoryWindow, include: { faith: { select: { color: true } } } }),
    client.encounter.findMany({
      where: { OR: [{ targetId: a.id }, { preacherAgentId: a.id }], faith: { hidden: false } },
      orderBy: [{ tick: 'desc' }, { index: 'asc' }],
      take: 12,
      select: { id: true, tick: true, preacherName: true, targetId: true, outcome: true, faith: { select: { shortName: true } }, target: { select: { name: true } } },
    }),
    client.agent.findMany({ where: { worldId: header.id, faithId: a.faithId ?? '__none__' }, select: { id: true, faithId: true, conviction: true, convertedAtTick: true, isBoss: true, isFounder: true } }),
  ]);

  const unaligned = config.unalignedColor;
  const hiddenFaith = a.faith?.hidden ?? false;
  const faith = a.faith && !hiddenFaith ? a.faith : null;
  const color = faith?.color ?? unaligned;

  // Journey: proportional spans from tick 0 to now.
  const now = header.tick;
  const segments: JourneySegment[] = spans.map((s, i) => ({
    faithName: s.faith?.shortName ?? 'Unaligned',
    color: s.faith?.color ?? unaligned,
    fromTick: s.fromTick,
    toTick: s.toTick ?? spans[i + 1]?.fromTick ?? now,
  }));
  const labels: string[] = [`Tick ${spans[0]?.fromTick ?? 0}`];
  for (const s of spans.slice(1).slice(-2)) labels.push(s.faith ? `Joined the ${s.faith.shortName.split(' ').pop()} at ${s.fromTick}` : `Unaligned at ${s.fromTick}`);
  labels.push(`Now, ${now}`);

  const preachers = checkPreacherEligibility(
    population.map((p) => ({ id: p.id, name: '', archetype: 'Keeper', traits: { openness: 0, loyalty: 0, pedantry: 0, sociability: 0, skepticism: 0 }, isBoss: p.isBoss, isFounder: p.isFounder, faithId: p.faithId, conviction: p.conviction, leanings: {}, convertedAtTick: p.convertedAtTick, wins: 0 })),
    now,
    config,
  );
  const isPreacher = !!a.faithId && (preachers.get(a.faithId) ?? []).includes(a.id);
  const status = agentStatus(a, isPreacher, config);
  const STATUS: Record<string, string> = {
    boss: 'Boss skeptic.',
    founder: 'Founder of a faith. Preaches as its apostle.',
    unaligned: 'Unaligned.',
    preacher: 'Convert, eligible to preach.',
    doubting: 'Doubting.',
    faithful: 'Faithful.',
  };
  const meta = `Agent since tick ${spans[0]?.fromTick ?? 0}. ${STATUS[status]}`;

  const lean = parseLeanings(a.leanings);
  const leanings = faiths
    .map((f) => ({ name: f.shortName, color: f.color, value: f.id === a.faithId ? a.conviction : (lean[f.id] ?? 0) }))
    .filter((l) => l.value > 0)
    .sort((x, y) => y.value - x.value || x.name.localeCompare(y.name));

  return {
    header,
    agent: { id: a.id, slug: a.slug, name: a.name, persona: a.persona, isBoss: a.isBoss, isFounder: a.isFounder, conviction: a.conviction, color, faith: faith ? { name: faith.name, slug: faith.slug } : null, foundedFaith: a.foundedFaith },
    meta,
    stats: [
      { label: 'Conversions', value: a.conversions },
      { label: 'Sermons heard', value: a.sermonsHeard },
      { label: a.isBoss ? 'Sermons resisted' : 'Agents won', value: a.isBoss ? a.bossResistances : a.wins },
    ],
    journey: { segments, labels },
    traits: TRAITS.map((k) => ({ key: k, label: TRAIT_LABEL[k]!, value: a[k], note: traitNote(k, a[k]) })),
    leanings,
    threshold: a.isBoss ? config.bossConversionThreshold : config.conversionThreshold,
    memories: memories.map((m) => ({ id: m.id, tick: m.tick, text: m.text, color: m.faith?.color ?? unaligned })),
    summary: a.memorySummary || null,
    encounters: encounters.map((e) => {
      const asPreacher = e.targetId !== a.id;
      const o = OUTCOME_LABEL[e.outcome] ?? { text: e.outcome, tone: 'muted' as const };
      return {
        id: e.id,
        tick: e.tick,
        who: asPreacher ? `Preached to ${e.target.name}` : `${e.preacherName}, ${e.faith.shortName}`,
        outcome: o.text,
        tone: o.tone,
      };
    }),
  };
}

export async function loadAgentIndex() {
  const client = await db();
  const header = await loadWorldHeader(client);
  if (!header) return null;
  const agents = await client.agent.findMany({
    where: { worldId: header.id },
    orderBy: { seat: 'asc' },
    select: { id: true, slug: true, name: true, persona: true, archetype: true, isBoss: true, isFounder: true, conviction: true, skepticism: true, conversions: true, faith: { select: { shortName: true, color: true, hidden: true, founderType: true } } },
  });
  return { header, agents };
}
