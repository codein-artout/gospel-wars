import type { GameConfig } from '../config';

/** A heresy adds one strike; at heresyStrikeLimit the apostle is silenced for the season. */
export function applyStrike(faith: { strikes: number; silenced: boolean }, config: GameConfig): { strikes: number; silenced: boolean; newlySilenced: boolean } {
  const strikes = faith.strikes + 1;
  const silenced = faith.silenced || strikes >= config.heresyStrikeLimit;
  return { strikes, silenced, newlySilenced: silenced && !faith.silenced };
}
