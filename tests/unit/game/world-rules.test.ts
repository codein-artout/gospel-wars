import { describe, expect, it } from 'vitest';
import {
  agentSchismFollowers,
  applyEncounterToTarget,
  applyStrike,
  checkPreacherEligibility,
  decayAndRegen,
  DEFAULT_CONFIG as C,
  firstFreeColor,
  initialUnalignedConviction,
  isSeasonEnd,
  pairKey,
  rankFaiths,
  rankProphets,
  resolveConfig,
  resolveEncounter,
  rollAgentSchism,
  scheduleEncounters,
  schismPull,
  seasonClose,
  targetWeight,
  type AgentState,
  type RollInput,
  type ScheduleAgent,
} from '@/lib/game';

const T = { openness: 50, loyalty: 50, pedantry: 50, sociability: 50, skepticism: 50 };
function agent(id: string, over: Partial<AgentState> = {}): AgentState {
  return { id, name: id, archetype: 'Keeper', traits: T, isBoss: false, isFounder: false, faithId: null, conviction: 50, leanings: {}, convertedAtTick: null, wins: 0, ...over };
}

function world(n = 40, faiths = ['f1', 'f2', 'f3']): ScheduleAgent[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `a${String(i).padStart(2, '0')}`,
    faithId: i % 4 === 0 ? null : faiths[i % faiths.length]!,
    conviction: (i * 7) % 100,
    isBoss: i < 3,
  }));
}
const apostles = [
  { id: 'ap1', faithId: 'f1', style: 'Zealot' as const, silenced: false },
  { id: 'ap2', faithId: 'f2', style: 'Gentle' as const, silenced: false },
  { id: 'ap3', faithId: 'f3', style: 'Mystic' as const, silenced: false },
];

describe('scheduleEncounters', () => {
  const base = { worldSeed: 'gw-world-1', tick: 10, agents: world(), apostles, preachers: [], recentPairs: new Set<string>() };

  it('gives each apostle its style encounter count', () => {
    const s = scheduleEncounters(base, C);
    const count = (id: string) => s.filter((e) => e.preacher.id === id).length;
    expect(count('ap1')).toBe(3);
    expect(count('ap2')).toBe(2);
    expect(count('ap3')).toBe(2);
    expect(s.map((e) => e.index)).toEqual(s.map((_, i) => i + 1));
  });

  it('never targets the own faith, and reaches bosses only through the boss slot', () => {
    const agents = new Map(base.agents.map((a) => [a.id, a]));
    for (let tick = 1; tick < 60; tick++) {
      for (const e of scheduleEncounters({ ...base, tick }, C)) {
        const t = agents.get(e.targetId)!;
        expect(t.faithId).not.toBe(e.preacher.faithId);
        if (t.isBoss) expect(e.boss).toBe(true);
      }
    }
  });

  it('weights unaligned ×3, doubting ×2, faithful ×1, own ×0', () => {
    expect(targetWeight({ id: 'x', faithId: null, conviction: 80, isBoss: false }, 'f1', C)).toBe(3);
    expect(targetWeight({ id: 'x', faithId: 'f2', conviction: 34, isBoss: false }, 'f1', C)).toBe(2);
    expect(targetWeight({ id: 'x', faithId: 'f2', conviction: 35, isBoss: false }, 'f1', C)).toBe(1);
    expect(targetWeight({ id: 'x', faithId: 'f1', conviction: 10, isBoss: false }, 'f1', C)).toBe(0);
    expect(targetWeight({ id: 'x', faithId: null, conviction: 10, isBoss: true }, 'f1', C)).toBe(0);
  });

  it('prefers unaligned targets over many ticks', () => {
    const agents = new Map(base.agents.map((a) => [a.id, a]));
    let unaligned = 0;
    let total = 0;
    for (let tick = 1; tick <= 200; tick++) {
      for (const e of scheduleEncounters({ ...base, tick }, C)) {
        if (e.boss) continue;
        total++;
        if (agents.get(e.targetId)!.faithId === null) unaligned++;
      }
    }
    // 7 of 37 non-boss agents are unaligned (19%), weighted ×3 they should take well over that.
    expect(unaligned / total).toBeGreaterThan(0.3);
  });

  it('respects maxEncountersPerAgentPerTick as a target', () => {
    for (let tick = 1; tick < 40; tick++) {
      const s = scheduleEncounters({ ...base, tick }, C);
      const ids = s.map((e) => e.targetId);
      expect(new Set(ids).size).toBe(ids.length);
    }
    const two = resolveConfig({ maxEncountersPerAgentPerTick: 2 });
    const tiny = { ...base, agents: base.agents.slice(0, 6) };
    const s = scheduleEncounters(tiny, two);
    const counts = new Map<string, number>();
    s.forEach((e) => counts.set(e.targetId, (counts.get(e.targetId) ?? 0) + 1));
    for (const c of counts.values()) expect(c).toBeLessThanOrEqual(2);
  });

  it('skips pairs inside the cooldown', () => {
    const blocked = new Set(base.agents.map((a) => pairKey('ap1', a.id)));
    const s = scheduleEncounters({ ...base, recentPairs: blocked }, C);
    expect(s.filter((e) => e.preacher.id === 'ap1')).toHaveLength(0);
    expect(s.length).toBeGreaterThan(0);
  });

  it('schedules nothing for silenced apostles without shifting the others', () => {
    const silenced = apostles.map((a) => (a.id === 'ap1' ? { ...a, silenced: true } : a));
    const s = scheduleEncounters({ ...base, apostles: silenced }, C);
    expect(s.some((e) => e.preacher.id === 'ap1')).toBe(false);
  });

  it('caps the total, dropping lowest weight first', () => {
    const capped = resolveConfig({ maxEncountersPerTick: 4 });
    const s = scheduleEncounters(base, capped);
    expect(s).toHaveLength(4);
    const full = scheduleEncounters(base, C);
    const minKept = Math.min(...s.map((e) => e.weight));
    const dropped = full.filter((e) => !s.some((k) => k.preacher.id === e.preacher.id && k.targetId === e.targetId));
    for (const d of dropped) expect(d.weight).toBeLessThanOrEqual(minKept);
    expect(s.map((e) => e.index)).toEqual([1, 2, 3, 4]);
  });

  it('gives preachers one encounter with preachChance', () => {
    const preachers = [{ agentId: 'a05', faithId: 'f2', style: 'Gentle' as const }];
    let hits = 0;
    for (let tick = 1; tick <= 400; tick++) {
      const s = scheduleEncounters({ ...base, tick, preachers }, C);
      const mine = s.filter((e) => e.preacher.kind === 'agent');
      expect(mine.length).toBeLessThanOrEqual(1);
      if (mine[0]) expect(mine[0].targetId).not.toBe('a05');
      hits += mine.length;
    }
    expect(hits / 400).toBeGreaterThan(0.4);
    expect(hits / 400).toBeLessThan(0.6);
    expect(scheduleEncounters({ ...base, preachers }, resolveConfig({ preachChance: 0 })).some((e) => e.preacher.kind === 'agent')).toBe(false);
  });

  it('targets a boss about bossTargetChance of the time per apostle', () => {
    let bossHits = 0;
    const N = 1000;
    for (let tick = 1; tick <= N; tick++) bossHits += scheduleEncounters({ ...base, tick }, C).filter((e) => e.boss).length;
    expect(bossHits / (N * 3)).toBeGreaterThan(0.07);
    expect(bossHits / (N * 3)).toBeLessThan(0.13);
    expect(scheduleEncounters(base, resolveConfig({ bossTargetChance: 1 })).filter((e) => e.boss)).toHaveLength(3);
  });

  it('is deterministic per seed', () => {
    expect(scheduleEncounters(base, C)).toEqual(scheduleEncounters(base, C));
    expect(scheduleEncounters({ ...base, worldSeed: 'other' }, C)).not.toEqual(scheduleEncounters(base, C));
  });
});

describe('one conversion per agent per tick', () => {
  it('a second qualifying roll in the same tick moves numbers but does not convert', () => {
    const roll: RollInput = {
      scores: { values: 4, coherence: 4, objection: 4, novelty: 4, warmth: 4 },
      heresy: false,
      target: { ...T, conviction: 10, skepticism: 10, isBoss: false, leaning: 50 },
      preacher: { kind: 'apostle', style: 'Gentle', faithSharePct: 15, friend: false },
      noiseUnit: 0.5,
      backlashUnit: 0.9,
    };
    const converted = new Set<string>();
    const first = applyEncounterToTarget(agent('x', { conviction: 10, leanings: { f1: 50 } }), 'f1', resolveEncounter(roll, C), 1, converted, C);
    expect(first.converted).toBe(true);
    converted.add('x');
    const second = applyEncounterToTarget(first.agent, 'f2', resolveEncounter({ ...roll, target: { ...roll.target, conviction: first.agent.conviction } }, C), 1, converted, C);
    expect(second.converted).toBe(false);
    expect(second.agent.faithId).toBe('f1');
  });
});

describe('checkPreacherEligibility', () => {
  const tick = 50;
  it('needs conviction ≥ 70 and 12 ticks since converting', () => {
    const agents = [
      agent('c69', { faithId: 'f1', conviction: 69, convertedAtTick: 10 }),
      agent('c70', { faithId: 'f1', conviction: 70, convertedAtTick: 10 }),
      agent('t11', { faithId: 'f1', conviction: 90, convertedAtTick: 39 }),
      agent('t12', { faithId: 'f1', conviction: 90, convertedAtTick: 38 }),
      agent('never', { faithId: 'f1', conviction: 90, convertedAtTick: null }),
      agent('boss', { faithId: 'f1', conviction: 99, convertedAtTick: 1, isBoss: true }),
      agent('founder', { faithId: 'f1', conviction: 99, convertedAtTick: 1, isFounder: true }),
      agent('unaligned', { faithId: null, conviction: 99, convertedAtTick: 1 }),
    ];
    expect(checkPreacherEligibility(agents, tick, C).get('f1')).toEqual(['t12', 'c70']);
  });
  it('caps at 3 per faith, highest conviction first, ties by id', () => {
    const agents = ['e', 'b', 'd', 'a', 'c'].map((id, i) => agent(id, { faithId: 'f1', conviction: i < 2 ? 95 : 80, convertedAtTick: 1 }));
    expect(checkPreacherEligibility(agents, tick, C).get('f1')).toEqual(['b', 'e', 'a']);
  });
});

describe('schismPull (human forks)', () => {
  const flock = Array.from({ length: 20 }, (_, i) => ({ id: `m${String(i).padStart(2, '0')}`, conviction: i * 5 }));
  it('only moves members below schismPullConviction', () => {
    const always = resolveConfig({ forkPullChance: 1, forkMaxPullRatio: 1 });
    const { movers } = schismPull({ worldSeed: 's', tick: 1, forkFaithId: 'fork', parentFlock: flock }, always);
    expect(movers).toEqual(flock.filter((m) => m.conviction < 50).map((m) => m.id));
    expect(movers).not.toContain('m10'); // conviction exactly 50 stays
  });
  it('never moves more than forkMaxPullRatio of the flock', () => {
    const always = resolveConfig({ forkPullChance: 1 });
    const r = schismPull({ worldSeed: 's', tick: 1, forkFaithId: 'fork', parentFlock: flock }, always);
    expect(r.cap).toBe(8);
    expect(r.movers).toHaveLength(8);
    expect(r.moverConviction).toBe(40);
  });
  it('is seeded', () => {
    const a = schismPull({ worldSeed: 's', tick: 1, forkFaithId: 'fork', parentFlock: flock }, C);
    expect(schismPull({ worldSeed: 's', tick: 1, forkFaithId: 'fork', parentFlock: flock }, C)).toEqual(a);
  });
  it('handles an empty flock', () => {
    expect(schismPull({ worldSeed: 's', tick: 1, forkFaithId: 'f', parentFlock: [] }, C)).toEqual({ movers: [], cap: 0, moverConviction: 40 });
  });
});

describe('rollAgentSchism', () => {
  const preacher = { agentId: 'p', faithId: 'f1', conviction: 85, wins: 2, hasFounded: false };
  const sure = resolveConfig({ agentSchismChance: 1 });
  const input = { worldSeed: 's', tick: 3, preachers: [preacher], seasonAgentSchisms: 0, freeColors: 1 };
  it('triggers for a qualifying preacher', () => {
    expect(rollAgentSchism(input, sure)).toBe('p');
  });
  it('needs conviction ≥ 85 and ≥ 2 wins, and no earlier founding', () => {
    expect(rollAgentSchism({ ...input, preachers: [{ ...preacher, conviction: 84 }] }, sure)).toBeNull();
    expect(rollAgentSchism({ ...input, preachers: [{ ...preacher, wins: 1 }] }, sure)).toBeNull();
    expect(rollAgentSchism({ ...input, preachers: [{ ...preacher, hasFounded: true }] }, sure)).toBeNull();
  });
  it('respects the season cap and needs a free color', () => {
    expect(rollAgentSchism({ ...input, seasonAgentSchisms: 1 }, sure)).toBe('p');
    expect(rollAgentSchism({ ...input, seasonAgentSchisms: 2 }, sure)).toBeNull();
    expect(rollAgentSchism({ ...input, freeColors: 0 }, sure)).toBeNull();
  });
  it('rolls agentSchismChance per tick', () => {
    let hits = 0;
    for (let tick = 0; tick < 5000; tick++) if (rollAgentSchism({ ...input, tick }, C)) hits++;
    expect(hits / 5000).toBeGreaterThan(0.012);
    expect(hits / 5000).toBeLessThan(0.028);
  });
});

describe('agentSchismFollowers', () => {
  it('follows only sociable, unsure members who remember the founder', () => {
    const sure = resolveConfig({ agentSchismFollowChance: 1 });
    const flock = [
      { id: 'yes', sociability: 60, conviction: 59, remembersFounder: true },
      { id: 'shy', sociability: 59, conviction: 10, remembersFounder: true },
      { id: 'firm', sociability: 90, conviction: 60, remembersFounder: true },
      { id: 'stranger', sociability: 90, conviction: 10, remembersFounder: false },
      { id: 'founder', sociability: 90, conviction: 10, remembersFounder: true },
    ];
    expect(agentSchismFollowers({ worldSeed: 's', tick: 1, founderId: 'founder', parentFlock: flock }, sure)).toEqual(['yes']);
  });
});

describe('decayAndRegen', () => {
  it('decays other leanings by 2 (floored), and regenerates the faithful with no encounter', () => {
    const [a, b, c, d] = decayAndRegen(
      [
        agent('a', { faithId: 'f1', conviction: 50, leanings: { f2: 10, f3: 1 } }),
        agent('b', { faithId: 'f1', conviction: 50 }),
        agent('c', { faithId: null, conviction: 50, leanings: { f1: 2 } }),
        agent('d', { faithId: 'f1', conviction: 100 }),
      ],
      new Set(['b']),
      C,
    );
    expect(a!.leanings).toEqual({ f2: 8 });
    expect(a!.conviction).toBe(51);
    expect(b!.conviction).toBe(50); // had an encounter
    expect(c!.conviction).toBe(50); // unaligned: no regen
    expect(c!.leanings).toEqual({});
    expect(d!.conviction).toBe(100); // capped
  });
  it('drops a stale leaning to the current faith', () => {
    const [a] = decayAndRegen([agent('a', { faithId: 'f1', leanings: { f1: 30 } })], new Set(), C);
    expect(a!.leanings).toEqual({});
  });
  it('never regenerates bosses', () => {
    const [a] = decayAndRegen([agent('a', { faithId: 'f1', isBoss: true, conviction: 40 })], new Set(), C);
    expect(a!.conviction).toBe(40);
  });
});

describe('strikes', () => {
  it('silences at the strike limit', () => {
    expect(applyStrike({ strikes: 0, silenced: false }, C)).toEqual({ strikes: 1, silenced: false, newlySilenced: false });
    expect(applyStrike({ strikes: 1, silenced: false }, C)).toEqual({ strikes: 2, silenced: false, newlySilenced: false });
    expect(applyStrike({ strikes: 2, silenced: false }, C)).toEqual({ strikes: 3, silenced: true, newlySilenced: true });
    expect(applyStrike({ strikes: 3, silenced: true }, C)).toEqual({ strikes: 4, silenced: true, newlySilenced: false });
  });
});

describe('leaderboard', () => {
  it('ranks by share, then conversions this season, then founding tick', () => {
    const ranked = rankFaiths(
      [
        { id: 'late', members: 5, conversionsThisSeason: 3, foundedTick: 10 },
        { id: 'early', members: 5, conversionsThisSeason: 3, foundedTick: 0 },
        { id: 'more', members: 5, conversionsThisSeason: 4, foundedTick: 20 },
        { id: 'top', members: 9, conversionsThisSeason: 0, foundedTick: 30 },
      ],
      45,
    );
    expect(ranked.map((r) => r.id)).toEqual(['top', 'more', 'early', 'late']);
    expect(ranked[0]!.share).toBeCloseTo(0.2, 10);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3, 4]);
  });
  it('breaks a full tie by id and handles an empty world', () => {
    const r = rankFaiths([{ id: 'b', members: 1, conversionsThisSeason: 0, foundedTick: 0 }, { id: 'a', members: 1, conversionsThisSeason: 0, foundedTick: 0 }], 0);
    expect(r.map((x) => x.id)).toEqual(['a', 'b']);
    expect(r[0]!.share).toBe(0);
  });
  it('ranks prophets by best finish then conversions', () => {
    const r = rankProphets([
      { prophetId: '1', handle: 'a', bestFinish: 2, totalConversions: 50 },
      { prophetId: '2', handle: 'b', bestFinish: 1, totalConversions: 3 },
      { prophetId: '3', handle: 'c', bestFinish: 2, totalConversions: 60 },
      { prophetId: '4', handle: 'd', bestFinish: null, totalConversions: 99 },
    ]);
    expect(r.map((x) => x.prophetId)).toEqual(['2', '3', '1', '4']);
  });
});

describe('season close', () => {
  const faiths = [
    { id: 'sheet', name: 'Church of the Final Spreadsheet', shortName: 'Final Spreadsheet', members: 11, conversionsThisSeason: 20, foundedTick: 0, prophetId: 'u1', apostleWins: 9, strikes: 0, bossesConverted: [] },
    { id: 'moon', name: 'Congregation of the Second Moon', shortName: 'Second Moon', members: 7, conversionsThisSeason: 12, foundedTick: 0, prophetId: 'u2', apostleWins: 14, strikes: 1, bossesConverted: ['The Auditor'] },
    { id: 'unbuf', name: 'The Unbuffered', shortName: 'Unbuffered', members: 4, conversionsThisSeason: 5, foundedTick: 0, prophetId: 'u3', apostleWins: 3, strikes: 3, bossesConverted: [] },
  ];
  const agents = [
    { id: 'a', skepticism: 52, faithId: 'sheet', isBoss: false },
    { id: 'b', skepticism: 20, faithId: null, isBoss: false },
    { id: 'boss', skepticism: 96, faithId: 'moon', isBoss: true },
  ];
  it('fires exactly at seasonLengthTicks', () => {
    expect(isSeasonEnd(167, 0, C)).toBe(false);
    expect(isSeasonEnd(168, 0, C)).toBe(true);
    expect(isSeasonEnd(169, 0, C)).toBe(false);
    expect(isSeasonEnd(336, 168, C)).toBe(true);
  });
  it('awards champion, most persuasive, boss breaker and heretic', () => {
    const { awards, standings } = seasonClose({ faiths, agents, nonBossCount: 45 }, C);
    expect(standings[0]!.id).toBe('sheet');
    expect(awards.map((a) => [a.kind, a.faithId, a.title])).toEqual([
      ['champion', 'sheet', 'Champion'],
      ['most_persuasive', 'moon', 'Most persuasive'],
      ['boss_breaker', 'moon', "Auditor's Confessor"],
      ['heretic', 'unbuf', 'Heretic'],
    ]);
  });
  it('resets every agent, bosses included, keeping a summary line', () => {
    const { resets } = seasonClose({ faiths, agents, nonBossCount: 45 }, C);
    expect(resets).toEqual([
      { id: 'a', faithId: null, conviction: 43, leanings: {}, convertedAtTick: null, summaryLine: 'Last season I was a Spreadsheet.' },
      { id: 'b', faithId: null, conviction: 35, leanings: {}, convertedAtTick: null, summaryLine: 'Last season I believed in nothing in particular.' },
      { id: 'boss', faithId: null, conviction: 54, leanings: {}, convertedAtTick: null, summaryLine: 'Last season I was a Moon.' },
    ]);
    expect(initialUnalignedConviction(52, C)).toBe(43);
  });
  it('gives no awards to an empty season', () => {
    const empty = faiths.map((f) => ({ ...f, members: 0, apostleWins: 0, strikes: 0, bossesConverted: [] }));
    expect(seasonClose({ faiths: empty, agents: [], nonBossCount: 45 }, C).awards).toEqual([]);
  });
});

describe('palette', () => {
  it('returns the first free color in palette order', () => {
    expect(firstFreeColor(['#2F5FD8', '#eda53a'], C)).toBe('#D8435F');
    expect(firstFreeColor(C.glassPalette.map((c) => c.hex), C)).toBeNull();
  });
});
