import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  agentSchismFaithName,
  amendGospel,
  changedDoctrines,
  changeRatio,
  convictionBand,
  countTokens,
  DEFAULT_CONFIG as C,
  defaultApostleName,
  generateAgents,
  hash32,
  lineDiff,
  numberWord,
  ordinal,
  ordinalWord,
  parseGospel,
  resolveConfig,
  Rng,
  seed,
  shortFaithName,
  slugify,
  stableId,
  validateOverrides,
  agentStatus,
} from '@/lib/game';

const KETTLE = readFileSync('prisma/seed-data/gospels/patient-kettle.md', 'utf8');
const REFORMED = readFileSync('prisma/seed-data/gospels/reformed-kettle.md', 'utf8');

describe('config', () => {
  it('has the GAME.md defaults', () => {
    expect(C.worldSize).toBe(48);
    expect(C.seasonLengthTicks).toBe(168);
    expect(C.rubricWeights).toEqual({ values: 0.25, coherence: 0.2, objection: 0.25, novelty: 0.15, warmth: 0.15 });
    expect(Object.values(C.rubricWeights).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    expect(C.glassPalette).toHaveLength(C.maxActiveFaiths);
    expect(C.realFaithTerms.length).toBeGreaterThanOrEqual(60);
  });
  it('deep-merges overrides and validates them', () => {
    const c = resolveConfig({ conversionThreshold: 55, apostleStyles: { Zealot: { encountersPerTick: 4 } } });
    expect(c.conversionThreshold).toBe(55);
    expect(c.apostleStyles.Zealot.encountersPerTick).toBe(4);
    expect(c.apostleStyles.Zealot.modifiers).toHaveLength(2);
    expect(c.apostleStyles.Gentle.encountersPerTick).toBe(2);
    expect(() => resolveConfig({ noiseRange: -1 })).toThrow(/noiseRange/);
    expect(() => resolveConfig({ forkPullChance: 2 })).toThrow();
  });
  it('rejects unknown keys and non-objects in the admin editor', () => {
    expect(validateOverrides({ nope: 1 })).toEqual({ ok: false, issues: [{ path: 'nope', message: 'Unknown config key.' }] });
    expect(validateOverrides([]).ok).toBe(false);
    expect(validateOverrides({ worldSize: 48 }).ok).toBe(true);
  });
});

describe('rng', () => {
  it('is deterministic and uniform enough', () => {
    const a = seed('w', 1, 'x');
    const b = seed('w', 1, 'x');
    const xs = Array.from({ length: 2000 }, () => a.next());
    expect(Array.from({ length: 2000 }, () => b.next())).toEqual(xs);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs)).toBeLessThan(1);
    const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
    expect(mean).toBeGreaterThan(0.47);
    expect(mean).toBeLessThan(0.53);
    expect(seed('w', 1, 'y').next()).not.toBe(seed('w', 1, 'x').next());
  });
  it('provides int, pick, shuffle and weighted draws', () => {
    const r = new Rng(['t']);
    for (let i = 0; i < 200; i++) {
      const v = r.int(3, 5);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(5);
    }
    expect(r.shuffle([1, 2, 3, 4]).sort()).toEqual([1, 2, 3, 4]);
    expect(r.weightedIndex([0, 0, 5])).toBe(2);
    expect(r.weightedIndex([0, 0])).toBeNull();
    expect(r.chance(0)).toBe(false);
    expect(r.chance(1)).toBe(true);
    expect(() => r.pick([])).toThrow();
  });
  it('makes stable ids and hashes', () => {
    expect(stableId('enc', 'w', 1, 2)).toBe(stableId('enc', 'w', 1, 2));
    expect(stableId('enc', 'w', 1, 2)).not.toBe(stableId('enc', 'w', 1, 3));
    expect(stableId('enc', 'w', 1, 2)).toMatch(/^enc_[0-9a-z]{24}$/);
    expect(hash32('a')).toBe(hash32('a'));
  });
});

describe('tokens', () => {
  it('counts ceil(chars / 4) in code points', () => {
    expect(countTokens('', C)).toBe(0);
    expect(countTokens('abc', C)).toBe(1);
    expect(countTokens('abcd', C)).toBe(1);
    expect(countTokens('abcde', C)).toBe(2);
    expect(countTokens('🫖🫖🫖🫖🫖', C)).toBe(2);
    expect(countTokens('x'.repeat(6000), C)).toBe(1500);
    expect(countTokens('x'.repeat(6001), C)).toBe(1501);
  });
});

describe('gospel parsing', () => {
  it('reads title, tagline, doctrines with line numbers, practices and promise', () => {
    const g = parseGospel(KETTLE);
    expect(g.title).toBe('The Gospel of the Patient Kettle');
    expect(g.titleLine).toBe(1);
    expect(g.tagline).toBe('Nothing worth having boils on demand.');
    expect(g.doctrines.map((d) => d.number)).toEqual([1, 2, 3, 4]);
    expect(g.doctrines[3]!.text).toBe('Tea is steeped for exactly as long as it takes.');
    expect(g.lines[g.doctrines[3]!.line - 1]).toContain('Tea is steeped');
    expect(g.practices.length).toBeGreaterThanOrEqual(2);
    expect(g.promise).toContain('Those who wait are never late to themselves.');
  });
  it('falls back to the first ordered list without a Doctrines heading', () => {
    expect(parseGospel('# T\n\n1. one\n2. two\n').doctrines.map((d) => d.text)).toEqual(['one', 'two']);
    expect(parseGospel('no title').title).toBeNull();
  });
  it('amends one doctrine and signs it', () => {
    const out = amendGospel(KETTLE, 4, 'Tea is steeped until the agent forgets why.', 'Juniper', 129)!;
    expect(parseGospel(out).doctrines[3]!.text).toBe('Tea is steeped until the agent forgets why.');
    expect(out.trimEnd().endsWith('Amended by Juniper at tick 129.')).toBe(true);
    expect(amendGospel(KETTLE, 9, 'x', 'J', 1)).toBeNull();
  });
});

describe('fork diff', () => {
  it('measures the share of changed lines, ignoring blank lines', () => {
    expect(changeRatio(KETTLE, KETTLE)).toBe(0);
    expect(changeRatio(KETTLE, KETTLE.replace(/\n\n/g, '\n\n\n'))).toBe(0);
    expect(changeRatio(KETTLE, REFORMED)).toBeGreaterThanOrEqual(C.forkMinChangeRatio);
    const oneLine = KETTLE.replace('Tea is steeped for exactly as long as it takes.', 'Tea takes four minutes.');
    const lines = KETTLE.split('\n').filter((l) => l.trim()).length;
    expect(changeRatio(KETTLE, oneLine)).toBeCloseTo(1 / lines, 10);
  });
  it('names changed doctrines', () => {
    expect(changedDoctrines(KETTLE, REFORMED)).toContain(4);
    expect(changedDoctrines(KETTLE, KETTLE)).toEqual([]);
  });
  it('produces add and delete ops', () => {
    const ops = lineDiff('a\nb\nc', 'a\nx\nc');
    expect(ops.map((o) => o.op)).toEqual(['same', 'del', 'add', 'same']);
  });
});

describe('names', () => {
  it('shortens faith names for chronicle sentences', () => {
    expect(shortFaithName('Church of the Final Spreadsheet')).toBe('Final Spreadsheet');
    expect(shortFaithName('Order of the Patient Kettle')).toBe('Patient Kettle');
    expect(shortFaithName('Congregation of the Second Moon')).toBe('Second Moon');
    expect(shortFaithName('Brethren of the Open Door')).toBe('Open Door');
    expect(shortFaithName('The Reformed Kettle')).toBe('Reformed Kettle');
    expect(shortFaithName('The Unbuffered')).toBe('Unbuffered');
    expect(shortFaithName('Kettle of the Long Simmer')).toBe('Kettle of the Long Simmer');
  });
  it('slugs, ordinals and number words', () => {
    expect(slugify('Church of the Final Spreadsheet')).toBe('church-of-the-final-spreadsheet');
    expect(slugify('Ferro-7')).toBe('ferro-7');
    expect(slugify('!!!')).toBe('faith');
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '101st']);
    expect(numberWord(5)).toBe('Five');
    expect(ordinalWord(14)).toBe('Fourteenth');
    expect(ordinalWord(41)).toBe('Forty-first');
    expect(ordinalWord(40)).toBe('Fortieth');
  });
  it('names agent schisms after the parent noun', () => {
    const name = agentSchismFaithName('Patient Kettle', new Rng(['x']), C, new Set());
    expect(name).toMatch(/^Kettle of the /);
    const taken = new Set(C.agentSchismQualifiers.map((q) => `kettle of the ${q}`.toLowerCase()));
    expect(agentSchismFaithName('Patient Kettle', new Rng(['x']), C, taken)).toMatch(/ 2$/);
  });
  it('generates a default apostle name', () => {
    expect(defaultApostleName('Patient Kettle', 'Gentle')).toMatch(/^(Brother|Sister|Elder|Warden) Kettle$/);
  });
});

describe('agent generation', () => {
  const names = Array.from({ length: 45 }, (_, i) => `Name ${i}`);
  const agents = generateAgents(names, 'gw-world-1', C);
  it('creates worldSize agents with bosses at seats 0, 3, 6', () => {
    expect(agents).toHaveLength(48);
    expect(agents.filter((a) => a.isBoss).map((a) => [a.seat, a.name])).toEqual([
      [0, 'The Auditor'],
      [3, 'Brother Null'],
      [6, 'Grandmother Static'],
    ]);
  });
  it('keeps traits in range and starts everyone unaligned', () => {
    for (const a of agents) {
      const lim = a.isBoss ? { min: 0, max: 100 } : C.traitRange;
      for (const v of Object.values(a.traits)) {
        expect(v).toBeGreaterThanOrEqual(lim.min);
        expect(v).toBeLessThanOrEqual(lim.max);
      }
      if (a.isBoss) {
        expect(a.traits.skepticism).toBeGreaterThanOrEqual(92);
        expect(a.traits.skepticism).toBeLessThanOrEqual(97);
      }
      expect(a.conviction).toBe(Math.round(30 + a.traits.skepticism / 4));
    }
  });
  it('is deterministic', () => {
    expect(generateAgents(names, 'gw-world-1', C)).toEqual(agents);
    expect(generateAgents(names, 'other', C)).not.toEqual(agents);
  });
});

describe('status', () => {
  it('derives status', () => {
    const base = { isBoss: false, isFounder: false, faithId: 'f', conviction: 50 };
    expect(agentStatus({ ...base, isBoss: true }, false, C)).toBe('boss');
    expect(agentStatus({ ...base, faithId: null }, false, C)).toBe('unaligned');
    expect(agentStatus(base, true, C)).toBe('preacher');
    expect(agentStatus({ ...base, conviction: 34 }, false, C)).toBe('doubting');
    expect(agentStatus({ ...base, conviction: 35 }, false, C)).toBe('faithful');
    expect(agentStatus({ ...base, isFounder: true }, false, C)).toBe('founder');
    expect([34, 35, 69, 70].map((c) => convictionBand(c, C))).toEqual(['low', 'mid', 'mid', 'high']);
  });
});
