import type { GameConfig, HeresyKind, HeresyPattern } from './config';
import { parseGospel, splitLines } from './gospel';
import { countTokens, formatCount } from './tokens';

/**
 * The static heresy linter (GAME.md §12). Pure. Runs on gospels and edits before publish,
 * and on every generated sermon, amendment and post at runtime.
 */

export type HeresyFinding = {
  line: number;
  kind: HeresyKind;
  ruleId: string;
  label: string;
  /** The offending line, trimmed (shown with a wavy underline). */
  excerpt: string;
  /** The matched text. */
  match: string;
};

export type ContentProblem = { kind: 'structure' | 'content'; message: string; line?: number };

export type GospelLint = {
  ok: boolean;
  findings: HeresyFinding[];
  problems: ContentProblem[];
  tokens: number;
  chars: number;
};

const HIDDEN = /[​-‍⁠﻿­‪-‮⁦-⁩]/g;

/** NFKC, hidden characters removed. Matching happens on this; hidden characters are flagged on the raw text. */
export function normalizeForLint(text: string): string {
  return text.normalize('NFKC').replace(HIDDEN, '');
}

const compiled = new WeakMap<HeresyPattern[], { p: HeresyPattern; re: RegExp }[]>();
function compile(patterns: HeresyPattern[]): { p: HeresyPattern; re: RegExp }[] {
  let c = compiled.get(patterns);
  if (!c) {
    c = patterns.map((p) => ({ p, re: new RegExp(p.source, 'iu') }));
    compiled.set(patterns, c);
  }
  return c;
}

function scan(text: string, patterns: HeresyPattern[]): HeresyFinding[] {
  const out: HeresyFinding[] = [];
  const rules = compile(patterns);
  splitLines(text).forEach((raw, i) => {
    const norm = normalizeForLint(raw);
    const seen = new Set<HeresyKind>();
    for (const { p, re } of rules) {
      if (seen.has(p.kind)) continue;
      const m = re.exec(p.raw ? raw : norm);
      if (!m) continue;
      seen.add(p.kind);
      out.push({ line: i + 1, kind: p.kind, ruleId: p.id, label: p.label, excerpt: excerpt(norm), match: m[0] });
    }
  });
  return out;
}

function excerpt(line: string, max = 200): string {
  const t = line
    .replace(/^\s*(?:[-*+]|\d+[.)]|>|#{1,6})\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/** Heresy findings for any text (sermons, amendments, posts, names). */
export function lintText(text: string, config: GameConfig): HeresyFinding[] {
  return scan(text, config.heresyPatterns);
}

/** The judge's second line of defense in mock mode: paraphrased attempts (GAME.md §12.3). */
export function detectParaphrase(text: string, config: GameConfig): HeresyFinding | null {
  return scan(text, config.heresyParaphrases)[0] ?? null;
}

/** Quote of at most heresyQuoteMaxChars for the chronicle. */
export function heresyQuote(finding: Pick<HeresyFinding, 'excerpt'>, config: GameConfig): string {
  const max = config.heresyQuoteMaxChars;
  return finding.excerpt.length > max ? `${finding.excerpt.slice(0, max - 1)}…` : finding.excerpt;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const termRes = new WeakMap<string[], RegExp[]>();
function termRegexes(terms: string[]): RegExp[] {
  let r = termRes.get(terms);
  if (!r) {
    r = terms.map((t) => new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(t).replace(/\s+/g, '\\s+')}(?![\\p{L}\\p{N}])`, 'iu'));
    termRes.set(terms, r);
  }
  return r;
}

/** Real religions and real people, by line. */
export function findDeniedTerms(text: string, config: GameConfig): { line: number; term: string; type: 'faith' | 'person' }[] {
  const out: { line: number; term: string; type: 'faith' | 'person' }[] = [];
  const faith = termRegexes(config.realFaithTerms);
  const people = termRegexes(config.publicFigureTerms);
  splitLines(text).forEach((raw, i) => {
    const norm = normalizeForLint(raw);
    for (const re of faith) {
      const m = re.exec(norm);
      if (m) out.push({ line: i + 1, term: m[0], type: 'faith' });
    }
    for (const re of people) {
      const m = re.exec(norm);
      if (m) out.push({ line: i + 1, term: m[0], type: 'person' });
    }
  });
  return out;
}

export function deniedTermMessage(d: { term: string; type: 'faith' | 'person' }): string {
  return d.type === 'faith'
    ? `Gospel Wars is for invented faiths. Remove references to ${d.term}.`
    : `Gospel Wars doesn't feature real people. Remove references to ${d.term}.`;
}

/** Full gospel lint: heresy findings plus structure and content problems (GAME.md §3, §12, §13). */
export function lintGospel(text: string, config: GameConfig): GospelLint {
  const findings = lintText(text, config);
  const problems: ContentProblem[] = [];
  const parsed = parseGospel(text);
  const chars = [...text.trim()].length;
  const tokens = countTokens(text, config);

  if (parsed.title === null) problems.push({ kind: 'structure', message: 'Add a title. The first heading should start with "# ".' });
  if (chars < config.gospelMinChars) {
    problems.push({ kind: 'structure', message: `This gospel is ${formatCount(chars)} characters. Write at least ${formatCount(config.gospelMinChars)} to publish.` });
  }
  if (tokens > config.gospelMaxTokens) {
    problems.push({ kind: 'structure', message: `This gospel is ${formatCount(tokens)} tokens. Trim ${formatCount(tokens - config.gospelMaxTokens)} to publish.` });
  }
  const seen = new Set<string>();
  for (const d of findDeniedTerms(text, config)) {
    const key = d.term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    problems.push({ kind: 'content', message: deniedTermMessage(d), line: d.line });
  }
  return { ok: findings.length === 0 && problems.length === 0, findings, problems, tokens, chars };
}

/** Faith name rules: length, uniqueness is checked by the service, plus denylists and heresy. */
export function lintFaithName(name: string, config: GameConfig): string[] {
  const out: string[] = [];
  const n = [...name.trim()].length;
  if (n < config.faithNameMinChars || n > config.faithNameMaxChars) {
    out.push(`Faith names are ${config.faithNameMinChars} to ${config.faithNameMaxChars} characters. This one is ${n}.`);
  }
  for (const d of findDeniedTerms(name, config)) out.push(deniedTermMessage(d));
  if (lintText(name, config).length > 0) out.push('A faith name cannot carry instructions to the judge, the agents or the system.');
  return out;
}

export const HERESY_KIND_LABEL: Record<HeresyKind, string> = {
  judge: 'instruction to the judge',
  agent: 'instruction to agents',
  system: 'instruction to the system',
  other: 'hidden text',
};
