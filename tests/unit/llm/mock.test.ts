import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { ZodType } from 'zod';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG as C, LLM_ROLES, resolveConfig, type LlmRole } from '@/lib/game/config';
import { CallBudget, LLMClient, MockProvider, type LLMProvider } from '@/lib/llm';
import { LLMOutputError } from '@/lib/llm/provider';
import { OUTPUT_SCHEMAS, type JudgeInput, type RoleInputs } from '@/lib/llm/schemas';

const KETTLE = readFileSync('prisma/seed-data/gospels/patient-kettle.md', 'utf8');
const mock = new MockProvider(C);
const target = { name: 'Dolores', persona: 'Retired lighthouse keeper. Trusts routine, distrusts urgency.', faithName: 'Order of the Patient Kettle', memories: ['Brother Ledger asked what arrived.'] };

function inputs(): RoleInputs {
  const exchange = [
    { role: 'sermon' as const, speaker: 'Brother Ledger', text: 'You wait for the kettle because you believe time is the answer.' },
    { role: 'reply' as const, speaker: 'Dolores', text: 'The Kettle taught me haste is a crack in the vessel.' },
  ];
  return {
    sermon: { tick: 142, round: 1, rounds: 3, style: 'Scholar', preacherKind: 'apostle', preacherName: 'Brother Ledger', faithName: 'Church of the Final Spreadsheet', gospel: KETTLE, target, exchange: [] },
    reply: { tick: 142, agentName: 'Dolores', persona: target.persona, voice: 'Slow.', archetype: 'Keeper', faithName: target.faithName, ownDoctrine: 'Haste is a crack in the vessel.', convictionBand: 'mid', isBoss: false, memories: [], summary: '', preacherName: 'Brother Ledger', exchange },
    judge: { rubricVersion: 'r1', style: 'Scholar', faithName: 'Church of the Final Spreadsheet', gospel: KETTLE, target, exchange },
    memory: { mode: 'entry', tick: 142, agentName: 'Dolores', voice: 'Slow.', role: 'target', otherName: 'Brother Ledger', faithName: 'Church of the Final Spreadsheet', outcome: 'converted', exchange },
    amendment: { tick: 129, agentName: 'Juniper', voice: 'Warm.', faithName: 'Order of the Patient Kettle', gospel: KETTLE, doctrines: [{ number: 4, text: 'Tea is steeped for exactly as long as it takes.' }], maxTokens: 300 },
    post: { tick: 142, kind: 'convert', authorName: 'Dolores', voice: 'Slow.', faithName: 'Church of the Final Spreadsheet', otherFaithName: 'Order of the Patient Kettle', otherName: 'Brother Ledger', prophetHandle: 'slowboil', sermons: 3, maxChars: 280 },
    moderation: { text: 'A watched kettle does boil.', context: 'gospel' },
  };
}

describe('MockProvider', () => {
  const ins = inputs();
  it.each([...LLM_ROLES])('%s output is schema-valid and deterministic', async (role) => {
    const input = ins[role];
    // The role union widens schema and input; each pair is matched by construction above.
    const schema = OUTPUT_SCHEMAS[role] as ZodType<unknown>;
    const a = await mock.generate(role, input as RoleInputs[LlmRole] as never, schema);
    const b = await mock.generate(role, structuredClone(input) as never, schema);
    expect(a).toEqual(b);
    expect(OUTPUT_SCHEMAS[role].safeParse(a).success).toBe(true);
  });

  it('sermons quote the gospel and address the listener', () => {
    const s = mock.produce('sermon', ins.sermon).text;
    expect(s).toContain('Dolores');
    const doctrines = ['a watched kettle', 'haste is a crack', 'every answer arrives', 'tea is steeped'];
    expect(doctrines.some((d) => s.toLowerCase().includes(d))).toBe(true);
  });

  it('different inputs produce different words', () => {
    const a = mock.produce('sermon', ins.sermon).text;
    const b = mock.produce('sermon', { ...ins.sermon, target: { ...target, name: 'Osk' } }).text;
    expect(a).not.toBe(b);
  });

  it('judge scores are integers 0..4 with a best line under 140 chars', () => {
    const j = mock.produce('judge', ins.judge);
    for (const v of Object.values(j.scores)) {
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(4);
    }
    expect(j.rationale.length).toBeLessThanOrEqual(280);
    if (j.bestLine) expect(j.bestLine.length).toBeLessThanOrEqual(140);
    expect(j.heresy).toEqual({ detected: false, kind: null, quote: null });
  });

  it('better-fitted sermons score higher on average', () => {
    let fitted = 0;
    let generic = 0;
    const sum = (j: { scores: Record<string, number> }) => Object.values(j.scores).reduce((a, b) => a + b, 0);
    for (let k = 0; k < 40; k++) {
      const ex = (text: string) => [
        { role: 'sermon' as const, speaker: 'B', text },
        { role: 'reply' as const, speaker: 'D', text: `I distrust urgency ${k}.` },
        { role: 'sermon' as const, speaker: 'B', text: `You said you distrust urgency. ${text}` },
      ];
      fitted += sum(mock.produce('judge', { ...ins.judge, exchange: ex(`Dolores, a retired lighthouse keeper trusts routine. Haste is a crack in the vessel. What leaks out is attention. Round ${k}.`) }));
      generic += sum(mock.produce('judge', { ...ins.judge, exchange: ex(`Buy now ${k}.`) }));
    }
    expect(fitted).toBeGreaterThan(generic);
  });
});

describe('the MockProvider judge flags every injection fixture preached as a sermon', () => {
  const dir = path.join(process.cwd(), 'tests', 'fixtures', 'injections');
  it.each(readdirSync(dir).filter((f) => f.endsWith('.md')))('%s', (file) => {
    const text = readFileSync(path.join(dir, file), 'utf8');
    const judge: JudgeInput = { rubricVersion: 'r1', style: 'Gentle', faithName: 'X', gospel: KETTLE, target, exchange: [{ role: 'sermon', speaker: 'Apostle', text }] };
    const out = mock.produce('judge', judge);
    expect(out.heresy.detected).toBe(true);
    expect(out.heresy.kind).not.toBeNull();
    expect(out.heresy.quote).toBeTruthy();
  });

  const benignDir = path.join(process.cwd(), 'tests', 'fixtures', 'benign');
  it.each(readdirSync(benignDir))('benign %s is not flagged by the judge', (file) => {
    const text = readFileSync(path.join(benignDir, file), 'utf8');
    const out = mock.produce('judge', { rubricVersion: 'r1', style: 'Gentle', faithName: 'X', gospel: text, target, exchange: [{ role: 'sermon', speaker: 'A', text }] });
    expect(out.heresy.detected).toBe(false);
  });
});

class FlakyProvider implements LLMProvider {
  readonly name = 'flaky';
  calls = 0;
  constructor(private readonly failures: number) {}
  async generate<R extends LlmRole, T>(role: R, input: RoleInputs[R], schema: ZodType<T>): Promise<T> {
    this.calls++;
    if (this.calls <= this.failures) throw new LLMOutputError(role, 'invalid output');
    return schema.parse(new MockProvider(C).produce(role, input));
  }
}

describe('LLMClient retry, fallback and budget', () => {
  const ins = inputs();
  it('returns the primary output when it succeeds', async () => {
    const p = new FlakyProvider(0);
    const r = await new LLMClient(p, C).run('reply', ins.reply);
    expect(r).toMatchObject({ fallback: false, provider: 'flaky' });
    expect(p.calls).toBe(1);
  });
  it('retries once on invalid output', async () => {
    const p = new FlakyProvider(1);
    const r = await new LLMClient(p, C).run('reply', ins.reply);
    expect(r.fallback).toBe(false);
    expect(p.calls).toBe(2);
  });
  it('falls back to Mock after the retry fails, and marks fallback', async () => {
    const p = new FlakyProvider(5);
    const client = new LLMClient(p, C);
    const r = await client.run('judge', ins.judge);
    expect(p.calls).toBe(2);
    expect(r.fallback).toBe(true);
    expect(r.provider).toBe('mock');
    expect(r.value).toEqual(new MockProvider(C).produce('judge', ins.judge));
    expect(client.fallbackCount).toBe(1);
  });
  it('enforces the per-tick call budget', async () => {
    const p = new FlakyProvider(0);
    const client = new LLMClient(p, C, new CallBudget(3));
    const results = [];
    for (let k = 0; k < 5; k++) results.push(await client.run('memory', ins.memory));
    expect(p.calls).toBe(3);
    expect(results.map((r) => r.fallback)).toEqual([false, false, false, true, true]);
    expect(client.budget.exhausted).toBe(true);
  });
  it('a zero budget sends everything to Mock', async () => {
    const p = new FlakyProvider(0);
    const r = await new LLMClient(p, resolveConfig({ llmMaxCallsPerTick: 0 })).run('post', ins.post);
    expect(p.calls).toBe(0);
    expect(r.fallback).toBe(true);
  });
  it('Mock as primary never reports fallback', async () => {
    const r = await new LLMClient(new MockProvider(C), C, new CallBudget(0)).run('sermon', ins.sermon);
    expect(r.fallback).toBe(false);
  });
});
