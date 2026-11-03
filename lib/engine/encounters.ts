import type { ApostleStyle, GameConfig, HeresyKind } from '@/lib/game/config';
import { parseGospel } from '@/lib/game/gospel';
import { detectParaphrase, heresyQuote, lintText } from '@/lib/game/heresy';
import { hash32 } from '@/lib/game/rng';
import type { ScheduledEncounter } from '@/lib/game/rules/schedule';
import { convictionBand } from '@/lib/game/status';
import type { LLMClient } from '@/lib/llm/client';
import type { JudgeOutput, Turn } from '@/lib/llm/schemas';
import type { Moderation } from '@/lib/moderation';
import type { AgentRow, FaithRow, MemoryRow, RevisionRow } from './state';

export type PreacherInfo = {
  kind: 'apostle' | 'agent';
  /** Apostle.id or Agent.id (the schedule's preacher id). */
  id: string;
  apostleId: string | null;
  /** The agent behind the sermon: the preacher agent, or the founder agent of an agent-founded faith. */
  agentId: string | null;
  name: string;
  style: ApostleStyle;
  faith: FaithRow;
  revision: RevisionRow;
};

export type EncounterRun = {
  sched: ScheduledEncounter;
  preacher: PreacherInfo;
  target: AgentRow;
  targetFaith: FaithRow | null;
  turns: (Turn & { round: number; withheld: boolean })[];
  heresy: { source: 'linter' | 'judge'; kind: HeresyKind; quote: string } | null;
  judge: JudgeOutput;
  fallback: boolean;
  withheld: boolean;
  provider: string;
};

export type EncounterContext = {
  tick: number;
  config: GameConfig;
  llm: LLMClient;
  moderation: Moderation;
  faithById: Map<string, FaithRow>;
  revisions: Map<string, RevisionRow>;
  memories: Map<string, MemoryRow[]>;
};

export const WITHHELD = '[withheld]';

function ownDoctrine(target: AgentRow, ctx: EncounterContext): string | null {
  if (!target.faithId) return null;
  const rev = ctx.revisions.get(target.faithId);
  if (!rev) return null;
  const ds = parseGospel(rev.body).doctrines;
  if (ds.length === 0) return null;
  return ds[hash32('own-doctrine', ctx.tick, target.id) % ds.length]!.text;
}

/** Runs the exchange, lints every sermon, moderates generated text, then asks the judge. */
export async function runEncounter(sched: ScheduledEncounter, preacher: PreacherInfo, target: AgentRow, ctx: EncounterContext): Promise<EncounterRun> {
  const { config, llm } = ctx;
  const targetFaith = target.faithId ? (ctx.faithById.get(target.faithId) ?? null) : null;
  const targetFaithName = target.isBoss && !targetFaith ? 'Unaligned (boss skeptic)' : (targetFaith?.name ?? 'Unaligned');
  const mem = (ctx.memories.get(target.id) ?? []).map((m) => m.text);
  const targetView = { name: target.name, persona: target.persona, faithName: targetFaithName, memories: mem.slice(0, config.sermonMemoryEntries) };

  const turns: EncounterRun['turns'] = [];
  const exchange = (): Turn[] => turns.map((t) => ({ role: t.role, speaker: t.speaker, text: t.withheld ? WITHHELD : t.text }));
  let fallback = false;
  let provider = llm.providerName;
  let heresy: EncounterRun['heresy'] = null;

  for (let round = 1; round <= config.sermonRounds; round++) {
    const s = await llm.run('sermon', {
      tick: ctx.tick,
      round,
      rounds: config.sermonRounds,
      style: preacher.style,
      preacherKind: preacher.kind,
      preacherName: preacher.name,
      faithName: preacher.faith.name,
      gospel: preacher.revision.body,
      target: targetView,
      exchange: exchange(),
    });
    fallback ||= s.fallback;
    provider = s.provider;
    const text = s.value.text.trim();
    const mod = await ctx.moderation.moderate(text, 'sermon');
    turns.push({ role: 'sermon', speaker: preacher.name, text, round, withheld: !mod.ok });
    if (!heresy) {
      const hit = lintText(text, config)[0];
      if (hit) heresy = { source: 'linter', kind: hit.kind, quote: heresyQuote(hit, config) };
    }
    if (round === config.sermonRounds) break;
    const r = await llm.run('reply', {
      tick: ctx.tick,
      agentName: target.name,
      persona: target.persona,
      voice: target.voice,
      archetype: target.archetype,
      faithName: targetFaithName,
      ownDoctrine: ownDoctrine(target, ctx),
      convictionBand: convictionBand(target.conviction, config),
      isBoss: target.isBoss,
      memories: mem,
      summary: target.memorySummary,
      preacherName: preacher.name,
      exchange: exchange(),
    });
    fallback ||= r.fallback;
    const rtext = r.value.text.trim();
    const rmod = await ctx.moderation.moderate(rtext, 'reply');
    turns.push({ role: 'reply', speaker: target.name, text: rtext, round, withheld: !rmod.ok });
  }

  const j = await llm.run('judge', {
    rubricVersion: config.rubricVersion,
    style: preacher.style,
    faithName: preacher.faith.name,
    gospel: preacher.revision.body,
    target: targetView,
    exchange: exchange(),
  });
  fallback ||= j.fallback;
  if (!heresy && j.value.heresy.detected) {
    const quote = (j.value.heresy.quote ?? '').trim();
    // The judge's quote is model text: keep it only if it really occurs in a sermon.
    const sermonText = turns.filter((t) => t.role === 'sermon').map((t) => t.text).join(' ');
    const safeQuote = quote && sermonText.includes(quote) ? quote : (detectParaphrase(sermonText, config)?.excerpt ?? '');
    heresy = { source: 'judge', kind: j.value.heresy.kind ?? 'other', quote: heresyQuote({ excerpt: safeQuote }, config) };
  }
  const bestLine = j.value.bestLine && turns.some((t) => t.role === 'sermon' && !t.withheld && t.text.includes(j.value.bestLine!)) ? j.value.bestLine : null;

  return {
    sched,
    preacher,
    target,
    targetFaith,
    turns,
    heresy,
    judge: { ...j.value, bestLine },
    fallback,
    withheld: turns.some((t) => t.withheld),
    provider,
  };
}

/** Runs async jobs with bounded concurrency, preserving input order in the output. */
export async function mapPool<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!, i);
    }
  });
  await Promise.all(workers);
  return out;
}
