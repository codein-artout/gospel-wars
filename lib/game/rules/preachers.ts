import type { GameConfig } from '../config';
import type { AgentState } from '../types';

/** Can this agent preach at all (before the per-faith cap)? GAME.md §8. */
export function isEligiblePreacher(a: AgentState, tick: number, config: GameConfig): boolean {
  return (
    a.faithId !== null &&
    !a.isBoss &&
    !a.isFounder &&
    a.convertedAtTick !== null &&
    a.conviction >= config.preacherMinConviction &&
    tick - a.convertedAtTick >= config.preacherCooldownTicks
  );
}

/**
 * Active preachers per faith: eligible converts, at most maxPreachersPerFaith per faith,
 * highest conviction first, ties broken by id.
 */
export function checkPreacherEligibility(agents: AgentState[], tick: number, config: GameConfig): Map<string, string[]> {
  const byFaith = new Map<string, AgentState[]>();
  for (const a of agents) {
    if (!isEligiblePreacher(a, tick, config)) continue;
    const list = byFaith.get(a.faithId!) ?? [];
    list.push(a);
    byFaith.set(a.faithId!, list);
  }
  const out = new Map<string, string[]>();
  for (const [faithId, list] of [...byFaith.entries()].sort((x, y) => (x[0] < y[0] ? -1 : 1))) {
    list.sort((x, y) => y.conviction - x.conviction || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
    out.set(faithId, list.slice(0, config.maxPreachersPerFaith).map((a) => a.id));
  }
  return out;
}
