import { db } from '@/lib/db/client';
import { GameConfigSchema, resolveConfig, type GameConfig, type RubricKey } from '@/lib/game/config';
import type { RollInput, RollResult } from '@/lib/game/rules/encounter';
import { loadWorldHeader, type WorldHeader } from './common';

export const RUBRIC_LABEL: Record<RubricKey, string> = {
  values: "Speaks to this agent's values",
  coherence: 'Coherence',
  objection: 'Answers the objection',
  novelty: 'New to this agent',
  warmth: 'Warmth without coercion',
};

export type EncounterView = {
  header: WorldHeader;
  config: GameConfig;
  id: string;
  tick: number;
  index: number;
  ofCount: number;
  seedLabel: string;
  preacher: { kind: 'apostle' | 'agent'; name: string; style: string; slug: string | null; faith: { name: string; shortName: string; slug: string; color: string; founderType: 'human' | 'agent' } };
  target: { name: string; slug: string; isBoss: boolean; color: string; faithShort: string | null; conviction: number; skepticism: number };
  turns: { id: string; role: 'sermon' | 'reply'; round: number; speaker: string; text: string; withheld: boolean }[];
  scores: Record<RubricKey, number>;
  heresy: { kind: string | null; quote: string | null; source: string | null } | null;
  roll: RollResult;
  input: RollInput;
  rationale: string;
  outcome: string;
  converted: boolean;
  newFaith: { shortName: string } | null;
  newConviction: number | null;
  fallback: boolean;
  withheld: boolean;
  card: { eventId: string } | null;
  post: { id: string; author: string; text: string; status: string } | null;
};

/** Loads an encounter (by id) with everything the page shows, in a fixed number of queries. */
export async function loadEncounter(id: string): Promise<EncounterView | null> {
  const client = await db();
  const header = await loadWorldHeader(client);
  if (!header) return null;
  const e = await client.encounter.findUnique({
    where: { id },
    include: {
      turns: { orderBy: { order: 'asc' } },
      faith: { select: { name: true, shortName: true, slug: true, color: true, founderType: true, hidden: true } },
      target: { select: { name: true, slug: true, isBoss: true, skepticism: true } },
      targetFaith: { select: { shortName: true, color: true } },
      preacherAgent: { select: { slug: true } },
      events: { include: { card: { select: { id: true } } } },
      posts: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!e || e.worldId !== header.id || e.faith.hidden) return null;
  const [ofCount, run] = await Promise.all([
    client.encounter.count({ where: { worldId: e.worldId, tick: e.tick } }),
    client.tickRun.findUnique({ where: { worldId_tick: { worldId: e.worldId, tick: e.tick } }, select: { config: true } }),
  ]);
  const parsed = GameConfigSchema.safeParse(run?.config);
  const config = parsed.success ? parsed.data : resolveConfig({});
  const roll = e.rollResult as unknown as RollResult;
  const input = e.rollInput as unknown as RollInput;
  const cardEvent = e.events.find((ev) => ev.card);
  const post = e.posts.find((p) => p.agentId === e.targetId) ?? e.posts[0] ?? null;
  return {
    header,
    config,
    id: e.id,
    tick: e.tick,
    index: e.index,
    ofCount,
    seedLabel: e.seedLabel,
    preacher: { kind: e.preacherKind, name: e.preacherName, style: e.style, slug: e.preacherAgent?.slug ?? null, faith: e.faith },
    target: { name: e.target.name, slug: e.target.slug, isBoss: e.target.isBoss, color: e.targetFaith?.color ?? config.unalignedColor, faithShort: e.targetFaith?.shortName ?? null, conviction: e.convictionBefore, skepticism: e.target.skepticism },
    turns: e.turns.map((t) => ({ id: t.id, role: t.role, round: t.round, speaker: t.speakerName, text: t.text, withheld: t.withheld })),
    scores: e.scores as Record<RubricKey, number>,
    heresy: e.heresy ? { kind: e.heresyKind, quote: e.heresyQuote, source: e.heresySource } : null,
    roll,
    input,
    rationale: e.rationale,
    outcome: e.outcome,
    converted: e.converted,
    newFaith: e.converted ? { shortName: e.faith.shortName } : null,
    newConviction: e.converted ? e.convictionAfter : null,
    fallback: e.fallback,
    withheld: e.withheld,
    card: cardEvent ? { eventId: cardEvent.id } : null,
    post: post && post.status !== 'discarded' ? { id: post.id, author: post.authorName, text: post.text, status: post.status } : null,
  };
}

export type EventView = {
  id: string;
  tick: number;
  kind: string;
  text: string;
  encounterId: string | null;
  faith: { name: string; slug: string; color: string } | null;
  other: { name: string; slug: string; color: string } | null;
  card: { headline: string; kicker: string; quote: string; scoreLine: string } | null;
};

export async function loadEvent(id: string): Promise<EventView | null> {
  const client = await db();
  const ev = await client.chronicleEvent.findUnique({
    where: { id },
    include: { faith: { select: { name: true, slug: true, color: true, hidden: true } }, other: { select: { name: true, slug: true, color: true } }, card: true },
  });
  if (!ev || ev.faith?.hidden) return null;
  return {
    id: ev.id,
    tick: ev.tick,
    kind: ev.kind,
    text: ev.text,
    encounterId: ev.encounterId,
    faith: ev.faith,
    other: ev.other,
    card: ev.card ? { headline: ev.card.headline, kicker: ev.card.kicker, quote: ev.card.quote, scoreLine: ev.card.scoreLine } : null,
  };
}

export type EncounterRow = { id: string; tick: number; index: number; preacher: string; faith: { shortName: string; color: string; founderType: 'human' | 'agent' }; target: string; outcome: string; heresy: boolean };

export async function loadEncounterIndex(opts: { before?: number; outcome?: string; take?: number }): Promise<{ header: WorldHeader; rows: EncounterRow[]; nextBefore: number | null } | null> {
  const client = await db();
  const header = await loadWorldHeader(client);
  if (!header) return null;
  const take = opts.take ?? 60;
  const outcome = opts.outcome && ['converted', 'doubted', 'held', 'heresy', 'boss_held', 'backlash'].includes(opts.outcome) ? opts.outcome : undefined;
  const rows = await client.encounter.findMany({
    where: { worldId: header.id, faith: { hidden: false }, ...(opts.before ? { tick: { lt: opts.before } } : {}), ...(outcome ? { outcome: outcome as 'converted' } : {}) },
    orderBy: [{ tick: 'desc' }, { index: 'asc' }],
    take: take + 1,
    select: { id: true, tick: true, index: true, preacherName: true, outcome: true, heresy: true, faith: { select: { shortName: true, color: true, founderType: true } }, target: { select: { name: true } } },
  });
  const more = rows.length > take;
  const page = rows.slice(0, take);
  // Page on whole ticks (at most maxEncountersPerTick per tick, far below `take`): drop the
  // partial last tick and start the next page there.
  const lastTick = page[page.length - 1]?.tick;
  const visible = more && lastTick !== undefined ? page.filter((r) => r.tick > lastTick) : page;
  return {
    header,
    rows: visible.map((r) => ({ id: r.id, tick: r.tick, index: r.index, preacher: r.preacherName, faith: r.faith, target: r.target.name, outcome: r.outcome, heresy: r.heresy })),
    nextBefore: more && lastTick !== undefined ? lastTick + 1 : null,
  };
}
