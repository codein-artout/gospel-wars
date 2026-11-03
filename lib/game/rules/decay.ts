import type { GameConfig } from '../config';
import type { AgentState } from '../types';
import { clamp100 } from './encounter';

/**
 * End-of-tick drift (GAME.md §2): every leaning except the current faith's decays by
 * leaningDecay (floored at 0, dropped at 0); an agent in a faith with no encounter this tick
 * regains convictionRegen (capped at 100).
 */
export function decayAndRegen(agents: AgentState[], encountered: ReadonlySet<string>, config: GameConfig): AgentState[] {
  return agents.map((a) => {
    const leanings: Record<string, number> = {};
    for (const [faithId, v] of Object.entries(a.leanings)) {
      if (faithId === a.faithId) continue;
      const next = Math.max(0, v - config.leaningDecay);
      if (next > 0) leanings[faithId] = next;
    }
    const regen = a.faithId !== null && !a.isBoss && !encountered.has(a.id);
    return { ...a, leanings, conviction: regen ? clamp100(a.conviction + config.convictionRegen) : a.conviction };
  });
}
