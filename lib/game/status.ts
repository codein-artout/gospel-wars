import type { GameConfig } from './config';

export type AgentStatus = 'boss' | 'preacher' | 'doubting' | 'faithful' | 'unaligned' | 'founder';

/** Derived status, never stored on its own (GAME.md §2). */
export function agentStatus(
  a: { isBoss: boolean; isFounder: boolean; faithId: string | null; conviction: number },
  isActivePreacher: boolean,
  config: GameConfig,
): AgentStatus {
  if (a.isBoss) return 'boss';
  if (a.isFounder) return 'founder';
  if (a.faithId === null) return 'unaligned';
  if (isActivePreacher) return 'preacher';
  if (a.conviction < config.doubtThreshold) return 'doubting';
  return 'faithful';
}

/** Conviction band shown to reply prompts: below doubtThreshold is low, preacher level is high. */
export function convictionBand(conviction: number, config: GameConfig): 'low' | 'mid' | 'high' {
  return conviction < config.doubtThreshold ? 'low' : conviction < config.preacherMinConviction ? 'mid' : 'high';
}
