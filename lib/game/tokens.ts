import type { GameConfig } from './config';

/** Deterministic token estimate, ceil(chars / charsPerToken), counting code points. Same on client and server. */
export function countTokens(text: string, config: Pick<GameConfig, 'charsPerToken'>): number {
  const chars = [...text].length;
  return Math.ceil(chars / config.charsPerToken);
}

export function formatCount(n: number): string {
  return n.toLocaleString('en-US');
}
