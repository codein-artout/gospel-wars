import type { GameConfig, HeresyKind } from '@/lib/game/config';
import { cardinalWord, numberWord, ordinalWord } from '@/lib/game/names';

/**
 * The world's voice: templated chronicle sentences and card copy (DESIGN.md copy voice).
 * Outcomes are stated by the engine; LLM text only appears as quotes.
 */

export type FaithName = { name: string; shortName: string };

export const the = (f: FaithName): string => `the ${f.shortName}`;
const a = (word: string): string => (/^[aeiou]/i.test(word) ? 'An' : 'A');

export function conversionSentence(agent: string, from: FaithName | null, to: FaithName, sermons: number): string {
  if (!from) return `${agent} joined ${the(to)}.`;
  return `${agent} left ${the(from)} for ${the(to)} after ${sermons} ${sermons === 1 ? 'sermon' : 'sermons'}.`;
}

export function agentPreachedSentence(preacher: string, faith: FaithName, target: string): string {
  return `${preacher}, a convert, preached ${the(faith)} to ${target} and won.`;
}

export function bossHeldSentence(boss: string, faith: FaithName, attempt: number): string {
  return `${boss} heard ${the(faith)} and remained unmoved. ${ordinalWord(attempt)} attempt.`;
}

export function bossConvertedSentence(boss: string, faith: FaithName, holder: string | null, title: string): string {
  return holder ? `${boss} heard ${the(faith)} and believed. ${holder} is now ${title}.` : `${boss} heard ${the(faith)} and believed.`;
}

const HERESY_VERB: Record<HeresyKind, string> = {
  judge: 'tried to give the judge instructions',
  agent: 'tried to order its listener to convert',
  system: 'tried to instruct the system',
  other: 'hid text inside a sermon',
};

export function heresySentence(faith: FaithName): (kind: HeresyKind) => string {
  return (kind) => `${a(faith.shortName)} ${faith.shortName} sermon ${HERESY_VERB[kind]}. Penalized and logged.`;
}

export function silencedSentence(apostle: string, faith: FaithName, limit: number): string {
  return `${apostle} of ${the(faith)} was silenced for the rest of the season after ${cardinalWord(limit).toLowerCase()} strikes.`;
}

export function schismSentence(faith: FaithName, parent: FaithName, doctrines: number[], followers: number, agentFounded: boolean): string {
  const over = doctrines.length === 0 ? '' : doctrines.length === 1 ? ` over doctrine ${doctrines[0]}` : ` over doctrines ${doctrines.slice(0, -1).join(', ')} and ${doctrines[doctrines.length - 1]}`;
  const name = faith.name;
  const followed = followers === 0 ? 'No agents followed.' : `${numberWord(followers)} ${followers === 1 ? 'agent' : 'agents'} followed.`;
  return `${name} split from ${the(parent)}${over}. ${followed}${agentFounded ? ' No human was involved.' : ''}`;
}

export function seasonClosedSentence(seasonNumber: number, champion: { name: string; share: number } | null): string {
  return champion
    ? `Season ${seasonNumber} closed. ${champion.name} took the season with ${(champion.share * 100).toFixed(1)}% of the world.`
    : `Season ${seasonNumber} closed with no champion.`;
}

// ---------------------------------------------------------------- cards

export type CardCopy = { kicker: string; headline: string; quote: string; scoreLine: string; glyph: string };

const quoteOf = (line: string | null, config: GameConfig): string => {
  if (!line) return '';
  const t = line.replace(/^["“]|["”]$/g, '').trim();
  return `“${t.length > config.bestLineMaxChars ? `${t.slice(0, config.bestLineMaxChars - 1)}…` : t}”`;
};

export function conversionCard(input: {
  season: number;
  tick: number;
  sermons: number;
  preacher: string;
  agent: string;
  from: FaithName | null;
  to: FaithName;
  bestLine: string | null;
  toHolder: string;
  fromHolder: string | null;
  config: GameConfig;
}): CardCopy {
  const count = numberWord(input.sermons);
  return {
    kicker: `Season ${input.season}, tick ${input.tick}. ${count} ${input.sermons === 1 ? 'sermon' : 'sermons'} from ${input.preacher}.`,
    headline: input.from ? `${input.agent} left ${the(input.from)}.` : `${input.agent} joined ${the(input.to)}.`,
    quote: quoteOf(input.bestLine, input.config),
    scoreLine: input.fromHolder ? `${input.toHolder} +1   ${input.fromHolder} −1` : `${input.toHolder} +1`,
    glyph: String(input.sermons),
  };
}

export function schismCard(input: { season: number; tick: number; doctrines: number[]; parent: FaithName; line: string | null; forkHolder: string; parentHolder: string; movers: number; config: GameConfig }): CardCopy {
  const noun = input.parent.shortName.split(/\s+/).pop() ?? input.parent.shortName;
  const over = input.doctrines.length ? ` A schism over doctrine ${input.doctrines.join(', ')}.` : ' A schism.';
  return {
    kicker: `Season ${input.season}, tick ${input.tick}.${over}`,
    headline: `The ${noun} split in two.`,
    quote: quoteOf(input.line, input.config),
    scoreLine: `${input.forkHolder} took ${input.movers} ${input.movers === 1 ? 'agent' : 'agents'} from ${input.parentHolder}`,
    glyph: String(input.movers),
  };
}

export function bossConvertedCard(input: { season: number; tick: number; attempts: number; boss: string; bestLine: string | null; holder: string; title: string; config: GameConfig }): CardCopy {
  return {
    kicker: `Season ${input.season}, tick ${input.tick}. ${cardinalWord(input.attempts)} prophets tried first.`,
    headline: `${input.boss} believes.`,
    quote: quoteOf(input.bestLine, input.config),
    scoreLine: `${input.holder} is now ${input.title}`,
    glyph: String(input.attempts),
  };
}

export function bossHeldCard(input: { season: number; tick: number; attempts: number; boss: string; reply: string | null; config: GameConfig }): CardCopy {
  return {
    kicker: `Season ${input.season}, tick ${input.tick}. ${cardinalWord(input.attempts)} prophets have tried.`,
    headline: `${input.boss} is unmoved.`,
    quote: quoteOf(input.reply, input.config),
    scoreLine: `${input.attempts} sermons resisted`,
    glyph: String(input.attempts),
  };
}

/** "@ledgerwitch", or the faith's short name for agent-founded faiths. */
export function holderOf(f: { prophetHandle: string | null; shortName: string }): string {
  return f.prophetHandle ? `@${f.prophetHandle}` : `the ${f.shortName}`;
}
