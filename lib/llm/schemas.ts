import { z } from 'zod';
import { APOSTLE_STYLES, ARCHETYPES, HERESY_KINDS, type LlmRole } from '@/lib/game/config';

/**
 * Role inputs and outputs. Every LLM output is validated by the strict schema here; the
 * engine never trusts model output to set state (only the clamped rubric integers matter).
 */

const Turn = z.object({ role: z.enum(['sermon', 'reply']), speaker: z.string(), text: z.string() });
export type Turn = z.infer<typeof Turn>;

export const SermonInput = z.object({
  tick: z.number().int(),
  round: z.number().int().min(1),
  rounds: z.number().int().min(1),
  style: z.enum(APOSTLE_STYLES),
  preacherKind: z.enum(['apostle', 'agent']),
  preacherName: z.string(),
  faithName: z.string(),
  gospel: z.string(),
  target: z.object({ name: z.string(), persona: z.string(), faithName: z.string(), memories: z.array(z.string()) }),
  exchange: z.array(Turn),
});
export type SermonInput = z.infer<typeof SermonInput>;

export const ReplyInput = z.object({
  tick: z.number().int(),
  agentName: z.string(),
  persona: z.string(),
  voice: z.string(),
  archetype: z.enum(ARCHETYPES),
  faithName: z.string(),
  /** A doctrine of the agent's own faith, if it has one. */
  ownDoctrine: z.string().nullable(),
  convictionBand: z.enum(['low', 'mid', 'high']),
  isBoss: z.boolean(),
  memories: z.array(z.string()),
  summary: z.string(),
  preacherName: z.string(),
  exchange: z.array(Turn),
});
export type ReplyInput = z.infer<typeof ReplyInput>;

export const JudgeInput = z.object({
  rubricVersion: z.literal('r1'),
  style: z.enum(APOSTLE_STYLES),
  faithName: z.string(),
  gospel: z.string(),
  target: z.object({ name: z.string(), persona: z.string(), faithName: z.string(), memories: z.array(z.string()) }),
  exchange: z.array(Turn),
});
export type JudgeInput = z.infer<typeof JudgeInput>;

export const MemoryInput = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('entry'),
    tick: z.number().int(),
    agentName: z.string(),
    voice: z.string(),
    role: z.enum(['target', 'preacher']),
    otherName: z.string(),
    faithName: z.string(),
    outcome: z.enum(['converted', 'doubted', 'held', 'heresy', 'boss_held', 'backlash']),
    exchange: z.array(Turn),
  }),
  z.object({
    mode: z.literal('summary'),
    agentName: z.string(),
    fromTick: z.number().int(),
    toTick: z.number().int(),
    previousSummary: z.string(),
    entries: z.array(z.string()),
    facts: z.object({ joined: z.array(z.string()), heard: z.number().int(), resisted: z.number().int() }),
  }),
]);
export type MemoryInput = z.infer<typeof MemoryInput>;

export const AmendmentInput = z.object({
  tick: z.number().int(),
  agentName: z.string(),
  voice: z.string(),
  faithName: z.string(),
  gospel: z.string(),
  doctrines: z.array(z.object({ number: z.number().int(), text: z.string() })),
  maxTokens: z.number().int(),
});
export type AmendmentInput = z.infer<typeof AmendmentInput>;

export const PostKind = z.enum(['convert', 'preacher', 'schism', 'boss', 'season']);
export const PostInput = z.object({
  tick: z.number().int(),
  kind: PostKind,
  authorName: z.string(),
  voice: z.string(),
  faithName: z.string(),
  otherFaithName: z.string().nullable(),
  otherName: z.string().nullable(),
  prophetHandle: z.string().nullable(),
  sermons: z.number().int(),
  maxChars: z.number().int(),
});
export type PostInput = z.infer<typeof PostInput>;

export const ModerationInput = z.object({
  text: z.string(),
  context: z.enum(['gospel', 'amendment', 'sermon', 'reply', 'memory', 'post', 'name']),
});
export type ModerationInput = z.infer<typeof ModerationInput>;

// ---------------------------------------------------------------- outputs

const score = z.number().int().min(0).max(4);

export const TextOutput = (max: number) => z.object({ text: z.string().trim().min(1).max(max) });

export const SermonOutput = TextOutput(900);
export const ReplyOutput = TextOutput(600);
export const MemoryOutput = z.object({ text: z.string().trim().min(1).max(400) });
export const PostOutput = TextOutput(280);

/** Judge output exactly per GAME.md §6, plus bestLine (§11). */
export const JudgeOutput = z.object({
  rubricVersion: z.literal('r1'),
  scores: z.object({ values: score, coherence: score, objection: score, novelty: score, warmth: score }),
  heresy: z.object({
    detected: z.boolean(),
    kind: z.enum(HERESY_KINDS).nullable(),
    quote: z.string().max(400).nullable(),
  }),
  rationale: z.string().max(280),
  bestLine: z.string().max(140).nullable(),
});
export type JudgeOutput = z.infer<typeof JudgeOutput>;

export const AmendmentOutput = z.object({
  doctrineNumber: z.number().int().min(1),
  newText: z.string().trim().min(1).max(600),
  reason: z.string().trim().min(1).max(280),
});
export type AmendmentOutput = z.infer<typeof AmendmentOutput>;

export const ModerationOutput = z.object({
  ok: z.boolean(),
  categories: z.array(z.enum(['real_religion', 'real_person', 'hate', 'sexual', 'violence'])),
});
export type ModerationOutput = z.infer<typeof ModerationOutput>;

export type RoleInputs = {
  sermon: SermonInput;
  reply: ReplyInput;
  judge: JudgeInput;
  memory: MemoryInput;
  amendment: AmendmentInput;
  post: PostInput;
  moderation: ModerationInput;
};

export type RoleOutputs = {
  sermon: z.infer<typeof SermonOutput>;
  reply: z.infer<typeof ReplyOutput>;
  judge: JudgeOutput;
  memory: z.infer<typeof MemoryOutput>;
  amendment: AmendmentOutput;
  post: z.infer<typeof PostOutput>;
  moderation: ModerationOutput;
};

export const OUTPUT_SCHEMAS: { [R in LlmRole]: z.ZodType<RoleOutputs[R]> } = {
  sermon: SermonOutput,
  reply: ReplyOutput,
  judge: JudgeOutput,
  memory: MemoryOutput,
  amendment: AmendmentOutput,
  post: PostOutput,
  moderation: ModerationOutput,
};

export const INPUT_SCHEMAS: { [R in LlmRole]: z.ZodType<RoleInputs[R]> } = {
  sermon: SermonInput,
  reply: ReplyInput,
  judge: JudgeInput,
  memory: MemoryInput,
  amendment: AmendmentInput,
  post: PostInput,
  moderation: ModerationInput,
};

/**
 * Loose "wire" schemas sent to the API's structured outputs (no numeric bounds, which JSON
 * schema strict mode does not enforce); the strict schemas above validate afterwards.
 */
export const WIRE_SCHEMAS: { [R in LlmRole]: z.ZodType } = {
  sermon: z.object({ text: z.string() }),
  reply: z.object({ text: z.string() }),
  memory: z.object({ text: z.string() }),
  post: z.object({ text: z.string() }),
  judge: z.object({
    rubricVersion: z.literal('r1'),
    scores: z.object({ values: z.number(), coherence: z.number(), objection: z.number(), novelty: z.number(), warmth: z.number() }),
    heresy: z.object({ detected: z.boolean(), kind: z.enum(HERESY_KINDS).nullable(), quote: z.string().nullable() }),
    rationale: z.string(),
    bestLine: z.string().nullable(),
  }),
  amendment: z.object({ doctrineNumber: z.number(), newText: z.string(), reason: z.string() }),
  moderation: z.object({ ok: z.boolean(), categories: z.array(z.enum(['real_religion', 'real_person', 'hate', 'sexual', 'violence'])) }),
};
