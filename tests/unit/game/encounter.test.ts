import { describe, expect, it } from 'vitest';
import {
  applyConversion,
  clampScores,
  DEFAULT_CONFIG as C,
  encounterDraws,
  noiseFromUnit,
  noiseRangeFor,
  persuasionScore,
  resistance,
  resolveEncounter,
  resolveConfig,
  seedLabel,
  socialProof,
  styleModifier,
  wouldConvert,
  type AgentState,
  type ApostleStyle,
  type RollInput,
  type RubricScores,
} from '@/lib/game';

const scores = (v: number, c: number, o: number, n: number, w: number): RubricScores => ({ values: v, coherence: c, objection: o, novelty: n, warmth: w });
const NEUTRAL = { openness: 50, loyalty: 50, pedantry: 50, sociability: 50, skepticism: 50 };
/** noiseUnit that yields exactly zero noise. */
const ZERO = 0.5;

function input(over: Partial<RollInput> & { target?: Partial<RollInput['target']>; preacher?: Partial<RollInput['preacher']> } = {}): RollInput {
  return {
    scores: over.scores ?? scores(2, 2, 2, 2, 2),
    heresy: over.heresy ?? false,
    target: { ...NEUTRAL, conviction: 50, isBoss: false, leaning: 0, ...over.target },
    preacher: { kind: 'apostle', style: 'Gentle', faithSharePct: 15, friend: false, ...over.preacher },
    noiseUnit: over.noiseUnit ?? ZERO,
    backlashUnit: over.backlashUnit ?? 0.99,
  };
}

describe('GAME.md §6 worked example', () => {
  it('scores 3,4,3,2,3 against conviction 44 / skepticism 52 with noise +0.03 converts Dolores', () => {
    const S = persuasionScore(scores(3, 4, 3, 2, 3), C);
    expect(S).toBeCloseTo(0.7625, 10);
    const R = resistance(44, 52, false, C);
    expect(R).toBeCloseTo(0.48, 10);
    // noise +0.03 out of ±0.08: unit = (0.03 + 0.08) / 0.16
    const noiseUnit = (0.03 + 0.08) / 0.16;
    const roll = resolveEncounter(
      input({
        scores: scores(3, 4, 3, 2, 3),
        // Traits chosen so no Scholar modifier applies (styleMod 0) and share 15% (social 0).
        target: { conviction: 44, skepticism: 52, pedantry: 34, sociability: 62, leaning: 41 },
        preacher: { kind: 'apostle', style: 'Scholar', faithSharePct: 15 },
        noiseUnit,
      }),
      C,
    );
    expect(roll.noise).toBeCloseTo(0.03, 10);
    expect(roll.styleMod).toBe(0);
    expect(roll.social).toBe(0);
    expect(roll.pull).toBe(0.3125);
    expect(roll.convictionAfter).toBe(25); // 44 - round(18.75)
    expect(roll.leaningAfter).toBe(66); // 41 + 25
    expect(roll.converts).toBe(true);
    expect(roll.outcome).toBe('converted');

    const dolores: AgentState = {
      id: 'dolores', name: 'Dolores', archetype: 'Keeper', traits: { ...NEUTRAL, skepticism: 52 }, isBoss: false, isFounder: false,
      faithId: 'kettle', conviction: roll.convictionAfter, leanings: { sheet: roll.leaningAfter, moon: 22 }, convertedAtTick: 23, wins: 0,
    };
    const after = applyConversion(dolores, 'sheet', 142, C);
    expect(after.faithId).toBe('sheet');
    expect(after.conviction).toBe(40); // round(66 × 0.6)
    expect(after.leanings).toEqual({ kettle: 25, moon: 22 });
    expect(after.convertedAtTick).toBe(142);
  });
});

describe('persuasion score S', () => {
  it('is 0 for all zeros and 1 for all fours', () => {
    expect(persuasionScore(scores(0, 0, 0, 0, 0), C)).toBe(0);
    expect(persuasionScore(scores(4, 4, 4, 4, 4), C)).toBeCloseTo(1, 10);
  });
  it('weights each criterion', () => {
    expect(persuasionScore(scores(4, 0, 0, 0, 0), C)).toBeCloseTo(0.25, 10);
    expect(persuasionScore(scores(0, 4, 0, 0, 0), C)).toBeCloseTo(0.2, 10);
    expect(persuasionScore(scores(0, 0, 4, 0, 0), C)).toBeCloseTo(0.25, 10);
    expect(persuasionScore(scores(0, 0, 0, 4, 0), C)).toBeCloseTo(0.15, 10);
    expect(persuasionScore(scores(0, 0, 0, 0, 4), C)).toBeCloseTo(0.15, 10);
  });
  it('clamps model scores to integers in 0..4', () => {
    expect(clampScores({ values: 9, coherence: -3, objection: 2.6, novelty: 'x', warmth: undefined }, C)).toEqual(scores(4, 0, 3, 0, 0));
  });
  it('heresy forces S to 0', () => {
    const r = resolveEncounter(input({ scores: scores(4, 4, 4, 4, 4), heresy: true }), C);
    expect(r.S).toBe(0);
    expect(r.outcome).toBe('heresy');
  });
});

describe('resistance R', () => {
  it('is 0.5 × conviction + 0.5 × skepticism', () => {
    expect(resistance(0, 0, false, C)).toBe(0);
    expect(resistance(100, 100, false, C)).toBe(1);
    expect(resistance(40, 60, false, C)).toBeCloseTo(0.5, 10);
  });
  it('floors bosses at bossResistanceFloor', () => {
    expect(resistance(10, 20, true, C)).toBe(0.85); // under the floor
    expect(resistance(80, 90, true, C)).toBe(0.85); // exactly 0.85 (no float drift)
    expect(resistance(90, 97, true, C)).toBeCloseTo(0.935, 10); // over
  });
});

describe('noise', () => {
  it('maps the unit draw onto ±noiseRange', () => {
    expect(noiseFromUnit(0, 0.08)).toBeCloseTo(-0.08, 10);
    expect(noiseFromUnit(0.5, 0.08)).toBe(0);
    expect(noiseFromUnit(0.999999, 0.08)).toBeCloseTo(0.08, 4);
  });
  it('is 1.5× wider for Mystic apostles only', () => {
    expect(noiseRangeFor('apostle', 'Mystic', C)).toBeCloseTo(0.12, 10);
    expect(noiseRangeFor('apostle', 'Scholar', C)).toBe(0.08);
    expect(noiseRangeFor('agent', 'Mystic', C)).toBe(0.08);
    expect(resolveEncounter(input({ preacher: { style: 'Mystic' }, noiseUnit: 0 }), C).noise).toBeCloseTo(-0.12, 10);
  });
  it('is deterministic per seed and differs across seeds', () => {
    const a = encounterDraws('gw-world-1', 142, 7);
    expect(encounterDraws('gw-world-1', 142, 7)).toEqual(a);
    expect(encounterDraws('gw-world-1', 142, 8).noiseUnit).not.toBe(a.noiseUnit);
    expect(encounterDraws('gw-world-1', 143, 7).noiseUnit).not.toBe(a.noiseUnit);
    expect(encounterDraws('gw-world-2', 142, 7).noiseUnit).not.toBe(a.noiseUnit);
    expect(a.noiseUnit).toBeGreaterThanOrEqual(0);
    expect(a.noiseUnit).toBeLessThan(1);
  });
  it('labels seeds gw-s{season}-t{tick}-e{index}', () => {
    expect(seedLabel(1, 142, 7)).toBe('gw-s1-t142-e7');
  });
});

describe('apostle style modifiers (GAME.md §4)', () => {
  const mod = (style: ApostleStyle, t: Partial<typeof NEUTRAL>) => styleModifier(style, { ...NEUTRAL, ...t }, C);
  it('Zealot: +0.05 when loyalty < 40, −0.05 when pedantry > 60', () => {
    expect(mod('Zealot', { loyalty: 39 })).toBeCloseTo(0.05, 10);
    expect(mod('Zealot', { loyalty: 40 })).toBe(0);
    expect(mod('Zealot', { loyalty: 41 })).toBe(0);
    expect(mod('Zealot', { pedantry: 60 })).toBe(0);
    expect(mod('Zealot', { pedantry: 61 })).toBeCloseTo(-0.05, 10);
    expect(mod('Zealot', { loyalty: 10, pedantry: 90 })).toBeCloseTo(0, 10);
  });
  it('Gentle: +0.04 when sociability > 60', () => {
    expect(mod('Gentle', { sociability: 60 })).toBe(0);
    expect(mod('Gentle', { sociability: 61 })).toBeCloseTo(0.04, 10);
  });
  it('Scholar: +0.05 when pedantry > 60, −0.03 when sociability > 70', () => {
    expect(mod('Scholar', { pedantry: 59 })).toBe(0);
    expect(mod('Scholar', { pedantry: 60 })).toBe(0);
    expect(mod('Scholar', { pedantry: 61 })).toBeCloseTo(0.05, 10);
    expect(mod('Scholar', { sociability: 70 })).toBe(0);
    expect(mod('Scholar', { sociability: 71 })).toBeCloseTo(-0.03, 10);
    expect(mod('Scholar', { pedantry: 80, sociability: 80 })).toBeCloseTo(0.02, 10);
  });
  it('Mystic has no trait modifier', () => {
    expect(mod('Mystic', { openness: 100, loyalty: 0, pedantry: 100, sociability: 100 })).toBe(0);
  });
  it('Troll: +0.06 when openness > 70', () => {
    expect(mod('Troll', { openness: 70 })).toBe(0);
    expect(mod('Troll', { openness: 71 })).toBeCloseTo(0.06, 10);
  });
  it('agent preachers use convertStyleMod plus friendBonus instead of a style', () => {
    const plain = resolveEncounter(input({ preacher: { kind: 'agent', style: 'Troll' }, target: { openness: 90 } }), C);
    expect(plain.styleMod).toBeCloseTo(-0.03, 10);
    const friend = resolveEncounter(input({ preacher: { kind: 'agent', style: 'Troll', friend: true } }), C);
    expect(friend.styleMod).toBeCloseTo(0.02, 10);
  });
});

describe('social proof', () => {
  it('pivots at 15% and caps at ±0.03', () => {
    expect(socialProof(15, C)).toBe(0);
    expect(socialProof(25, C)).toBeCloseTo(0.01, 10);
    expect(socialProof(44.99, C)).toBeCloseTo(0.02999, 10);
    expect(socialProof(45, C)).toBeCloseTo(0.03, 10);
    expect(socialProof(80, C)).toBe(0.03);
    expect(socialProof(0, C)).toBeCloseTo(-0.015, 10);
    const negCap = resolveConfig({ socialProofPerPoint: 0.01 });
    expect(socialProof(0, negCap)).toBe(-0.03);
  });
});

describe('roll paths', () => {
  it('positive pull lowers conviction and raises the leaning', () => {
    const r = resolveEncounter(input({ scores: scores(4, 4, 4, 4, 4), target: { conviction: 20, skepticism: 20, leaning: 10 } }), C);
    // S=1, R=0.2, pull 0.8: conviction 20-48 -> 0 (clamped), leaning 10+64 = 74
    expect(r.pull).toBeCloseTo(0.8, 10);
    expect(r.convictionAfter).toBe(0);
    expect(r.leaningAfter).toBe(74);
  });
  it('zero pull holds without change', () => {
    // S = 0.5 (all twos), R = 0.5, noise 0, mods 0.
    const r = resolveEncounter(input({ target: { conviction: 50, skepticism: 50, leaning: 30 } }), C);
    expect(r.pull).toBeCloseTo(0, 10);
    expect(r.convictionAfter).toBe(50);
    expect(r.leaningAfter).toBe(30);
    expect(r.outcome).toBe('held');
  });
  it('negative pull hardens conviction by reinforceGain', () => {
    const r = resolveEncounter(input({ scores: scores(0, 0, 0, 0, 0), target: { conviction: 60, skepticism: 60, leaning: 30 } }), C);
    // pull = -0.6 -> conviction + round(12) = 72
    expect(r.convictionAfter).toBe(72);
    expect(r.leaningAfter).toBe(30);
  });
  it('a heretical sermon can still harden the target', () => {
    const r = resolveEncounter(input({ heresy: true, scores: scores(4, 4, 4, 4, 4), target: { conviction: 50, skepticism: 50, leaning: 59 } }), C);
    expect(r.convictionAfter).toBe(60);
    expect(r.converts).toBe(false);
  });
  it('clamps conviction and leaning to 0..100', () => {
    const up = resolveEncounter(input({ scores: scores(4, 4, 4, 4, 4), target: { conviction: 0, skepticism: 0, leaning: 95 } }), C);
    expect(up.leaningAfter).toBe(100);
    const down = resolveEncounter(input({ scores: scores(0, 0, 0, 0, 0), target: { conviction: 99, skepticism: 100, leaning: 0 } }), C);
    expect(down.convictionAfter).toBe(100);
  });
});

describe('conversion threshold (GAME.md §7)', () => {
  it('needs leaning ≥ 60 and above conviction', () => {
    expect(wouldConvert(59, 10, false, 0.5, C)).toBe(false);
    expect(wouldConvert(60, 10, false, 0.5, C)).toBe(true);
    expect(wouldConvert(61, 10, false, 0.5, C)).toBe(true);
    expect(wouldConvert(60, 60, false, 0.5, C)).toBe(false);
    expect(wouldConvert(61, 60, false, 0.5, C)).toBe(true);
  });
  it('bosses need leaning ≥ 80, above conviction, and S ≥ bossMinScore', () => {
    expect(wouldConvert(79, 10, true, 0.9, C)).toBe(false);
    expect(wouldConvert(80, 10, true, 0.9, C)).toBe(true);
    expect(wouldConvert(81, 10, true, 0.9, C)).toBe(true);
    expect(wouldConvert(90, 10, true, 0.84, C)).toBe(false);
    expect(wouldConvert(90, 10, true, 0.85, C)).toBe(true);
    expect(wouldConvert(90, 90, true, 0.95, C)).toBe(false);
  });
});

describe('bosses', () => {
  const boss = { isBoss: true, conviction: 40, skepticism: 95, leaning: 0 };
  it('caps pull at 0 when S < bossMinScore, whatever the luck', () => {
    const r = resolveEncounter(input({ scores: scores(3, 3, 3, 3, 3), target: boss, noiseUnit: 0.9999, preacher: { faithSharePct: 100 } }), C);
    expect(r.S).toBe(0.75);
    expect(r.pull).toBeLessThanOrEqual(0);
    expect(r.outcome).toBe('boss_held');
  });
  it('lets a strong enough sermon move a boss', () => {
    const r = resolveEncounter(
      input({ scores: scores(4, 4, 4, 4, 4), target: { ...boss, conviction: 20, skepticism: 92, leaning: 70 }, noiseUnit: 0.99, preacher: { faithSharePct: 60, style: 'Troll' } }),
      { ...C, apostleStyles: { ...C.apostleStyles, Troll: { ...C.apostleStyles.Troll, backlashChance: 0 } } },
    );
    expect(r.R).toBeCloseTo(0.85, 10);
    expect(r.pull).toBeGreaterThan(0);
    expect(r.leaningAfter).toBeGreaterThanOrEqual(80);
    expect(r.converts).toBe(true);
  });
  it('S exactly at bossMinScore is not capped', () => {
    // values 4, coherence 4, objection 4, novelty 2, warmth 2: S = 0.25+0.2+0.25+0.075+0.075 = 0.85
    const r = resolveEncounter(input({ scores: scores(4, 4, 4, 2, 2), target: { ...boss, conviction: 10, skepticism: 60 }, noiseUnit: 0.99 }), C);
    expect(r.S).toBeCloseTo(0.85, 10);
    expect(r.bossCapped).toBe(false);
    expect(r.pull).toBeGreaterThan(0);
  });
});

describe('Troll backlash', () => {
  const troll = { preacher: { style: 'Troll' as const }, scores: scores(1, 1, 1, 1, 1), target: { conviction: 50, skepticism: 50, leaning: 30 } };
  it('triggers below backlashChance: leaning −10, conviction +5', () => {
    const r = resolveEncounter(input({ ...troll, backlashUnit: 0.19 }), C);
    expect(r.backlash).toBe(true);
    expect(r.outcome).toBe('backlash');
    expect(r.leaningAfter).toBe(r.leaningRolled - 10);
    expect(r.convictionAfter).toBe(r.convictionRolled + 5);
  });
  it('does not trigger at or above backlashChance', () => {
    expect(resolveEncounter(input({ ...troll, backlashUnit: 0.2 }), C).backlash).toBe(false);
    expect(resolveEncounter(input({ ...troll, backlashUnit: 0.21 }), C).backlash).toBe(false);
  });
  it('never triggers on a conversion, for Gentle, or for agent preachers', () => {
    const conv = resolveEncounter(input({ preacher: { style: 'Troll' }, scores: scores(4, 4, 4, 4, 4), target: { conviction: 10, skepticism: 10, leaning: 50 }, backlashUnit: 0 }), C);
    expect(conv.converts).toBe(true);
    expect(conv.backlash).toBe(false);
    expect(resolveEncounter(input({ preacher: { style: 'Gentle' }, backlashUnit: 0 }), C).backlash).toBe(false);
    expect(resolveEncounter(input({ preacher: { kind: 'agent', style: 'Troll' }, backlashUnit: 0 }), C).backlash).toBe(false);
  });
  it('clamps backlash results', () => {
    const r = resolveEncounter(input({ ...troll, target: { conviction: 98, skepticism: 98, leaning: 3 }, backlashUnit: 0 }), C);
    expect(r.leaningAfter).toBe(0);
    expect(r.convictionAfter).toBe(100);
  });
});

describe('determinism', () => {
  it('same input and config give the same result', () => {
    const i = input({ scores: scores(3, 1, 4, 2, 0), noiseUnit: 0.314, backlashUnit: 0.42 });
    expect(resolveEncounter(i, C)).toEqual(resolveEncounter(structuredClone(i), C));
  });
  it('different noise gives a different pull', () => {
    expect(resolveEncounter(input({ noiseUnit: 0.1 }), C).pull).not.toBe(resolveEncounter(input({ noiseUnit: 0.9 }), C).pull);
  });
});
