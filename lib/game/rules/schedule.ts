import type { ApostleStyle, GameConfig } from '../config';
import { seed } from '../rng';

export type ScheduleAgent = { id: string; faithId: string | null; conviction: number; isBoss: boolean };
export type ScheduleApostle = { id: string; faithId: string; style: ApostleStyle; silenced: boolean };
export type SchedulePreacher = { agentId: string; faithId: string; style: ApostleStyle };

export type ScheduledPreacher =
  | { kind: 'apostle'; id: string; faithId: string; style: ApostleStyle }
  | { kind: 'agent'; id: string; faithId: string; style: ApostleStyle };

export type ScheduledEncounter = {
  /** 1-based position in the final schedule. */
  index: number;
  preacher: ScheduledPreacher;
  targetId: string;
  weight: number;
  boss: boolean;
};

export type ScheduleInput = {
  worldSeed: string;
  tick: number;
  agents: ScheduleAgent[];
  apostles: ScheduleApostle[];
  preachers: SchedulePreacher[];
  /** Pairs that met within pairCooldownTicks, as pairKey(preacherId, targetId). */
  recentPairs: ReadonlySet<string>;
};

export function pairKey(preacherId: string, targetId: string): string {
  return `${preacherId}>${targetId}`;
}

/** Target weight for a preacher of faith F (GAME.md §5). Bosses are only reached through the boss slot. */
export function targetWeight(target: ScheduleAgent, faithId: string, config: GameConfig): number {
  if (target.isBoss) return 0;
  if (target.faithId === faithId) return config.targetWeights.own;
  if (target.faithId === null) return config.targetWeights.unaligned;
  if (target.conviction < config.doubtThreshold) return config.targetWeights.doubting;
  return config.targetWeights.faithful;
}

const byId = <T extends { id: string }>(a: T, b: T) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Deterministic encounter schedule for a tick. */
export function scheduleEncounters(input: ScheduleInput, config: GameConfig): ScheduledEncounter[] {
  const rng = seed(input.worldSeed, input.tick, 'schedule');
  const agents = [...input.agents].sort(byId);
  const targetCount = new Map<string, number>();
  const draft: Omit<ScheduledEncounter, 'index'>[] = [];

  const available = (a: ScheduleAgent, preacherId: string) =>
    a.id !== preacherId &&
    (targetCount.get(a.id) ?? 0) < config.maxEncountersPerAgentPerTick &&
    !input.recentPairs.has(pairKey(preacherId, a.id));

  const take = (preacher: ScheduledPreacher, target: ScheduleAgent, weight: number, boss: boolean) => {
    targetCount.set(target.id, (targetCount.get(target.id) ?? 0) + 1);
    draft.push({ preacher, targetId: target.id, weight, boss });
  };

  const drawWeighted = (preacher: ScheduledPreacher, count: number) => {
    const chosen = new Set<string>();
    for (let k = 0; k < count; k++) {
      const pool = agents.filter((a) => !chosen.has(a.id) && available(a, preacher.id));
      const weights = pool.map((a) => targetWeight(a, preacher.faithId, config));
      const i = rng.weightedIndex(weights);
      if (i === null) break;
      const t = pool[i]!;
      chosen.add(t.id);
      take(preacher, t, weights[i]!, false);
    }
  };

  for (const ap of [...input.apostles].sort(byId)) {
    // A silenced apostle still consumes its draws so other apostles' schedules don't shift.
    const n = config.apostleStyles[ap.style].encountersPerTick;
    const bossSlot = rng.chance(config.bossTargetChance);
    if (ap.silenced || n === 0) continue;
    const preacher: ScheduledPreacher = { kind: 'apostle', id: ap.id, faithId: ap.faithId, style: ap.style };
    let remaining = n;
    if (bossSlot) {
      const bosses = agents.filter((a) => a.isBoss && a.faithId !== ap.faithId && available(a, ap.id));
      if (bosses.length > 0) {
        take(preacher, rng.pick(bosses), config.targetWeights.faithful, true);
        remaining--;
      }
    }
    drawWeighted(preacher, remaining);
  }

  for (const p of [...input.preachers].sort((a, b) => (a.agentId < b.agentId ? -1 : a.agentId > b.agentId ? 1 : 0))) {
    if (!rng.chance(config.preachChance)) continue;
    drawWeighted({ kind: 'agent', id: p.agentId, faithId: p.faithId, style: p.style }, 1);
  }

  // Cap the total: drop overflow lowest-weight first, ties in seeded order.
  let kept = draft.map((e, i) => ({ e, i, key: rng.next() }));
  if (kept.length > config.maxEncountersPerTick) {
    const ranked = [...kept].sort((a, b) => b.e.weight - a.e.weight || a.key - b.key);
    const keep = new Set(ranked.slice(0, config.maxEncountersPerTick).map((x) => x.i));
    kept = kept.filter((x) => keep.has(x.i));
  }
  return kept.map((x, k) => ({ ...x.e, index: k + 1 }));
}
