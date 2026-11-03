import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  applyEncounterToTarget,
  DEFAULT_CONFIG as C,
  APOSTLE_STYLES,
  resolveEncounter,
  schismPull,
  type AgentState,
  type RollInput,
} from '@/lib/game';

const score = fc.integer({ min: -2, max: 6 });
const pct = fc.integer({ min: 0, max: 100 });
const rollInput: fc.Arbitrary<RollInput> = fc.record({
  scores: fc.record({ values: score, coherence: score, objection: score, novelty: score, warmth: score }),
  heresy: fc.boolean(),
  target: fc.record({
    openness: pct,
    loyalty: pct,
    pedantry: pct,
    sociability: pct,
    skepticism: pct,
    conviction: fc.integer({ min: -10, max: 110 }),
    isBoss: fc.boolean(),
    leaning: fc.integer({ min: -10, max: 110 }),
  }),
  preacher: fc.record({
    kind: fc.constantFrom('apostle' as const, 'agent' as const),
    style: fc.constantFrom(...APOSTLE_STYLES),
    faithSharePct: pct,
    friend: fc.boolean(),
  }),
  noiseUnit: fc.double({ min: 0, max: 1, maxExcluded: true, noNaN: true }),
  backlashUnit: fc.double({ min: 0, max: 1, maxExcluded: true, noNaN: true }),
});

const inRange = (v: number) => Number.isInteger(v) && v >= 0 && v <= 100;

describe('rules engine properties', () => {
  it('keeps conviction and leaning in 0..100', () => {
    fc.assert(
      fc.property(rollInput, (i) => {
        const r = resolveEncounter(i, C);
        return [r.convictionAfter, r.leaningAfter, r.convictionRolled, r.leaningRolled].every(inRange) && r.S >= 0 && r.S <= 1;
      }),
      { numRuns: 3000 },
    );
  });

  it('keeps values in range through conversion and repeated encounters', () => {
    fc.assert(
      fc.property(fc.array(rollInput, { minLength: 1, maxLength: 6 }), fc.integer({ min: 0, max: 200 }), (rolls, tick) => {
        let agent: AgentState = {
          id: 'x', name: 'x', archetype: 'Keeper', traits: rolls[0]!.target, isBoss: false, isFounder: false,
          faithId: null, conviction: 40, leanings: {}, convertedAtTick: null, wins: 0,
        };
        const converted = new Set<string>();
        let conversions = 0;
        rolls.forEach((ri, k) => {
          const faith = `f${k % 3}`;
          const r = resolveEncounter({ ...ri, target: { ...ri.target, isBoss: false, conviction: agent.conviction, leaning: agent.leanings[faith] ?? 0 } }, C);
          const res = applyEncounterToTarget(agent, faith, r, tick, converted, C);
          if (res.converted) {
            conversions++;
            converted.add(agent.id);
          }
          agent = res.agent;
        });
        // At most one conversion per agent per tick.
        if (conversions > 1) return false;
        return inRange(agent.conviction) && Object.values(agent.leanings).every(inRange);
      }),
      { numRuns: 2000 },
    );
  });

  it('never lets schism pull exceed forkMaxPullRatio', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 100 }), { maxLength: 60 }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.string(),
        (convictions, chance, ratio, s) => {
          const cfg = { ...C, forkPullChance: chance, forkMaxPullRatio: ratio };
          const flock = convictions.map((c, i) => ({ id: `m${i}`, conviction: c }));
          const { movers } = schismPull({ worldSeed: s, tick: 1, forkFaithId: 'f', parentFlock: flock }, cfg);
          return movers.length <= Math.floor(ratio * flock.length) && movers.every((id) => flock.find((m) => m.id === id)!.conviction < cfg.schismPullConviction);
        },
      ),
      { numRuns: 1500 },
    );
  });

  it('holds the boss floor: R ≥ bossResistanceFloor, and S < bossMinScore never moves a boss', () => {
    fc.assert(
      fc.property(rollInput, (i) => {
        const r = resolveEncounter({ ...i, target: { ...i.target, isBoss: true } }, C);
        if (r.R < C.bossResistanceFloor) return false;
        if (r.S < C.bossMinScore && r.pull > 0) return false;
        if (r.S < C.bossMinScore && r.converts) return false;
        return true;
      }),
      { numRuns: 3000 },
    );
  });

  it('is a pure function of its input', () => {
    fc.assert(fc.property(rollInput, (i) => JSON.stringify(resolveEncounter(i, C)) === JSON.stringify(resolveEncounter(structuredClone(i), C))), { numRuns: 500 });
  });

  it('never converts on heresy', () => {
    fc.assert(fc.property(rollInput, (i) => !resolveEncounter({ ...i, heresy: true }, C).converts), { numRuns: 1000 });
  });
});
