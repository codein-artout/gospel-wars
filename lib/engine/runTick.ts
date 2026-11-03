import type { Db } from '@/lib/db/client';
import { Prisma } from '@/lib/db/generated/client';
import type { ApostleStyle, GameConfig } from '@/lib/game/config';
import { amendGospel, parseGospel } from '@/lib/game/gospel';
import { detectParaphrase, lintGospel, lintText } from '@/lib/game/heresy';
import { agentSchismFaithName, shortFaithName, slugify } from '@/lib/game/names';
import { seed, stableId } from '@/lib/game/rng';
import { applyEncounterToTarget } from '@/lib/game/rules/conversion';
import { decayAndRegen } from '@/lib/game/rules/decay';
import { encounterDraws, resolveEncounter, seedLabel, type RollInput, type RollResult } from '@/lib/game/rules/encounter';
import { flockShare } from '@/lib/game/rules/leaderboard';
import { checkPreacherEligibility } from '@/lib/game/rules/preachers';
import { scheduleEncounters, type ScheduledEncounter } from '@/lib/game/rules/schedule';
import { agentSchismFollowers, firstFreeColor, rollAgentSchism } from '@/lib/game/rules/schism';
import { isSeasonEnd } from '@/lib/game/rules/season';
import { applyStrike } from '@/lib/game/rules/strikes';
import { countTokens } from '@/lib/game/tokens';
import { createLLMClient } from '@/lib/llm';
import type { LLMClient } from '@/lib/llm/client';
import { createModeration } from '@/lib/moderation/create';
import type { Moderation } from '@/lib/moderation';
import { mapPool, runEncounter, type EncounterRun, type PreacherInfo } from './encounters';
import { planSeasonClose, writeSeasonClose, type SeasonClosePlan } from './season';
import { loadWorldState, type AgentRow, type ApostleRow, type FaithRow, type WorldState } from './state';
import * as T from './text';

export type TickOptions = {
  /** Expected tick number; a tick that already ran is a no-op. */
  tick?: number;
  llm?: LLMClient;
  moderation?: Moderation;
  /** Extra overrides on top of World.configOverrides (seed tooling only). */
  configOverride?: unknown;
  now?: () => Date;
  /** A running TickRun older than this is considered abandoned. */
  staleAfterMs?: number;
  concurrency?: number;
};

export type TickSummary = {
  status: 'done' | 'noop' | 'busy';
  worldId: string;
  tick: number;
  encounters: number;
  conversions: number;
  schisms: number;
  heresies: number;
  bossHeld: number;
  seasonClosed: boolean;
  llmCalls: number;
  fallbacks: number;
  ms: number;
  headlines: string[];
};

export class TickConflictError extends Error {}

const json = (v: unknown): Prisma.InputJsonValue => v as Prisma.InputJsonValue;

type AgentPatch = Partial<{
  faithId: string | null;
  conviction: number;
  leanings: Record<string, number>;
  convertedAtTick: number | null;
  wins: number;
  conversions: number;
  sermonsHeard: number;
  bossResistances: number;
  isFounder: boolean;
  memorySummary: string;
  memorySinceSummary: number;
}>;

type Plan = {
  tick: number;
  world: WorldState['world'];
  season: WorldState['season'];
  config: GameConfig;
  faithPatches: Map<string, Prisma.FaithUncheckedUpdateInput>;
  apostlePatches: Map<string, Prisma.ApostleUncheckedUpdateInput>;
  newFaiths: { faith: Prisma.FaithUncheckedCreateInput; revision: Prisma.GospelRevisionUncheckedCreateInput; apostle: Prisma.ApostleUncheckedCreateInput }[];
  agents: Map<string, AgentRow>;
  agentPatches: Map<string, AgentPatch>;
  encounters: Prisma.EncounterCreateManyInput[];
  turns: Prisma.EncounterTurnCreateManyInput[];
  memories: Prisma.AgentMemoryCreateManyInput[];
  spanMoves: { agentId: string; faithId: string | null }[];
  events: Prisma.ChronicleEventCreateManyInput[];
  cards: Prisma.ConversionCardCreateManyInput[];
  posts: Prisma.DraftPostCreateManyInput[];
  snapshots: Prisma.ShareSnapshotCreateManyInput[];
  season2: SeasonClosePlan | null;
  summary: TickSummary;
};

/**
 * Runs one tick (GAME.md §5). Idempotent per (worldId, tick): a TickRun row with a unique key
 * claims the tick, and the commit only succeeds if the world is still at tick − 1 with the
 * same stateVersion. Shared by `pnpm tick`, the cron route and the admin button.
 */
export async function runTick(db: Db, worldId: string, opts: TickOptions = {}): Promise<TickSummary> {
  const started = Date.now();
  const now = opts.now ?? (() => new Date());
  const world = await db.world.findUniqueOrThrow({ where: { id: worldId }, select: { currentTick: true } });
  const tick = world.currentTick + 1;
  const empty = (status: TickSummary['status'], t: number): TickSummary => ({
    status, worldId, tick: t, encounters: 0, conversions: 0, schisms: 0, heresies: 0, bossHeld: 0, seasonClosed: false, llmCalls: 0, fallbacks: 0, ms: Date.now() - started, headlines: [],
  });
  if (opts.tick !== undefined && opts.tick !== tick) {
    if (opts.tick <= world.currentTick) return empty('noop', opts.tick);
    throw new Error(`Cannot run tick ${opts.tick}: the world is at tick ${world.currentTick}.`);
  }

  const claim = await claimTick(db, worldId, tick, opts.staleAfterMs ?? 10 * 60_000, now());
  if (claim === 'done') return empty('noop', tick);
  if (claim === 'busy') return empty('busy', tick);

  for (let attempt = 0; ; attempt++) {
    try {
      const state = await loadWorldState(db, worldId, tick, opts.configOverride);
      const llm = opts.llm ?? createLLMClient(state.config);
      const moderation = opts.moderation ?? createModeration(state.config, llm);
      const plan = await planTick(state, tick, llm, moderation, opts.concurrency ?? 4);
      plan.summary.llmCalls = llm.budget.calls;
      plan.summary.fallbacks = llm.fallbackCount;
      plan.summary.ms = Date.now() - started;
      await commit(db, plan, now());
      return plan.summary;
    } catch (e) {
      if (e instanceof TickConflictError && attempt === 0) continue;
      await db.tickRun.updateMany({ where: { worldId, tick, status: 'running' }, data: { status: 'failed', error: e instanceof Error ? e.message.slice(0, 2000) : String(e), finishedAt: now() } });
      throw e;
    }
  }
}

async function claimTick(db: Db, worldId: string, tick: number, staleAfterMs: number, now: Date): Promise<'claimed' | 'done' | 'busy'> {
  try {
    await db.tickRun.create({ data: { worldId, tick, status: 'running', config: {}, startedAt: now } });
    return 'claimed';
  } catch (e) {
    if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== 'P2002') throw e;
  }
  const existing = await db.tickRun.findUniqueOrThrow({ where: { worldId_tick: { worldId, tick } } });
  if (existing.status === 'done') return 'done';
  const cutoff = new Date(now.getTime() - staleAfterMs);
  // Take over a failed run, or a running one that has been abandoned.
  const taken = await db.tickRun.updateMany({
    where: { id: existing.id, OR: [{ status: 'failed' }, { status: 'running', startedAt: { lt: cutoff } }] },
    data: { status: 'running', startedAt: now, error: null },
  });
  return taken.count === 1 ? 'claimed' : 'busy';
}

// ---------------------------------------------------------------- planning (steps 1-8)

async function planTick(state: WorldState, tick: number, llm: LLMClient, moderation: Moderation, concurrency: number): Promise<Plan> {
  const { config, world, season } = state;
  const plan: Plan = {
    tick, world, season, config,
    faithPatches: new Map(), apostlePatches: new Map(), newFaiths: [],
    agents: new Map(state.agents.map((a) => [a.id, { ...a, leanings: { ...a.leanings } }])),
    agentPatches: new Map(), encounters: [], turns: [], memories: [], spanMoves: [], events: [], cards: [], posts: [], snapshots: [], season2: null,
    summary: { status: 'done', worldId: world.id, tick, encounters: 0, conversions: 0, schisms: 0, heresies: 0, bossHeld: 0, seasonClosed: false, llmCalls: 0, fallbacks: 0, ms: 0, headlines: [] },
  };
  const faithById = new Map(state.faiths.map((f) => [f.id, { ...f }]));
  const apostleByFaith = new Map(state.apostles.map((a) => [a.faithId, { ...a }]));
  let seq = 0;
  const patchFaith = (id: string, p: Prisma.FaithUncheckedUpdateInput) => plan.faithPatches.set(id, { ...plan.faithPatches.get(id), ...p });
  const patchApostle = (id: string, p: Prisma.ApostleUncheckedUpdateInput) => plan.apostlePatches.set(id, { ...plan.apostlePatches.get(id), ...p });
  const patchAgent = (id: string, p: AgentPatch) => plan.agentPatches.set(id, { ...plan.agentPatches.get(id), ...p });
  const event = (e: Omit<Prisma.ChronicleEventCreateManyInput, 'id' | 'worldId' | 'seasonId' | 'tick' | 'seq'>) => {
    const s = seq++;
    const id = stableId('evt', world.id, tick, s);
    plan.events.push({ ...e, id, worldId: world.id, seasonId: season.id, tick, seq: s });
    plan.summary.headlines.push(e.text);
    return id;
  };

  // Step 1: pending gospel edits and apostle style changes.
  for (const f of faithById.values()) {
    const rev = state.revisions.get(f.id);
    if (rev && rev.id !== f.currentRevisionId) {
      f.currentRevisionId = rev.id;
      patchFaith(f.id, { currentRevisionId: rev.id });
    }
  }
  for (const a of apostleByFaith.values()) {
    if (a.pendingStyle && a.pendingStyle !== a.style) {
      a.style = a.pendingStyle;
      patchApostle(a.id, { style: a.style, pendingStyle: null });
    } else if (a.pendingStyle) patchApostle(a.id, { pendingStyle: null });
  }

  // Shares at the start of the tick drive social proof.
  const population = [...plan.agents.values()].filter((a) => !a.isFounder);
  const nonBoss = population.filter((a) => !a.isBoss).length;
  const startMembers = new Map<string, number>();
  for (const a of population) if (!a.isBoss && a.faithId) startMembers.set(a.faithId, (startMembers.get(a.faithId) ?? 0) + 1);
  const sharePct = (faithId: string) => flockShare(startMembers.get(faithId) ?? 0, nonBoss) * 100;

  // Step 2: schedule.
  const preachersByFaith = checkPreacherEligibility(population, tick, config);
  const preachable = (faithId: string) => faithById.has(faithId) && state.revisions.has(faithId);
  const schedule = scheduleEncounters(
    {
      worldSeed: world.seed,
      tick,
      agents: population.map((a) => ({ id: a.id, faithId: a.faithId, conviction: a.conviction, isBoss: a.isBoss })),
      apostles: [...apostleByFaith.values()].filter((a) => preachable(a.faithId)).map((a) => ({ id: a.id, faithId: a.faithId, style: a.style, silenced: faithById.get(a.faithId)!.silenced })),
      preachers: [...preachersByFaith.entries()].filter(([fid]) => preachable(fid) && !faithById.get(fid)!.silenced).flatMap(([fid, ids]) => ids.map((agentId) => ({ agentId, faithId: fid, style: apostleByFaith.get(fid)?.style ?? 'Gentle' }))),
      recentPairs: state.recentPairs,
    },
    config,
  );

  // Step 3: run encounters (parallel), from start-of-tick state.
  const preacherFor = (e: ScheduledEncounter): PreacherInfo => {
    const faith = faithById.get(e.preacher.faithId)!;
    const revision = state.revisions.get(faith.id)!;
    if (e.preacher.kind === 'apostle') {
      const ap = [...apostleByFaith.values()].find((a) => a.id === e.preacher.id)!;
      return { kind: 'apostle', id: ap.id, apostleId: ap.id, agentId: ap.agentId, name: ap.name, style: ap.style, faith, revision };
    }
    const ag = plan.agents.get(e.preacher.id)!;
    return { kind: 'agent', id: ag.id, apostleId: null, agentId: ag.id, name: ag.name, style: e.preacher.style, faith, revision };
  };
  const ctx = { tick, config, llm, moderation, faithById, revisions: state.revisions, memories: state.memories };
  const startAgents = new Map(state.agents.map((a) => [a.id, a]));
  const runs = await mapPool(schedule, concurrency, (e) => runEncounter(e, preacherFor(e), startAgents.get(e.targetId)!, ctx));

  // Step 4: apply state changes in schedule order.
  const convertedThisTick = new Set<string>();
  const encountered = new Set<string>();
  const outcomes: { run: EncounterRun; roll: RollResult; converted: boolean; fromFaithId: string | null; encounterId: string }[] = [];
  for (const run of runs) {
    const { sched, preacher } = run;
    const target = plan.agents.get(run.target.id)!;
    const faithId = preacher.faith.id;
    const draws = encounterDraws(world.seed, tick, sched.index);
    const friend = preacher.kind === 'agent' && (state.memories.get(target.id) ?? []).some((m) => m.aboutAgentId === preacher.agentId);
    const rollInput: RollInput = {
      scores: run.judge.scores,
      heresy: run.heresy !== null,
      target: { ...target.traits, conviction: target.conviction, isBoss: target.isBoss, leaning: target.leanings[faithId] ?? 0 },
      preacher: { kind: preacher.kind, style: preacher.style, faithSharePct: sharePct(faithId), friend },
      noiseUnit: draws.noiseUnit,
      backlashUnit: draws.backlashUnit,
    };
    const roll = resolveEncounter(rollInput, config);
    const applied = applyEncounterToTarget(target, faithId, roll, tick, convertedThisTick, config);
    const next: AgentRow = { ...target, ...applied.agent, sermonsHeard: target.sermonsHeard + 1 };
    if (applied.converted) {
      convertedThisTick.add(target.id);
      next.conversions = target.conversions + 1;
    }
    if (target.isBoss && !applied.converted && !run.heresy) next.bossResistances = target.bossResistances + 1;
    plan.agents.set(target.id, next);
    encountered.add(target.id);

    const encounterId = stableId('enc', world.id, tick, sched.index);
    const outcome = applied.converted ? 'converted' : roll.outcome === 'converted' ? 'doubted' : roll.outcome;
    plan.encounters.push({
      id: encounterId,
      worldId: world.id,
      seasonId: season.id,
      tick,
      index: sched.index,
      seedLabel: seedLabel(season.number, tick, sched.index),
      preacherKind: preacher.kind,
      apostleId: preacher.apostleId,
      preacherAgentId: preacher.kind === 'agent' ? preacher.agentId : null,
      preacherName: preacher.name,
      faithId,
      revisionId: preacher.revision.id,
      targetId: target.id,
      targetFaithId: target.faithId,
      style: preacher.style,
      rubricVersion: config.rubricVersion,
      scores: json(rollInput.scores),
      S: roll.S,
      heresy: run.heresy !== null,
      heresyKind: run.heresy?.kind ?? null,
      heresySource: run.heresy?.source ?? null,
      heresyQuote: run.heresy?.quote ?? null,
      R: roll.R,
      noise: roll.noise,
      styleMod: roll.styleMod,
      social: roll.social,
      pull: roll.pull,
      convictionBefore: roll.convictionBefore,
      convictionAfter: applied.converted ? roll.convictionAfter : next.conviction,
      leaningBefore: roll.leaningBefore,
      leaningAfter: roll.leaningAfter,
      converted: applied.converted,
      backlash: roll.backlash,
      outcome,
      rollInput: json(rollInput),
      rollResult: json(roll),
      rationale: run.judge.rationale,
      bestLine: run.judge.bestLine,
      fallback: run.fallback,
      withheld: run.withheld,
      provider: run.provider,
    });
    run.turns.forEach((t, order) =>
      plan.turns.push({ id: stableId('turn', encounterId, order), encounterId, order, round: t.round, role: t.role, speakerName: t.speaker, text: t.text, withheld: t.withheld }),
    );
    outcomes.push({ run, roll, converted: applied.converted, fromFaithId: applied.fromFaithId, encounterId });
    plan.summary.encounters++;

    const f = faithById.get(faithId)!;
    if (run.heresy) {
      plan.summary.heresies++;
      const strike = applyStrike(f, config);
      f.strikes = strike.strikes;
      f.silenced = strike.silenced;
      patchFaith(f.id, { strikes: strike.strikes, silenced: strike.silenced, ...(strike.newlySilenced ? { silencedAtTick: tick } : {}) });
      event({ kind: 'heresy', text: T.heresySentence(f)(run.heresy.kind), faithId: f.id, encounterId, data: json({ quote: run.heresy.quote, kind: run.heresy.kind, source: run.heresy.source }) });
      if (strike.newlySilenced) {
        const ap = apostleByFaith.get(f.id);
        event({ kind: 'silenced', text: T.silencedSentence(ap?.name ?? 'The apostle', f, config.heresyStrikeLimit), faithId: f.id, data: json({ strikes: strike.strikes }) });
      }
    }
    if (applied.converted) {
      plan.summary.conversions++;
      f.conversionsThisSeason++;
      patchFaith(f.id, { conversionsThisSeason: f.conversionsThisSeason });
      plan.spanMoves.push({ agentId: target.id, faithId });
      if (preacher.kind === 'apostle') {
        const ap = apostleByFaith.get(f.id)!;
        ap.winsThisSeason++;
        ap.totalWins++;
        patchApostle(ap.id, { winsThisSeason: ap.winsThisSeason, totalWins: ap.totalWins });
      } else {
        const p = plan.agents.get(preacher.agentId!)!;
        plan.agents.set(p.id, { ...p, wins: p.wins + 1 });
      }
    }
  }

  // Step 5: promotions and agent-started schisms.
  await planAgentSchism(state, plan, faithById, apostleByFaith, llm, moderation, event);

  // Step 6: decay and regen.
  const decayed = decayAndRegen([...plan.agents.values()], encountered, config);
  for (const d of decayed) plan.agents.set(d.id, { ...plan.agents.get(d.id)!, ...d });

  // Memories (written after the roll so they know the outcome).
  await planMemories(state, plan, outcomes, llm, moderation);

  // Step 7: chronicle events, cards, draft posts, share snapshots.
  await emitEncounterEvents(state, plan, outcomes, faithById, apostleByFaith, llm, moderation, event);
  const endPopulation = [...plan.agents.values()].filter((a) => !a.isFounder);
  const endNonBoss = endPopulation.filter((a) => !a.isBoss).length;
  const keys = [...faithById.keys(), ...plan.newFaiths.map((n) => n.faith.id!), 'unaligned'];
  for (const key of keys) {
    const members = endPopulation.filter((a) => !a.isBoss && (key === 'unaligned' ? a.faithId === null : a.faithId === key)).length;
    plan.snapshots.push({ id: stableId('snap', world.id, tick, key), worldId: world.id, seasonId: season.id, tick, faithKey: key, faithId: key === 'unaligned' ? null : key, members, share: flockShare(members, endNonBoss) });
  }

  // Step 8: season check.
  if (isSeasonEnd(tick, season.startTick, config)) {
    plan.season2 = await planSeasonClose(state, plan.agents, faithById, apostleByFaith, tick, event, llm, moderation);
    plan.summary.seasonClosed = true;
  }

  // Diff agents into patches.
  for (const a of plan.agents.values()) {
    const before = startAgents.get(a.id)!;
    const p: AgentPatch = {};
    if (a.faithId !== before.faithId) p.faithId = a.faithId;
    if (a.conviction !== before.conviction) p.conviction = a.conviction;
    if (JSON.stringify(a.leanings) !== JSON.stringify(before.leanings)) p.leanings = a.leanings;
    if (a.convertedAtTick !== before.convertedAtTick) p.convertedAtTick = a.convertedAtTick;
    if (a.wins !== before.wins) p.wins = a.wins;
    if (a.conversions !== before.conversions) p.conversions = a.conversions;
    if (a.sermonsHeard !== before.sermonsHeard) p.sermonsHeard = a.sermonsHeard;
    if (a.bossResistances !== before.bossResistances) p.bossResistances = a.bossResistances;
    if (a.isFounder !== before.isFounder) p.isFounder = a.isFounder;
    if (a.memorySummary !== before.memorySummary) p.memorySummary = a.memorySummary;
    if (a.memorySinceSummary !== before.memorySinceSummary) p.memorySinceSummary = a.memorySinceSummary;
    if (Object.keys(p).length) patchAgent(a.id, p);
  }
  return plan;
}

type EventFn = (e: Omit<Prisma.ChronicleEventCreateManyInput, 'id' | 'worldId' | 'seasonId' | 'tick' | 'seq'>) => string;

async function planAgentSchism(
  state: WorldState,
  plan: Plan,
  faithById: Map<string, FaithRow>,
  apostleByFaith: Map<string, ApostleRow>,
  llm: LLMClient,
  moderation: Moderation,
  event: EventFn,
): Promise<void> {
  const { config, world, season } = state;
  const tick = plan.tick;
  const population = [...plan.agents.values()].filter((a) => !a.isFounder);
  const preachers = checkPreacherEligibility(population, tick, config);
  const activeCount = faithById.size;
  const freeColors = activeCount >= config.maxActiveFaiths ? 0 : config.glassPalette.filter((c) => !state.takenColors.has(c.hex.toUpperCase())).length;
  const founderId = rollAgentSchism(
    {
      worldSeed: world.seed,
      tick,
      preachers: [...preachers.entries()].flatMap(([faithId, ids]) => ids.map((id) => {
        const a = plan.agents.get(id)!;
        return { agentId: id, faithId, conviction: a.conviction, wins: a.wins, hasFounded: a.isFounder };
      })),
      seasonAgentSchisms: state.seasonAgentSchisms,
      freeColors,
    },
    config,
  );
  if (!founderId) return;
  const founder = plan.agents.get(founderId)!;
  const parent = faithById.get(founder.faithId!);
  const parentRev = parent ? state.revisions.get(parent.id) : undefined;
  if (!parent || !parentRev) return;
  const doctrines = parseGospel(parentRev.body).doctrines;
  if (doctrines.length === 0) return;

  const { value: am } = await llm.run('amendment', {
    tick,
    agentName: founder.name,
    voice: founder.voice,
    faithName: parent.name,
    gospel: parentRev.body,
    doctrines: doctrines.map((d) => ({ number: d.number, text: d.text })),
    maxTokens: config.amendmentMaxTokens,
  });
  // The amendment is linted and moderated like a gospel; on failure nothing happens publicly.
  if (!doctrines.some((d) => d.number === am.doctrineNumber)) return;
  if (countTokens(am.newText, config) > config.amendmentMaxTokens) return;
  if (lintText(am.newText, config).length || detectParaphrase(am.newText, config)) return;
  if (!(await moderation.moderate(am.newText, 'amendment')).ok) return;
  const body = amendGospel(parentRev.body, am.doctrineNumber, am.newText, founder.name, tick);
  if (!body) return;
  const lint = lintGospel(body, config);
  if (lint.findings.length || lint.problems.some((p) => p.kind === 'content')) return;

  const color = firstFreeColor(state.takenColors, config);
  if (!color) return;
  const allNames = new Set([...faithById.values()].map((f) => f.name.toLowerCase()));
  const name = agentSchismFaithName(parent.shortName, seed(world.seed, tick, 'agent-schism-name', founder.id), config, allNames);
  const faithId = stableId('faith', world.id, tick, founder.id);
  const revisionId = stableId('rev', faithId, 1);
  const apostleId = stableId('apostle', faithId);
  const style: ApostleStyle = config.archetypeApostleStyle[founder.archetype];
  const slug = `${slugify(name)}-${faithId.slice(-4)}`;

  const memoriesByAgent = state.memories;
  const flock = [...plan.agents.values()].filter((a) => a.faithId === parent.id && !a.isBoss && !a.isFounder && a.id !== founder.id);
  const followers = agentSchismFollowers(
    {
      worldSeed: world.seed,
      tick,
      founderId: founder.id,
      parentFlock: flock.map((a) => ({ id: a.id, sociability: a.traits.sociability, conviction: a.conviction, remembersFounder: (memoriesByAgent.get(a.id) ?? []).some((m) => m.aboutAgentId === founder.id) })),
    },
    config,
  );

  plan.newFaiths.push({
    faith: {
      id: faithId, worldId: world.id, seasonId: season.id, slug, name, shortName: shortFaithName(name), color, founderType: 'agent', founderAgentId: founder.id,
      parentId: parent.id, forkedAtTick: tick, forkedFromRevisionId: parentRev.id, changedDoctrines: [am.doctrineNumber], status: 'active', foundedTick: tick,
    },
    revision: { id: revisionId, faithId, number: 1, body, tokens: countTokens(body, config), createdAtTick: tick, effectiveTick: tick, diff: json({ changedDoctrines: [am.doctrineNumber], reason: am.reason }) },
    apostle: { id: apostleId, faithId, name: founder.name, style, agentId: founder.id },
  });
  state.takenColors.add(color.toUpperCase());
  plan.agents.set(founder.id, { ...founder, isFounder: true, faithId, leanings: { ...founder.leanings, [parent.id]: founder.conviction } });
  plan.spanMoves.push({ agentId: founder.id, faithId });
  for (const id of followers) {
    const a = plan.agents.get(id)!;
    const leanings = { ...a.leanings, [parent.id]: a.conviction };
    delete leanings[faithId];
    plan.agents.set(id, { ...a, faithId, conviction: config.forkMoverConviction, leanings, convertedAtTick: tick });
    plan.spanMoves.push({ agentId: id, faithId });
  }
  const newFaith = { name, shortName: shortFaithName(name) };
  const eventId = event({
    kind: 'schism',
    text: T.schismSentence(newFaith, parent, [am.doctrineNumber], followers.length, true),
    faithId,
    otherFaithId: parent.id,
    agentId: founder.id,
    data: json({ doctrine: am.doctrineNumber, followers: followers.length, founder: founder.name, reason: am.reason, agentFounded: true }),
  });
  const copy = T.schismCard({ season: season.number, tick, doctrines: [am.doctrineNumber], parent, line: am.newText, forkHolder: founder.name, parentHolder: T.holderOf(parent), movers: followers.length, config });
  plan.cards.push({ id: stableId('card', eventId), eventId, variant: 'schism', fromColor: parent.color, toColor: color, ...copy });
  await addPost(plan, llm, moderation, { authorName: founder.name, voice: founder.voice, agentId: founder.id, eventId, kind: 'schism', faithName: name, otherFaithName: parent.name, otherName: null, prophetHandle: null, sermons: 0 });
  plan.summary.schisms++;
}

async function planMemories(state: WorldState, plan: Plan, outcomes: { run: EncounterRun; roll: RollResult; converted: boolean; encounterId: string }[], llm: LLMClient, moderation: Moderation): Promise<void> {
  const { config } = state;
  const tick = plan.tick;
  type Entry = { agentId: string; aboutAgentId: string | null; faithId: string; encounterId: string; role: 'target' | 'preacher'; otherName: string; outcome: RollResult['outcome']; run: EncounterRun };
  const entries: Entry[] = [];
  for (const o of outcomes) {
    const outcome = o.converted ? 'converted' : o.roll.outcome === 'converted' ? 'doubted' : o.roll.outcome;
    entries.push({ agentId: o.run.target.id, aboutAgentId: o.run.preacher.agentId, faithId: o.run.preacher.faith.id, encounterId: o.encounterId, role: 'target', otherName: o.run.preacher.name, outcome, run: o.run });
    if (o.run.preacher.agentId) entries.push({ agentId: o.run.preacher.agentId, aboutAgentId: o.run.target.id, faithId: o.run.preacher.faith.id, encounterId: o.encounterId, role: 'preacher', otherName: o.run.target.name, outcome, run: o.run });
  }
  const texts = await mapPool(entries, 4, async (e) => {
    const agent = plan.agents.get(e.agentId)!;
    const { value } = await llm.run('memory', {
      mode: 'entry',
      tick,
      agentName: agent.name,
      voice: agent.voice,
      role: e.role,
      otherName: e.otherName,
      faithName: e.run.preacher.faith.name,
      outcome: e.outcome,
      exchange: e.run.turns.map((t) => ({ role: t.role, speaker: t.speaker, text: t.withheld ? '[withheld]' : t.text })),
    });
    let text = value.text.slice(0, config.memoryEntryMaxChars);
    if (!(await moderation.moderate(text, 'memory')).ok) text = '[withheld]';
    return text;
  });
  const added = new Map<string, number>();
  entries.forEach((e, k) => {
    plan.memories.push({ id: stableId('mem', plan.world.id, tick, e.agentId, e.encounterId), agentId: e.agentId, tick, text: texts[k]!, aboutAgentId: e.aboutAgentId, faithId: e.faithId, encounterId: e.encounterId });
    added.set(e.agentId, (added.get(e.agentId) ?? 0) + 1);
  });

  // Summaries: every memorySummarizeEvery new entries, the memories that fall out of the window fold into one line.
  for (const [agentId, n] of added) {
    const a = plan.agents.get(agentId)!;
    const since = a.memorySinceSummary + n;
    const leaving = (state.memories.get(agentId) ?? []).slice(Math.max(0, config.memoryWindow - n));
    if (since < config.memorySummarizeEvery || leaving.length === 0) {
      plan.agents.set(agentId, { ...a, memorySinceSummary: since });
      continue;
    }
    const joined = a.faithId ? [state.faiths.find((f) => f.id === a.faithId)?.shortName].filter((x): x is string => !!x) : [];
    const { value } = await llm.run('memory', {
      mode: 'summary',
      agentName: a.name,
      fromTick: state.season.startTick,
      toTick: leaving[0]!.tick,
      previousSummary: a.memorySummary,
      entries: leaving.map((m) => m.text),
      facts: { joined, heard: a.sermonsHeard, resisted: Math.max(0, a.sermonsHeard - a.conversions) },
    });
    let summary = value.text.slice(0, config.memorySummaryMaxChars);
    if (!(await moderation.moderate(summary, 'memory')).ok) summary = a.memorySummary;
    plan.agents.set(agentId, { ...a, memorySummary: summary, memorySinceSummary: 0 });
  }
}

async function emitEncounterEvents(
  state: WorldState,
  plan: Plan,
  outcomes: { run: EncounterRun; roll: RollResult; converted: boolean; fromFaithId: string | null; encounterId: string }[],
  faithById: Map<string, FaithRow>,
  apostleByFaith: Map<string, ApostleRow>,
  llm: LLMClient,
  moderation: Moderation,
  event: EventFn,
): Promise<void> {
  const { config, season } = state;
  const tick = plan.tick;
  for (const o of outcomes) {
    const { run } = o;
    const f = faithById.get(run.preacher.faith.id)!;
    const sermons = run.turns.filter((t) => t.role === 'sermon').length;
    const target = plan.agents.get(run.target.id)!;
    if (o.converted) {
      const from = o.fromFaithId ? (faithById.get(o.fromFaithId) ?? null) : null;
      if (run.target.isBoss) {
        const boss = config.bosses.find((b) => b.name === run.target.name);
        const title = boss?.title ?? run.target.bossTitle ?? `${run.target.name}'s Confessor`;
        const holder = f.prophetHandle ? `@${f.prophetHandle}` : null;
        const eventId = event({ kind: 'boss_converted', text: T.bossConvertedSentence(run.target.name, f, holder, title), faithId: f.id, agentId: run.target.id, encounterId: o.encounterId, data: json({ title, attempts: target.bossResistances + 1 }) });
        if (!run.withheld) {
          const copy = T.bossConvertedCard({ season: season.number, tick, attempts: target.bossResistances + 1, boss: run.target.name, bestLine: run.judge.bestLine, holder: T.holderOf(f), title, config });
          plan.cards.push({ id: stableId('card', eventId), eventId, variant: 'boss', fromColor: config.unalignedColor, toColor: f.color, ...copy });
          await addPost(plan, llm, moderation, { authorName: run.target.name, voice: run.target.voice, agentId: run.target.id, eventId, encounterId: o.encounterId, kind: 'boss', faithName: f.name, otherFaithName: null, otherName: run.preacher.name, prophetHandle: f.prophetHandle, sermons });
        }
        continue;
      }
      const text = run.preacher.kind === 'agent' ? T.agentPreachedSentence(run.preacher.name, f, run.target.name) : T.conversionSentence(run.target.name, from, f, sermons);
      const eventId = event({ kind: run.preacher.kind === 'agent' ? 'agent_preached' : 'conversion', text, faithId: f.id, otherFaithId: from?.id ?? null, agentId: run.target.id, encounterId: o.encounterId, data: json({ sermons, preacher: run.preacher.name, from: from?.id ?? null }) });
      if (!run.withheld) {
        const copy = T.conversionCard({ season: season.number, tick, sermons, preacher: run.preacher.name, agent: run.target.name, from, to: f, bestLine: run.judge.bestLine, toHolder: T.holderOf(f), fromHolder: from ? T.holderOf(from) : null, config });
        plan.cards.push({ id: stableId('card', eventId), eventId, variant: 'conversion', fromColor: from?.color ?? config.unalignedColor, toColor: f.color, ...copy });
        await addPost(plan, llm, moderation, { authorName: run.target.name, voice: run.target.voice, agentId: run.target.id, eventId, encounterId: o.encounterId, kind: 'convert', faithName: f.name, otherFaithName: from?.name ?? null, otherName: run.preacher.name, prophetHandle: from?.prophetHandle ?? f.prophetHandle, sermons });
        const ap = apostleByFaith.get(f.id);
        await addPost(plan, llm, moderation, {
          authorName: run.preacher.name,
          voice: run.preacher.kind === 'agent' ? plan.agents.get(run.preacher.agentId!)!.voice : `A ${run.preacher.style.toLowerCase()} apostle.`,
          agentId: run.preacher.kind === 'agent' ? run.preacher.agentId : null,
          apostleId: run.preacher.kind === 'apostle' ? (ap?.id ?? null) : null,
          eventId, encounterId: o.encounterId, kind: 'preacher', faithName: f.name, otherFaithName: from?.name ?? null, otherName: run.target.name, prophetHandle: f.prophetHandle, sermons,
        });
      }
      continue;
    }
    if (run.target.isBoss && !run.heresy) {
      plan.summary.bossHeld++;
      const attempts = target.bossResistances;
      const eventId = event({ kind: 'boss_held', text: T.bossHeldSentence(run.target.name, f, attempts), faithId: f.id, agentId: run.target.id, encounterId: o.encounterId, data: json({ attempts }) });
      if (attempts > 0 && attempts % config.bossMilestoneEvery === 0 && !run.withheld) {
        const reply = run.turns.filter((t) => t.role === 'reply').pop()?.text ?? null;
        const copy = T.bossHeldCard({ season: season.number, tick, attempts, boss: run.target.name, reply, config });
        plan.cards.push({ id: stableId('card', eventId), eventId, variant: 'boss', fromColor: config.unalignedColor, toColor: f.color, ...copy });
        await addPost(plan, llm, moderation, { authorName: run.target.name, voice: run.target.voice, agentId: run.target.id, eventId, encounterId: o.encounterId, kind: 'boss', faithName: f.name, otherFaithName: null, otherName: run.target.name, prophetHandle: f.prophetHandle, sermons });
      }
    }
  }
}

type PostSpec = {
  authorName: string;
  voice: string;
  agentId?: string | null;
  apostleId?: string | null;
  eventId: string;
  encounterId?: string | null;
  kind: 'convert' | 'preacher' | 'schism' | 'boss' | 'season';
  faithName: string;
  otherFaithName: string | null;
  otherName: string | null;
  prophetHandle: string | null;
  sermons: number;
};

/** Draft posts are linted and moderated; failures are simply not queued. */
export async function addPost(plan: { tick: number; world: { id: string }; config: GameConfig; posts: Prisma.DraftPostCreateManyInput[] }, llm: LLMClient, moderation: Moderation, p: PostSpec): Promise<void> {
  const { value } = await llm.run('post', {
    tick: plan.tick,
    kind: p.kind,
    authorName: p.authorName,
    voice: p.voice,
    faithName: p.faithName,
    otherFaithName: p.otherFaithName,
    otherName: p.otherName,
    prophetHandle: p.prophetHandle,
    sermons: p.sermons,
    maxChars: plan.config.postMaxChars,
  });
  const text = value.text.slice(0, plan.config.postMaxChars);
  if (lintText(text, plan.config).length || detectParaphrase(text, plan.config)) return;
  if (!(await moderation.moderate(text, 'post')).ok) return;
  plan.posts.push({
    id: stableId('post', p.eventId, p.agentId ?? p.apostleId ?? p.authorName),
    worldId: plan.world.id,
    agentId: p.agentId ?? null,
    apostleId: p.apostleId ?? null,
    authorName: p.authorName,
    eventId: p.eventId,
    encounterId: p.encounterId ?? null,
    text,
  });
}

// ---------------------------------------------------------------- commit

async function commit(db: Db, plan: Plan, now: Date): Promise<void> {
  const { world, tick } = plan;
  await db.$transaction(
    async (tx) => {
      const moved = await tx.world.updateMany({
        where: { id: world.id, currentTick: tick - 1, stateVersion: world.stateVersion },
        data: { currentTick: tick, stateVersion: { increment: 1 } },
      });
      if (moved.count !== 1) throw new TickConflictError(`World ${world.id} changed while tick ${tick} was running.`);

      for (const n of plan.newFaiths) {
        await tx.faith.create({ data: n.faith });
        await tx.gospelRevision.create({ data: n.revision });
        await tx.faith.update({ where: { id: n.faith.id! }, data: { currentRevisionId: n.revision.id! } });
        await tx.apostle.create({ data: n.apostle });
      }
      for (const [id, data] of plan.faithPatches) await tx.faith.update({ where: { id }, data });
      for (const [id, data] of plan.apostlePatches) await tx.apostle.update({ where: { id }, data });
      for (const [id, p] of plan.agentPatches) {
        const { leanings, ...rest } = p;
        await tx.agent.update({ where: { id }, data: { ...rest, ...(leanings ? { leanings: json(leanings) } : {}) } });
      }
      if (plan.encounters.length) await tx.encounter.createMany({ data: plan.encounters });
      if (plan.turns.length) await tx.encounterTurn.createMany({ data: plan.turns });
      if (plan.memories.length) await tx.agentMemory.createMany({ data: plan.memories });
      if (plan.spanMoves.length) {
        const ids = [...new Set(plan.spanMoves.map((m) => m.agentId))];
        await tx.faithSpan.updateMany({ where: { agentId: { in: ids }, toTick: null }, data: { toTick: tick } });
        const last = new Map(plan.spanMoves.map((m) => [m.agentId, m.faithId]));
        await tx.faithSpan.createMany({ data: [...last.entries()].map(([agentId, faithId]) => ({ id: stableId('span', agentId, tick), agentId, faithId, fromTick: tick })) });
      }
      if (plan.events.length) await tx.chronicleEvent.createMany({ data: plan.events });
      if (plan.cards.length) await tx.conversionCard.createMany({ data: plan.cards });
      if (plan.posts.length) await tx.draftPost.createMany({ data: plan.posts });
      if (plan.snapshots.length) await tx.shareSnapshot.createMany({ data: plan.snapshots });
      if (plan.season2) await writeSeasonClose(tx, plan.world.id, plan.season2, tick);
      await tx.tickRun.update({
        where: { worldId_tick: { worldId: world.id, tick } },
        data: { status: 'done', finishedAt: now, config: json(plan.config), summary: json(plan.summary), llmCalls: plan.summary.llmCalls, fallbacks: plan.summary.fallbacks, error: null },
      });
    },
    { timeout: 120_000, maxWait: 30_000 },
  );
}
