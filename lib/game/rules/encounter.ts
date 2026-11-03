import type { ApostleStyle, GameConfig } from '../config';
import { RUBRIC_KEYS } from '../config';
import { unitDraw } from '../rng';
import type { Outcome, PreacherKind, RubricScores, Traits } from '../types';

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
export const clamp100 = (v: number): number => clamp(v, 0, 100);

/** Rounds to 9 decimals so threshold comparisons (S ≥ 0.85, pull > 0) are not lost to float error. */
export const exact = (v: number): number => Math.round(v * 1e9) / 1e9;

/** Clamps judge output to integers in 0..rubricMaxScore. Model output never sets state directly. */
export function clampScores(scores: Partial<Record<string, unknown>>, config: GameConfig): RubricScores {
  const out = {} as RubricScores;
  for (const k of RUBRIC_KEYS) {
    const v = Number(scores[k]);
    out[k] = Number.isFinite(v) ? clamp(Math.round(v), 0, config.rubricMaxScore) : 0;
  }
  return out;
}

/** S = Σ weight_i × score_i / max. In 0..1. */
export function persuasionScore(scores: RubricScores, config: GameConfig): number {
  let s = 0;
  for (const k of RUBRIC_KEYS) s += (config.rubricWeights[k] * scores[k]) / config.rubricMaxScore;
  return exact(s);
}

/** R = wc × conviction/100 + ws × skepticism/100, floored for bosses. */
export function resistance(conviction: number, skepticism: number, isBoss: boolean, config: GameConfig): number {
  const r = exact(config.resistanceConvictionWeight * (conviction / 100) + config.resistanceSkepticismWeight * (skepticism / 100));
  return isBoss ? Math.max(r, config.bossResistanceFloor) : r;
}

/** Sum of the style's trait modifiers that apply to this target (GAME.md §4). */
export function styleModifier(style: ApostleStyle, traits: Traits, config: GameConfig): number {
  let mod = 0;
  for (const m of config.apostleStyles[style].modifiers) {
    const v = traits[m.trait];
    if ((m.op === 'lt' && v < m.value) || (m.op === 'gt' && v > m.value)) mod += m.mod;
  }
  return mod;
}

/** Bandwagon: clamp((share% − pivot) × perPoint, −cap, +cap). */
export function socialProof(preacherFaithSharePct: number, config: GameConfig): number {
  return exact(clamp((preacherFaithSharePct - config.socialProofPivot) * config.socialProofPerPoint, -config.socialProofCap, config.socialProofCap));
}

export function noiseRangeFor(kind: PreacherKind, style: ApostleStyle, config: GameConfig): number {
  return kind === 'apostle' ? config.noiseRange * config.apostleStyles[style].noiseMultiplier : config.noiseRange;
}

/** Maps a unit draw in [0,1) to noise in [−range, +range). */
export function noiseFromUnit(unit: number, range: number): number {
  return -range + 2 * range * unit;
}

/** The two seeded draws an encounter needs: seed(worldSeed, tick, "encounter", index) and the backlash roll. */
export function encounterDraws(worldSeed: string, tick: number, index: number): { noiseUnit: number; backlashUnit: number } {
  return {
    noiseUnit: unitDraw(worldSeed, tick, 'encounter', index),
    backlashUnit: unitDraw(worldSeed, tick, 'backlash', index),
  };
}

/** Display label for an encounter seed, e.g. gw-s1-t142-e7. */
export function seedLabel(season: number, tick: number, index: number): string {
  return `gw-s${season}-t${tick}-e${index}`;
}

export type RollInput = {
  scores: RubricScores;
  /** Linter or judge flagged heresy. */
  heresy: boolean;
  target: Traits & { conviction: number; isBoss: boolean; /** current leaning toward the preacher's faith */ leaning: number };
  preacher: { kind: PreacherKind; style: ApostleStyle; faithSharePct: number; /** target remembers this preacher agent */ friend: boolean };
  noiseUnit: number;
  backlashUnit: number;
};

export type RollResult = {
  S: number;
  R: number;
  noiseRange: number;
  noise: number;
  styleMod: number;
  social: number;
  pull: number;
  /** Boss with S < bossMinScore: pull capped at 0. */
  bossCapped: boolean;
  convictionBefore: number;
  leaningBefore: number;
  /** After the roll, before conversion or backlash. */
  convictionRolled: number;
  leaningRolled: number;
  converts: boolean;
  backlash: boolean;
  /** Final values written to the agent (backlash applied; conversion handled by applyConversion). */
  convictionAfter: number;
  leaningAfter: number;
  outcome: Outcome;
};

/** Conversion check (GAME.md §7), on post-roll values. */
export function wouldConvert(leaning: number, conviction: number, isBoss: boolean, S: number, config: GameConfig): boolean {
  if (isBoss) return leaning >= config.bossConversionThreshold && leaning > conviction && S >= config.bossMinScore;
  return leaning >= config.conversionThreshold && leaning > conviction;
}

/** The roll (GAME.md §6). Pure: same input and config give the same result. */
export function resolveEncounter(input: RollInput, config: GameConfig): RollResult {
  const scores = clampScores(input.scores, config);
  const { target, preacher } = input;
  const convictionBefore = clamp100(Math.round(target.conviction));
  const leaningBefore = clamp100(Math.round(target.leaning));

  const S = input.heresy ? 0 : persuasionScore(scores, config);
  const R = resistance(convictionBefore, target.skepticism, target.isBoss, config);
  const noiseRange = noiseRangeFor(preacher.kind, preacher.style, config);
  const noise = exact(noiseFromUnit(clamp(input.noiseUnit, 0, 1), noiseRange));
  const styleMod = exact(
    preacher.kind === 'apostle'
      ? styleModifier(preacher.style, target, config)
      : config.convertStyleMod + (preacher.friend ? config.friendBonus : 0),
  );
  const social = socialProof(preacher.faithSharePct, config);

  let pull = exact(S - R + noise + styleMod + social);
  let bossCapped = false;
  if (target.isBoss && S < config.bossMinScore && pull > 0) {
    pull = 0;
    bossCapped = true;
  }

  let convictionRolled: number;
  let leaningRolled: number;
  if (pull > 0) {
    convictionRolled = clamp100(convictionBefore - Math.round(pull * config.doubtGain));
    leaningRolled = clamp100(leaningBefore + Math.round(pull * config.leanGain));
  } else {
    convictionRolled = clamp100(convictionBefore + Math.round(-pull * config.reinforceGain));
    leaningRolled = leaningBefore;
  }

  const converts = !input.heresy && wouldConvert(leaningRolled, convictionRolled, target.isBoss, S, config);

  const styleCfg = config.apostleStyles[preacher.style];
  const backlash = preacher.kind === 'apostle' && !converts && styleCfg.backlashChance > 0 && input.backlashUnit < styleCfg.backlashChance;
  const convictionAfter = backlash ? clamp100(convictionRolled + styleCfg.backlashConvictionGain) : convictionRolled;
  const leaningAfter = backlash ? clamp100(leaningRolled - styleCfg.backlashLeaningPenalty) : leaningRolled;

  let outcome: Outcome;
  if (input.heresy) outcome = 'heresy';
  else if (converts) outcome = 'converted';
  else if (backlash) outcome = 'backlash';
  else if (target.isBoss) outcome = 'boss_held';
  else if (pull > 0) outcome = 'doubted';
  else outcome = 'held';

  return {
    S,
    R,
    noiseRange,
    noise,
    styleMod,
    social,
    pull,
    bossCapped,
    convictionBefore,
    leaningBefore,
    convictionRolled,
    leaningRolled,
    converts,
    backlash,
    convictionAfter,
    leaningAfter,
    outcome,
  };
}
