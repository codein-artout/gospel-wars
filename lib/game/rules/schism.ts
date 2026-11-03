import type { GameConfig } from '../config';
import { seed } from '../rng';

/**
 * Human fork schism pull (GAME.md §9): each parent member with conviction below
 * schismPullConviction joins the fork with forkPullChance, at most forkMaxPullRatio of the flock.
 */
export function schismPull(
  input: { worldSeed: string; tick: number; forkFaithId: string; parentFlock: { id: string; conviction: number }[] },
  config: GameConfig,
): { movers: string[]; cap: number; moverConviction: number } {
  const flock = [...input.parentFlock].sort((a, b) => (a.id < b.id ? -1 : 1));
  const cap = Math.floor(config.forkMaxPullRatio * flock.length);
  const candidates = flock.filter(
    (a) => a.conviction < config.schismPullConviction && seed(input.worldSeed, input.tick, 'schism-pull', input.forkFaithId, a.id).chance(config.forkPullChance),
  );
  let movers = candidates.map((a) => a.id);
  if (movers.length > cap) movers = seed(input.worldSeed, input.tick, 'schism-pull-order', input.forkFaithId).shuffle(movers).slice(0, cap).sort();
  return { movers, cap, moverConviction: config.forkMoverConviction };
}

export type SchismCandidate = { agentId: string; faithId: string; conviction: number; wins: number; hasFounded: boolean };

/**
 * Agent-started schism roll (GAME.md §10). At most one per tick: candidates roll in id order,
 * the first success triggers.
 */
export function rollAgentSchism(
  input: { worldSeed: string; tick: number; preachers: SchismCandidate[]; seasonAgentSchisms: number; freeColors: number },
  config: GameConfig,
): string | null {
  if (input.seasonAgentSchisms >= config.maxAgentSchismsPerSeason || input.freeColors <= 0) return null;
  const eligible = input.preachers
    .filter((p) => p.conviction >= config.agentSchismMinConviction && p.wins >= config.agentSchismMinWins && !p.hasFounded)
    .sort((a, b) => (a.agentId < b.agentId ? -1 : 1));
  for (const p of eligible) {
    if (seed(input.worldSeed, input.tick, 'agent-schism', p.agentId).chance(config.agentSchismChance)) return p.agentId;
  }
  return null;
}

/** Followers of an agent schism: sociable, low-conviction members who remember the founder. */
export function agentSchismFollowers(
  input: { worldSeed: string; tick: number; founderId: string; parentFlock: { id: string; sociability: number; conviction: number; remembersFounder: boolean }[] },
  config: GameConfig,
): string[] {
  return [...input.parentFlock]
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .filter(
      (a) =>
        a.id !== input.founderId &&
        a.sociability >= config.agentSchismFollowSociability &&
        a.conviction < config.agentSchismFollowConviction &&
        a.remembersFounder &&
        seed(input.worldSeed, input.tick, 'agent-schism-follow', input.founderId, a.id).chance(config.agentSchismFollowChance),
    )
    .map((a) => a.id);
}

/** First free palette color, in palette order (agent schisms and the Narthex). */
export function firstFreeColor(takenHexes: Iterable<string>, config: GameConfig): string | null {
  const taken = new Set([...takenHexes].map((h) => h.toUpperCase()));
  return config.glassPalette.find((c) => !taken.has(c.hex.toUpperCase()))?.hex ?? null;
}
