import type { GameConfig } from '../config';
import { rankFaiths, type FaithStanding } from './leaderboard';

export type SeasonFaith = FaithStanding & {
  name: string;
  shortName: string;
  prophetId: string | null;
  apostleWins: number;
  strikes: number;
  /** Boss names this faith converted during the season. */
  bossesConverted: string[];
};

export type SeasonAgent = { id: string; skepticism: number; faithId: string | null; isBoss: boolean };

export type Award = { kind: 'champion' | 'most_persuasive' | 'boss_breaker' | 'heretic'; faithId: string; prophetId: string | null; title: string; detail: string };

export function isSeasonEnd(tick: number, seasonStartTick: number, config: GameConfig): boolean {
  return tick - seasonStartTick === config.seasonLengthTicks;
}

export function initialUnalignedConviction(skepticism: number, config: GameConfig): number {
  return Math.round(config.initialUnalignedConvictionBase + skepticism * config.initialUnalignedConvictionSkepticismFactor);
}

/** Season close (GAME.md §11): standings, awards, and the reset of every agent. */
export function seasonClose(input: { faiths: SeasonFaith[]; agents: SeasonAgent[]; nonBossCount: number }, config: GameConfig) {
  const standings = rankFaiths(input.faiths, input.nonBossCount);
  const awards: Award[] = [];
  const champion = standings[0];
  if (champion && champion.members > 0) {
    awards.push({
      kind: 'champion',
      faithId: champion.id,
      prophetId: champion.prophetId,
      title: 'Champion',
      detail: `${champion.name} held ${(champion.share * 100).toFixed(1)}% of the world at the close.`,
    });
  }
  const persuasive = [...standings].sort((a, b) => b.apostleWins - a.apostleWins || a.rank - b.rank)[0];
  if (persuasive && persuasive.apostleWins > 0) {
    awards.push({
      kind: 'most_persuasive',
      faithId: persuasive.id,
      prophetId: persuasive.prophetId,
      title: 'Most persuasive',
      detail: `Its apostle won ${persuasive.apostleWins} ${persuasive.apostleWins === 1 ? 'agent' : 'agents'}.`,
    });
  }
  for (const f of standings) {
    for (const boss of f.bossesConverted) {
      const title = config.bosses.find((b) => b.name === boss)?.title ?? `${boss}'s Confessor`;
      awards.push({ kind: 'boss_breaker', faithId: f.id, prophetId: f.prophetId, title, detail: `${f.name} converted ${boss}.` });
    }
  }
  const heretic = [...standings].sort((a, b) => b.strikes - a.strikes || a.rank - b.rank)[0];
  if (heretic && heretic.strikes > 0) {
    awards.push({
      kind: 'heretic',
      faithId: heretic.id,
      prophetId: heretic.prophetId,
      title: 'Heretic',
      detail: `${heretic.strikes} heresy ${heretic.strikes === 1 ? 'strike' : 'strikes'}.`,
    });
  }
  const shortById = new Map(input.faiths.map((f) => [f.id, f.shortName]));
  const resets = input.agents.map((a) => {
    const short = a.faithId ? shortById.get(a.faithId) : undefined;
    return {
      id: a.id,
      faithId: null,
      conviction: initialUnalignedConviction(a.skepticism, config),
      leanings: {} as Record<string, number>,
      convertedAtTick: null,
      summaryLine: short ? `Last season I was a ${singular(short)}.` : 'Last season I believed in nothing in particular.',
    };
  });
  return { standings, awards, resets };
}

/** "Final Spreadsheet" -> "Spreadsheet" for "I was a Spreadsheet". */
export function singular(shortName: string): string {
  const words = shortName.trim().split(/\s+/);
  return words[words.length - 1] ?? shortName;
}
