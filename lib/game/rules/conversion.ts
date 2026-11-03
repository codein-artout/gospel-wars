import type { GameConfig } from '../config';
import type { AgentState } from '../types';
import { clamp100 } from './encounter';
import type { RollResult } from './encounter';

/** Writes a roll's conviction and leaning onto the agent (no conversion). */
export function applyRoll(agent: AgentState, preacherFaithId: string, roll: RollResult): AgentState {
  return {
    ...agent,
    conviction: roll.convictionAfter,
    leanings: { ...agent.leanings, [preacherFaithId]: roll.leaningAfter },
  };
}

/**
 * Conversion (GAME.md §7): new conviction = round(leaning × convertCarry); the old faith's
 * leaning becomes the old conviction; the new faith's leaning is cleared; convertedAtTick set.
 */
export function applyConversion(agent: AgentState, toFaithId: string, tick: number, config: GameConfig): AgentState {
  const leaning = agent.leanings[toFaithId] ?? 0;
  const leanings = { ...agent.leanings };
  delete leanings[toFaithId];
  if (agent.faithId !== null) leanings[agent.faithId] = clamp100(agent.conviction);
  return {
    ...agent,
    faithId: toFaithId,
    conviction: clamp100(Math.round(leaning * config.convertCarry)),
    leanings,
    convertedAtTick: tick,
  };
}

export type EncounterApplication = { agent: AgentState; converted: boolean; fromFaithId: string | null };

/**
 * Applies one resolved encounter to its target. `convertedThisTick` enforces at most one
 * conversion per agent per tick: a second qualifying roll only moves conviction and leaning.
 */
export function applyEncounterToTarget(
  agent: AgentState,
  preacherFaithId: string,
  roll: RollResult,
  tick: number,
  convertedThisTick: ReadonlySet<string>,
  config: GameConfig,
): EncounterApplication {
  const rolled = applyRoll(agent, preacherFaithId, roll);
  if (roll.converts && !convertedThisTick.has(agent.id) && agent.faithId !== preacherFaithId) {
    return { agent: applyConversion(rolled, preacherFaithId, tick, config), converted: true, fromFaithId: agent.faithId };
  }
  return { agent: rolled, converted: false, fromFaithId: agent.faithId };
}
