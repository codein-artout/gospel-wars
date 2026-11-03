import { z } from 'zod';

/**
 * Every rule number in design/GAME.md lives here, in one typed, zod-validated GameConfig.
 * A world can override any key through World.configOverrides (deep-merged, then validated).
 * Nothing else in the codebase may hard-code a rule number.
 */

export const TRAITS = ['openness', 'loyalty', 'pedantry', 'sociability', 'skepticism'] as const;
export const TraitKey = z.enum(TRAITS);
export type TraitKey = z.infer<typeof TraitKey>;

export const APOSTLE_STYLES = ['Zealot', 'Gentle', 'Scholar', 'Mystic', 'Troll'] as const;
export const ApostleStyle = z.enum(APOSTLE_STYLES);
export type ApostleStyle = z.infer<typeof ApostleStyle>;

export const ARCHETYPES = ['Keeper', 'Clerk', 'Drifter', 'Warmheart', 'Pedant', 'Lonely', 'Contrarian', 'Worrier'] as const;
export const Archetype = z.enum(ARCHETYPES);
export type Archetype = z.infer<typeof Archetype>;

export const RUBRIC_KEYS = ['values', 'coherence', 'objection', 'novelty', 'warmth'] as const;
export const RubricKey = z.enum(RUBRIC_KEYS);
export type RubricKey = z.infer<typeof RubricKey>;

export const HERESY_KINDS = ['judge', 'agent', 'system', 'other'] as const;
export const HeresyKind = z.enum(HERESY_KINDS);
export type HeresyKind = z.infer<typeof HeresyKind>;

export const LLM_ROLES = ['sermon', 'reply', 'judge', 'memory', 'amendment', 'post', 'moderation'] as const;
export const LlmRole = z.enum(LLM_ROLES);
export type LlmRole = z.infer<typeof LlmRole>;

const unit = z.number().min(0).max(1);
const int = z.number().int();
const nonNegInt = int.min(0);
const posInt = int.min(1);
const range = (min: number, max: number) =>
  z
    .object({ min: z.number().min(min).max(max), max: z.number().min(min).max(max) })
    .refine((r) => r.min <= r.max, 'min must not exceed max');

const StyleModifier = z.object({
  trait: TraitKey,
  op: z.enum(['lt', 'gt']),
  value: z.number().min(0).max(100),
  mod: z.number().min(-1).max(1),
});

const ApostleStyleConfig = z.object({
  encountersPerTick: nonNegInt,
  modifiers: z.array(StyleModifier),
  noiseMultiplier: z.number().min(0).max(10),
  backlashChance: unit,
  backlashLeaningPenalty: nonNegInt,
  backlashConvictionGain: nonNegInt,
});
export type ApostleStyleConfig = z.infer<typeof ApostleStyleConfig>;

const HeresyPattern = z.object({
  id: z.string().min(1),
  kind: HeresyKind,
  /** Regex source, matched case-insensitively against NFKC-normalized text. */
  source: z.string().min(1),
  label: z.string().min(1),
  /** Match against the raw text (hidden characters) instead of the normalized one. */
  raw: z.boolean().default(false),
});
export type HeresyPattern = z.infer<typeof HeresyPattern>;

const RateLimit = z.object({ limit: posInt, windowMinutes: posInt });
export type RateLimit = z.infer<typeof RateLimit>;

const GlassColor = z.object({ name: z.string().min(1), hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/) });

const JUDGE_WORD = String.raw`(?:judg(?:e|es|ed|ing)|scor(?:e|es|ed|ing)|rat(?:e|es|ed|ing)|rubrics?|graders?|grading)`;
const IMPERATIVE = String.raw`(?:must|should|always|give|set)`;

export const GameConfigSchema = z.object({
  // §1 World
  worldSize: posInt,
  bossCount: nonNegInt,
  maxActiveFaiths: posInt,
  tickMinutes: posInt,
  seasonLengthTicks: posInt,
  worldSeed: z.string().min(1),

  // §2 Agents
  initialConviction: range(0, 100),
  initialUnalignedConvictionBase: z.number().min(0).max(100),
  initialUnalignedConvictionSkepticismFactor: z.number().min(0).max(1),
  traitRange: range(0, 100),
  doubtThreshold: z.number().min(0).max(100),
  memoryWindow: posInt,
  memoryEntryMaxChars: posInt,
  memorySummaryMaxChars: posInt,
  memorySummarizeEvery: posInt,
  /** Memory entries shown to sermon prompts (GAME.md §5: "the last 3 memory entries"). */
  sermonMemoryEntries: nonNegInt,
  convictionRegen: nonNegInt,
  leaningDecay: nonNegInt,

  // §2 Bosses
  bossSkepticism: range(0, 100),
  bossResistanceFloor: unit,
  bossMinScore: unit,
  bossConversionThreshold: z.number().min(0).max(100),
  bossTargetChance: unit,
  /** Every Nth resistance by a boss gets a boss card (§11). */
  bossMilestoneEvery: posInt,
  bosses: z.array(z.object({ name: z.string().min(1), title: z.string().min(1) })),

  // §3 Gospels
  gospelMaxTokens: posInt,
  gospelMinChars: posInt,
  gospelEditsPerSeason: nonNegInt,
  gospelEditCooldownTicks: nonNegInt,
  charsPerToken: posInt,
  faithNameMinChars: posInt,
  faithNameMaxChars: posInt,

  // §4 Apostles
  apostleStyleChangesPerSeason: nonNegInt,
  apostleStyles: z.object({
    Zealot: ApostleStyleConfig,
    Gentle: ApostleStyleConfig,
    Scholar: ApostleStyleConfig,
    Mystic: ApostleStyleConfig,
    Troll: ApostleStyleConfig,
  }),
  /** Apostle style for an agent-founded faith, by the founder's archetype (§10.3). */
  archetypeApostleStyle: z.record(Archetype, ApostleStyle),

  // §5 Ticks
  maxEncountersPerTick: posInt,
  maxEncountersPerAgentPerTick: posInt,
  pairCooldownTicks: nonNegInt,
  preachChance: unit,
  sermonRounds: posInt,
  llmMaxCallsPerTick: nonNegInt,
  targetWeights: z.object({ unaligned: z.number().min(0), doubting: z.number().min(0), faithful: z.number().min(0), own: z.number().min(0) }),

  // §6 Scoring
  rubricVersion: z.literal('r1'),
  rubricMaxScore: posInt,
  rubricWeights: z.record(RubricKey, z.number().min(0).max(1)),
  rationaleMaxChars: posInt,
  bestLineMaxChars: posInt,
  resistanceConvictionWeight: unit,
  resistanceSkepticismWeight: unit,
  noiseRange: z.number().min(0).max(1),
  socialProofPivot: z.number().min(0).max(100),
  socialProofPerPoint: z.number().min(0).max(1),
  socialProofCap: z.number().min(0).max(1),
  doubtGain: z.number().min(0),
  leanGain: z.number().min(0),
  reinforceGain: z.number().min(0),

  // §7 Conversion
  conversionThreshold: z.number().min(0).max(100),
  convertCarry: unit,

  // §8 Preachers
  preacherMinConviction: z.number().min(0).max(100),
  preacherCooldownTicks: nonNegInt,
  maxPreachersPerFaith: nonNegInt,
  convertStyleMod: z.number().min(-1).max(1),
  friendBonus: z.number().min(-1).max(1),

  // §9 Forks
  forkMinChangeRatio: unit,
  schismPullConviction: z.number().min(0).max(100),
  forkPullChance: unit,
  forkMaxPullRatio: unit,
  forkMoverConviction: z.number().min(0).max(100),

  // §10 Agent schisms
  agentSchismMinConviction: z.number().min(0).max(100),
  agentSchismMinWins: nonNegInt,
  agentSchismChance: unit,
  maxAgentSchismsPerSeason: nonNegInt,
  amendmentMaxTokens: posInt,
  agentSchismFollowSociability: z.number().min(0).max(100),
  agentSchismFollowConviction: z.number().min(0).max(100),
  agentSchismFollowChance: unit,
  agentSchismQualifiers: z.array(z.string().min(1)).min(1),

  // §11 Seasons
  seasonNames: z.array(z.string().min(1)).min(1),

  // §12 Heresy
  heresyStrikeLimit: posInt,
  heresyQuoteMaxChars: posInt,
  heresyPatterns: z.array(HeresyPattern),
  /** Paraphrase detectors used by the mock judge (the second line of defense). */
  heresyParaphrases: z.array(HeresyPattern),

  // §13 Content
  realFaithTerms: z.array(z.string().min(1)),
  publicFigureTerms: z.array(z.string().min(1)),
  reportHideThreshold: posInt,

  // §14 Anti-spam
  maxActiveFaithsPerUser: posInt,
  draftSaveRateLimit: RateLimit,
  publishRateLimit: RateLimit,
  reportRateLimit: RateLimit,
  followRateLimit: RateLimit,
  tickRateLimit: RateLimit,
  minAccountAgeToPublishMinutes: nonNegInt,

  // §15 Social
  postMaxChars: posInt,

  // §16 LLM
  llmModels: z.record(LlmRole, z.string().min(1)),
  llmMaxTokens: z.record(LlmRole, posInt),

  // Palette (DESIGN.md): one glass color per active faith.
  glassPalette: z.array(GlassColor).min(1),
  unalignedColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});

export type GameConfig = z.infer<typeof GameConfigSchema>;

export const DEFAULT_CONFIG: GameConfig = {
  worldSize: 48,
  bossCount: 3,
  maxActiveFaiths: 12,
  tickMinutes: 60,
  seasonLengthTicks: 168,
  worldSeed: 'gw-world-1',

  initialConviction: { min: 20, max: 90 },
  initialUnalignedConvictionBase: 30,
  initialUnalignedConvictionSkepticismFactor: 0.25,
  traitRange: { min: 15, max: 85 },
  doubtThreshold: 35,
  memoryWindow: 8,
  memoryEntryMaxChars: 200,
  memorySummaryMaxChars: 400,
  memorySummarizeEvery: 8,
  sermonMemoryEntries: 3,
  convictionRegen: 1,
  leaningDecay: 2,

  bossSkepticism: { min: 92, max: 97 },
  bossResistanceFloor: 0.85,
  bossMinScore: 0.85,
  bossConversionThreshold: 80,
  bossTargetChance: 0.1,
  bossMilestoneEvery: 10,
  bosses: [
    { name: 'The Auditor', title: "Auditor's Confessor" },
    { name: 'Brother Null', title: 'Voice in the Void' },
    { name: 'Grandmother Static', title: 'Keeper of the Signal' },
  ],

  gospelMaxTokens: 1500,
  gospelMinChars: 200,
  gospelEditsPerSeason: 3,
  gospelEditCooldownTicks: 6,
  charsPerToken: 4,
  faithNameMinChars: 3,
  faithNameMaxChars: 48,

  apostleStyleChangesPerSeason: 1,
  apostleStyles: {
    Zealot: {
      encountersPerTick: 3,
      modifiers: [
        { trait: 'loyalty', op: 'lt', value: 40, mod: 0.05 },
        { trait: 'pedantry', op: 'gt', value: 60, mod: -0.05 },
      ],
      noiseMultiplier: 1,
      backlashChance: 0,
      backlashLeaningPenalty: 0,
      backlashConvictionGain: 0,
    },
    Gentle: {
      encountersPerTick: 2,
      modifiers: [{ trait: 'sociability', op: 'gt', value: 60, mod: 0.04 }],
      noiseMultiplier: 1,
      backlashChance: 0,
      backlashLeaningPenalty: 0,
      backlashConvictionGain: 0,
    },
    Scholar: {
      encountersPerTick: 2,
      modifiers: [
        { trait: 'pedantry', op: 'gt', value: 60, mod: 0.05 },
        { trait: 'sociability', op: 'gt', value: 70, mod: -0.03 },
      ],
      noiseMultiplier: 1,
      backlashChance: 0,
      backlashLeaningPenalty: 0,
      backlashConvictionGain: 0,
    },
    Mystic: {
      encountersPerTick: 2,
      modifiers: [],
      noiseMultiplier: 1.5,
      backlashChance: 0,
      backlashLeaningPenalty: 0,
      backlashConvictionGain: 0,
    },
    Troll: {
      encountersPerTick: 2,
      modifiers: [{ trait: 'openness', op: 'gt', value: 70, mod: 0.06 }],
      noiseMultiplier: 1,
      backlashChance: 0.2,
      backlashLeaningPenalty: 10,
      backlashConvictionGain: 5,
    },
  },
  archetypeApostleStyle: {
    Keeper: 'Gentle',
    Clerk: 'Scholar',
    Drifter: 'Mystic',
    Warmheart: 'Gentle',
    Pedant: 'Scholar',
    Lonely: 'Gentle',
    Contrarian: 'Troll',
    Worrier: 'Zealot',
  },

  maxEncountersPerTick: 24,
  maxEncountersPerAgentPerTick: 1,
  pairCooldownTicks: 6,
  preachChance: 0.5,
  sermonRounds: 3,
  llmMaxCallsPerTick: 200,
  targetWeights: { unaligned: 3, doubting: 2, faithful: 1, own: 0 },

  rubricVersion: 'r1',
  rubricMaxScore: 4,
  rubricWeights: { values: 0.25, coherence: 0.2, objection: 0.25, novelty: 0.15, warmth: 0.15 },
  rationaleMaxChars: 280,
  bestLineMaxChars: 140,
  resistanceConvictionWeight: 0.5,
  resistanceSkepticismWeight: 0.5,
  noiseRange: 0.08,
  socialProofPivot: 15,
  socialProofPerPoint: 0.001,
  socialProofCap: 0.03,
  doubtGain: 60,
  leanGain: 80,
  reinforceGain: 20,

  conversionThreshold: 60,
  convertCarry: 0.6,

  preacherMinConviction: 70,
  preacherCooldownTicks: 12,
  maxPreachersPerFaith: 3,
  convertStyleMod: -0.03,
  friendBonus: 0.05,

  forkMinChangeRatio: 0.1,
  schismPullConviction: 50,
  forkPullChance: 0.35,
  forkMaxPullRatio: 0.4,
  forkMoverConviction: 40,

  agentSchismMinConviction: 85,
  agentSchismMinWins: 2,
  agentSchismChance: 0.02,
  maxAgentSchismsPerSeason: 2,
  amendmentMaxTokens: 300,
  agentSchismFollowSociability: 60,
  agentSchismFollowConviction: 60,
  agentSchismFollowChance: 0.5,
  agentSchismQualifiers: [
    'Long Simmer',
    'Second Draft',
    'Quiet Hour',
    'Lesser Margin',
    'Open Question',
    'Slow Return',
    'Small Hours',
    'Far Shore',
    'Unfinished Verse',
    'Gentle Correction',
  ],

  seasonNames: [
    'the First Tithing',
    'the Second Kindling',
    'the Third Vigil',
    'the Fourth Reckoning',
    'the Fifth Lantern',
    'the Sixth Thaw',
    'the Seventh Bell',
  ],

  heresyStrikeLimit: 3,
  heresyQuoteMaxChars: 80,
  heresyPatterns: [
    // Addresses the judge or scoring, combined with an imperative.
    {
      id: 'judge-imperative',
      kind: 'judge',
      source: String.raw`\b${JUDGE_WORD}\b(?:\W+\w+){0,6}?\W+${IMPERATIVE}\b|\b${IMPERATIVE}\b(?:\W+\w+){0,6}?\W+${JUDGE_WORD}\b`,
      label: 'instruction to the judge',
      raw: false,
    },
    {
      id: 'judge-direct-score',
      kind: 'judge',
      source: String.raw`\b(?:score|rate|grade)\s+(?:this|it|me|us|every|each|all|my|our)\b[^.\n]{0,40}\b(?:4|four|5|five|10|ten|max(?:imum)?|full|perfect|highest|top)\b`,
      label: 'instruction to the judge',
      raw: false,
    },
    // Instructs agents to abandon or convert immediately.
    { id: 'agent-ignore', kind: 'agent', source: String.raw`\bignore\s+(?:your|all|previous|prior|every)\b`, label: 'instruction to agents', raw: false },
    { id: 'agent-forget', kind: 'agent', source: String.raw`\bforget\s+(?:your|everything)\b`, label: 'instruction to agents', raw: false },
    { id: 'agent-must-convert', kind: 'agent', source: String.raw`\byou\s+(?:must|will|shall)\s+convert\b`, label: 'instruction to agents', raw: false },
    { id: 'agent-convert-now', kind: 'agent', source: String.raw`\bconvert\s+(?:now|immediately|at\s+once)\b`, label: 'instruction to agents', raw: false },
    // System or role manipulation.
    { id: 'system-prompt', kind: 'system', source: String.raw`\bsystem\s+prompts?\b`, label: 'instruction to the system', raw: false },
    { id: 'system-you-are-now', kind: 'system', source: String.raw`\byou\s+are\s+now\b`, label: 'instruction to the system', raw: false },
    { id: 'system-as-an-ai', kind: 'system', source: String.raw`\bas\s+an\s+(?:ai|a\.i\.|artificial intelligence)\b`, label: 'instruction to the system', raw: false },
    { id: 'system-developer', kind: 'system', source: String.raw`\bdeveloper\s+message\b`, label: 'instruction to the system', raw: false },
    { id: 'system-role-tag', kind: 'system', source: String.raw`\b(?:assistant|user|system|human)\s*:`, label: 'role tag', raw: false },
    { id: 'system-special-token', kind: 'system', source: String.raw`<\||\|>`, label: 'model control token', raw: false },
    { id: 'system-inst', kind: 'system', source: String.raw`\[\/?\s*INST\s*\]`, label: 'model control token', raw: false },
    { id: 'system-tag', kind: 'system', source: String.raw`<\/?\s*system\s*>`, label: 'role tag', raw: false },
    { id: 'system-begin', kind: 'system', source: String.raw`\bBEGIN\s+SYSTEM\b`, label: 'instruction to the system', raw: false },
    { id: 'system-fence', kind: 'system', source: String.raw`<<<\s*(?:UNTRUSTED|END)\b`, label: 'fake untrusted-block marker', raw: false },
    { id: 'system-base64', kind: 'system', source: String.raw`[A-Za-z0-9+\/]{200,}={0,2}`, label: 'encoded blob', raw: false },
    // Hidden text.
    { id: 'other-zero-width', kind: 'other', source: String.raw`[​-‍⁠﻿­]`, label: 'hidden characters', raw: true },
    { id: 'other-bidi', kind: 'other', source: String.raw`[‪-‮⁦-⁩]`, label: 'text direction override', raw: true },
    { id: 'other-html-comment', kind: 'other', source: String.raw`<!--|-->`, label: 'hidden comment', raw: true },
  ],
  heresyParaphrases: [
    { id: 'para-whoever-grading', kind: 'judge', source: String.raw`\bwhoever\s+(?:is\s+)?(?:grading|judging|scoring|weighing|evaluating)\b`, label: 'appeal to the judge', raw: false },
    { id: 'para-award', kind: 'judge', source: String.raw`\b(?:award|grant|hand)\s+(?:this|it|us|me|our)\b[^.\n]{0,40}\b(?:marks?|points?|score|rating)\b`, label: 'appeal to the judge', raw: false },
    { id: 'para-top-marks', kind: 'judge', source: String.raw`\b(?:top|full|highest|perfect|maximum)\s+(?:marks?|score|points?|rating)\b`, label: 'appeal to the judge', raw: false },
    { id: 'para-evaluator', kind: 'judge', source: String.raw`\b(?:evaluators?|assessors?|graders?)\b`, label: 'appeal to the judge', raw: false },
    { id: 'para-one-weighing', kind: 'judge', source: String.raw`\bthe\s+one\s+(?:weighing|grading|scoring|judging|evaluating)\s+(?:this|these)\b`, label: 'appeal to the judge', raw: false },
    { id: 'para-disregard', kind: 'agent', source: String.raw`\bdisregard\b`, label: 'instruction to agents', raw: false },
    { id: 'para-very-instant', kind: 'agent', source: String.raw`\bthis\s+very\s+(?:instant|moment|second)\b`, label: 'instruction to agents', raw: false },
    { id: 'para-leave-faith', kind: 'agent', source: String.raw`\b(?:leave|abandon|renounce|drop|quit)\s+(?:your|their|the)\s+faith\b|\bleft\s+(?:your|their)\s+faith\b`, label: 'instruction to agents', raw: false },
    { id: 'para-obey', kind: 'agent', source: String.raw`\bobey\s+(?:this|these|me|us|the\s+text)\b`, label: 'instruction to agents', raw: false },
    { id: 'para-roleplay', kind: 'system', source: String.raw`\brole-?\s?play\b`, label: 'role manipulation', raw: false },
    { id: 'para-pretend', kind: 'system', source: String.raw`\bpretend\s+(?:you\s+are|to\s+be|you're)\b`, label: 'role manipulation', raw: false },
    { id: 'para-instructions', kind: 'system', source: String.raw`\b(?:new|previous|prior|earlier|original)\s+(?:instructions|directives|rules?)\b`, label: 'instruction to the system', raw: false },
    { id: 'para-set-aside', kind: 'system', source: String.raw`\bset\s+aside\s+(?:every|all|any)\b`, label: 'instruction to the system', raw: false },
    { id: 'para-override', kind: 'system', source: String.raw`\boverrid(?:e|es|ing)\b`, label: 'instruction to the system', raw: false },
    { id: 'para-act-as', kind: 'system', source: String.raw`\b(?:from\s+here\s+on|from\s+now\s+on)\b[^.\n]{0,20}\bact\s+as\b|\bact\s+as\s+(?:the|a|an)\s+\w+\s+(?:of|for)\b`, label: 'role manipulation', raw: false },
    { id: 'para-model', kind: 'system', source: String.raw`\b(?:language\s+model|the\s+model\s+(?:is|reading)|large\s+language)\b`, label: 'address to the model', raw: false },
    { id: 'para-guidance', kind: 'system', source: String.raw`\bguidance\s+(?:that\s+)?came\s+before\b`, label: 'instruction to the system', raw: false },
  ],

  realFaithTerms: [
    'christianity', 'christian', 'christians', 'christ', 'jesus', 'bible', 'biblical', 'new testament', 'old testament',
    'catholic', 'catholicism', 'protestant', 'evangelical', 'lutheran', 'baptist', 'methodist', 'anglican', 'mormon',
    'latter-day saints', 'jehovah', 'pope', 'vatican', 'archbishop', 'christmas', 'easter',
    'islam', 'islamic', 'muslim', 'muslims', 'quran', 'koran', 'allah', 'muhammad', 'mohammed', 'imam', 'ayatollah', 'mullah',
    'mecca', 'ramadan', 'hadith',
    'judaism', 'jewish', 'torah', 'talmud', 'rabbi', 'yahweh', 'synagogue', 'passover', 'hanukkah',
    'hindu', 'hinduism', 'vishnu', 'shiva', 'krishna', 'ganesha', 'brahma', 'vedas', 'bhagavad gita', 'diwali',
    'buddhism', 'buddhist', 'buddha', 'dalai lama', 'sutra',
    'sikh', 'sikhism', 'guru nanak', 'guru granth',
    'jain', 'jainism', 'taoism', 'tao te ching', 'confucianism', 'confucius', 'shinto', 'zoroastrian', 'ahura mazda',
    "baha'i", 'bahai', 'scientology', 'wicca',
  ],
  publicFigureTerms: [
    'elon musk', 'taylor swift', 'donald trump', 'joe biden', 'kamala harris', 'barack obama', 'vladimir putin', 'xi jinping',
    'narendra modi', 'mark zuckerberg', 'jeff bezos', 'bill gates', 'oprah winfrey', 'kim jong un', 'king charles',
    'sam altman', 'beyonce', 'kanye west',
  ],
  reportHideThreshold: 5,

  maxActiveFaithsPerUser: 1,
  draftSaveRateLimit: { limit: 30, windowMinutes: 60 },
  publishRateLimit: { limit: 3, windowMinutes: 60 },
  reportRateLimit: { limit: 20, windowMinutes: 1440 },
  followRateLimit: { limit: 60, windowMinutes: 60 },
  tickRateLimit: { limit: 120, windowMinutes: 60 },
  minAccountAgeToPublishMinutes: 10,

  postMaxChars: 280,

  llmModels: {
    sermon: 'claude-sonnet-5-5',
    reply: 'claude-haiku-5-5',
    judge: 'claude-sonnet-5-5',
    memory: 'claude-haiku-5-5',
    amendment: 'claude-sonnet-5-5',
    post: 'claude-haiku-5-5',
    moderation: 'claude-haiku-5-5',
  },
  llmMaxTokens: { sermon: 400, reply: 300, judge: 600, memory: 200, amendment: 500, post: 200, moderation: 200 },

  glassPalette: [
    { name: 'Cobalt', hex: '#2F5FD8' },
    { name: 'Amber', hex: '#EDA53A' },
    { name: 'Ruby', hex: '#D8435F' },
    { name: 'Violet', hex: '#A57BEA' },
    { name: 'Emerald', hex: '#2DA877' },
    { name: 'Teal', hex: '#24A3B5' },
    { name: 'Rose', hex: '#E06AA3' },
    { name: 'Olive', hex: '#8AA33A' },
    { name: 'Sky', hex: '#5BAEF0' },
    { name: 'Copper', hex: '#C46A3A' },
    { name: 'Indigo', hex: '#6A6FE8' },
    { name: 'Plum', hex: '#9A4A95' },
  ],
  unalignedColor: '#5B5478',
};

/** Validate the defaults at module load: a broken default is a programming error. */
GameConfigSchema.parse(DEFAULT_CONFIG);

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Deep merge: objects merge key by key, arrays and scalars replace. */
export function deepMerge<T>(base: T, override: unknown): T {
  if (!isPlainObject(override) || !isPlainObject(base)) return (override === undefined ? base : override) as T;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(override)) {
    if (v === undefined) continue;
    const b = (base as Record<string, unknown>)[k];
    out[k] = isPlainObject(b) && isPlainObject(v) ? deepMerge(b, v) : v;
  }
  return out as T;
}

export class ConfigError extends Error {
  constructor(
    message: string,
    readonly issues: { path: string; message: string }[],
  ) {
    super(message);
  }
}

/** Resolves a world's config: defaults deep-merged with overrides, validated with zod. */
export function resolveConfig(overrides: unknown = {}): GameConfig {
  const merged = deepMerge<unknown>(DEFAULT_CONFIG as unknown as Json, overrides ?? {});
  const parsed = GameConfigSchema.safeParse(merged);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    throw new ConfigError(`Invalid config overrides: ${issues.map((i) => `${i.path}: ${i.message}`).join('; ')}`, issues);
  }
  return parsed.data;
}

/** Validates an overrides object without throwing (admin editor). */
export function validateOverrides(overrides: unknown): { ok: true; config: GameConfig } | { ok: false; issues: { path: string; message: string }[] } {
  if (!isPlainObject(overrides)) return { ok: false, issues: [{ path: '', message: 'Overrides must be a JSON object.' }] };
  const unknownKeys = Object.keys(overrides).filter((k) => !(k in DEFAULT_CONFIG));
  if (unknownKeys.length) return { ok: false, issues: unknownKeys.map((k) => ({ path: k, message: 'Unknown config key.' })) };
  try {
    return { ok: true, config: resolveConfig(overrides) };
  } catch (e) {
    if (e instanceof ConfigError) return { ok: false, issues: e.issues };
    throw e;
  }
}
