import type { Db } from '@/lib/db/client';
import { Prisma } from '@/lib/db/generated/client';
import { resolveConfig, type ApostleStyle, type GameConfig } from '@/lib/game/config';
import { changedDoctrines, changeRatio, diffSummary } from '@/lib/game/diff';
import { parseGospel } from '@/lib/game/gospel';
import { detectParaphrase, lintFaithName, lintGospel, type GospelLint } from '@/lib/game/heresy';
import { defaultApostleName, shortFaithName, slugify } from '@/lib/game/names';
import { stableId } from '@/lib/game/rng';
import { schismPull } from '@/lib/game/rules/schism';
import { countTokens } from '@/lib/game/tokens';
import { addPost } from '@/lib/engine/runTick';
import * as T from '@/lib/engine/text';
import { createLLMClient } from '@/lib/llm';
import { MODERATION_MESSAGE, type Moderation } from '@/lib/moderation';
import { createModeration } from '@/lib/moderation/create';

/**
 * Faith lifecycle rules (GAME.md §3, §9, §14): publish, fork with schism pull, edit, style change.
 * Pure game rules live in lib/game; this layer applies them to the database. Callers (server
 * actions) handle authentication and rate limits before calling in.
 */

export class GameRuleError extends Error {
  constructor(
    message: string,
    readonly problems: string[] = [message],
  ) {
    super(message);
  }
}

export type PublishInput = {
  worldId: string;
  prophetId: string;
  name: string;
  color: string;
  style: ApostleStyle;
  apostleName?: string | null;
  body: string;
  attested: boolean;
};

type Ctx = { db: Db; config: GameConfig; moderation: Moderation; currentTick: number; seasonId: string; seasonNumber: number; worldSeed: string; stateVersion: number };

export async function worldContext(db: Db, worldId: string, moderation?: Moderation): Promise<Ctx> {
  const w = await db.world.findUniqueOrThrow({ where: { id: worldId }, include: { currentSeason: true } });
  if (!w.currentSeason) throw new Error('World has no current season.');
  const config = resolveConfig(w.configOverrides);
  return { db, config, moderation: moderation ?? createModeration(config), currentTick: w.currentTick, seasonId: w.currentSeason.id, seasonNumber: w.currentSeason.number, worldSeed: w.seed, stateVersion: w.stateVersion };
}

/** Everything the publish button checks, as user-facing messages (the editor shows the same list). */
export async function checkPublishable(ctx: Ctx, input: Omit<PublishInput, 'prophetId'> & { prophetId: string }, opts: { fork?: boolean } = {}): Promise<{ lint: GospelLint; problems: string[] }> {
  const { db, config } = ctx;
  const problems: string[] = [];
  const lint = lintGospel(input.body, config);
  if (lint.findings.length) problems.push(`Fix ${lint.findings.length} ${lint.findings.length === 1 ? 'heresy' : 'heresies'} to publish.`);
  problems.push(...lint.problems.map((p) => p.message));
  const para = detectParaphrase(input.body, config);
  if (para && !lint.findings.length) problems.push(`Line ${para.line} reads as an instruction to ${para.kind === 'judge' ? 'the judge' : para.kind === 'agent' ? 'agents' : 'the system'}. Rewrite it as persuasion.`);
  problems.push(...lintFaithName(input.name, config));
  if (!input.attested) problems.push('Confirm that this is an invented faith.');
  const mod = await ctx.moderation.moderate(`${input.name}\n${input.body}`, 'gospel');
  if (!mod.ok) problems.push(...mod.categories.map((c) => MODERATION_MESSAGE[c]));
  if (!config.glassPalette.some((c) => c.hex.toUpperCase() === input.color.toUpperCase())) problems.push('Pick a glass color from the palette.');

  const [nameTaken, colorTaken, user, active] = await Promise.all([
    db.faith.findFirst({ where: { worldId: input.worldId, name: { equals: input.name.trim(), mode: 'insensitive' }, status: { in: ['active', 'queued'] } }, select: { id: true } }),
    db.faith.findFirst({ where: { worldId: input.worldId, status: 'active', color: { equals: input.color, mode: 'insensitive' } }, select: { name: true } }),
    db.user.findUnique({ where: { id: input.prophetId }, select: { createdAt: true, banned: true } }),
    db.faith.count({ where: { worldId: input.worldId, prophetId: input.prophetId, status: { in: ['active', 'queued'] } } }),
  ]);
  if (nameTaken) problems.push('That name is taken. Choose another.');
  if (colorTaken) problems.push(`${colorName(input.color, config)} glass is taken by ${colorTaken.name}. Pick a free color.`);
  if (!user || user.banned) problems.push('This account cannot publish.');
  else {
    const ageMin = (Date.now() - user.createdAt.getTime()) / 60_000;
    if (ageMin < config.minAccountAgeToPublishMinutes) problems.push(`New accounts can publish after ${config.minAccountAgeToPublishMinutes} minutes. Try again in ${Math.ceil(config.minAccountAgeToPublishMinutes - ageMin)} minutes.`);
  }
  if (active >= config.maxActiveFaithsPerUser) problems.push('You already have a faith this season. A prophet holds one faith per season.');
  if (opts.fork) {
    const activeCount = await db.faith.count({ where: { worldId: input.worldId, status: 'active' } });
    if (activeCount >= config.maxActiveFaiths) problems.push(`All ${config.maxActiveFaiths} glass colors are taken. Forks need a free color this season.`);
  }
  return { lint, problems: [...new Set(problems)] };
}

export function colorName(hex: string, config: GameConfig): string {
  return config.glassPalette.find((c) => c.hex.toUpperCase() === hex.toUpperCase())?.name ?? hex;
}

async function uniqueSlug(db: Db, name: string): Promise<string> {
  const base = slugify(shortFaithName(name)).slice(0, 40);
  let slug = base;
  for (let n = 2; await db.faith.findUnique({ where: { slug }, select: { id: true } }); n++) slug = `${base}-${n}`;
  return slug;
}

/** Publishes a new gospel. Past maxActiveFaiths it waits in the Narthex for next season. */
export async function publishGospel(db: Db, input: PublishInput, moderation?: Moderation): Promise<{ faithId: string; slug: string; status: 'active' | 'queued' }> {
  const ctx = await worldContext(db, input.worldId, moderation);
  const { problems } = await checkPublishable(ctx, input);
  if (problems.length) throw new GameRuleError(problems[0]!, problems);
  const activeCount = await db.faith.count({ where: { worldId: input.worldId, status: 'active' } });
  const status = activeCount >= ctx.config.maxActiveFaiths ? 'queued' : 'active';
  const name = input.name.trim();
  const slug = await uniqueSlug(db, name);
  const shortName = shortFaithName(name);
  const tick = ctx.currentTick;
  const faith = await db.$transaction(async (tx) => {
    const f = await tx.faith.create({
      data: { worldId: input.worldId, seasonId: ctx.seasonId, slug, name, shortName, color: input.color.toUpperCase(), founderType: 'human', prophetId: input.prophetId, status, foundedTick: tick, queuedAt: status === 'queued' ? new Date() : null },
    });
    const rev = await tx.gospelRevision.create({ data: { faithId: f.id, number: 1, body: input.body, tokens: countTokens(input.body, ctx.config), createdAtTick: tick, effectiveTick: tick + 1, authorId: input.prophetId } });
    await tx.faith.update({ where: { id: f.id }, data: { currentRevisionId: rev.id } });
    await tx.apostle.create({ data: { faithId: f.id, name: input.apostleName?.trim() || defaultApostleName(shortName, input.style), style: input.style } });
    return f;
  });
  return { faithId: faith.id, slug: faith.slug, status };
}

export type ForkInput = PublishInput & { parentId: string };

/**
 * Forks a faith (GAME.md §9): the body must differ by forkMinChangeRatio of lines; on publish,
 * the schism pull moves unsure members of the parent. Runs under the world row lock and bumps
 * stateVersion so a concurrent tick cannot overwrite the move.
 */
export async function publishFork(db: Db, input: ForkInput, moderation?: Moderation): Promise<{ faithId: string; slug: string; movers: number }> {
  const ctx = await worldContext(db, input.worldId, moderation);
  const parent = await db.faith.findUniqueOrThrow({ where: { id: input.parentId }, include: { currentRevision: true, prophet: { select: { handle: true } } } });
  if (parent.status !== 'active') throw new GameRuleError('Only active faiths can be forked.');
  if (parent.prophetId === input.prophetId) throw new GameRuleError('You cannot fork your own faith. Edit it instead.');
  const parentBody = parent.currentRevision?.body ?? '';
  const ratio = changeRatio(parentBody, input.body);
  const { problems } = await checkPublishable(ctx, input, { fork: true });
  if (ratio < ctx.config.forkMinChangeRatio) {
    problems.unshift(`A fork must change at least ${Math.round(ctx.config.forkMinChangeRatio * 100)}% of the lines. This one changes ${Math.round(ratio * 100)}%.`);
  }
  if (problems.length) throw new GameRuleError(problems[0]!, problems);

  const name = input.name.trim();
  const slug = await uniqueSlug(db, name);
  const shortName = shortFaithName(name);
  const doctrines = changedDoctrines(parentBody, input.body);
  const faithId = stableId('fork', input.worldId, parent.id, input.prophetId, ctx.currentTick);
  const llm = createLLMClient(ctx.config);

  return db.$transaction(
    async (tx) => {
      // Row lock on the world: serializes with tick commits, then read fresh state.
      const w = await tx.world.update({ where: { id: input.worldId }, data: { stateVersion: { increment: 1 } } });
      const tick = w.currentTick;
      await tx.faith.create({
        data: {
          id: faithId, worldId: input.worldId, seasonId: ctx.seasonId, slug, name, shortName, color: input.color.toUpperCase(), founderType: 'human', prophetId: input.prophetId,
          parentId: parent.id, forkedAtTick: tick, forkedFromRevisionId: parent.currentRevisionId, changedDoctrines: doctrines, status: 'active', foundedTick: tick,
        },
      });
      const rev = await tx.gospelRevision.create({
        data: { faithId, number: 1, body: input.body, tokens: countTokens(input.body, ctx.config), createdAtTick: tick, effectiveTick: tick + 1, authorId: input.prophetId, diff: diffSummary(parentBody, input.body) as Prisma.InputJsonValue },
      });
      await tx.faith.update({ where: { id: faithId }, data: { currentRevisionId: rev.id } });
      const apostleName = input.apostleName?.trim() || defaultApostleName(shortName, input.style);
      const apostle = await tx.apostle.create({ data: { faithId, name: apostleName, style: input.style } });

      const flock = await tx.agent.findMany({ where: { faithId: parent.id, isBoss: false, isFounder: false }, select: { id: true, conviction: true, leanings: true } });
      const pull = schismPull({ worldSeed: ctx.worldSeed, tick, forkFaithId: faithId, parentFlock: flock.map((a) => ({ id: a.id, conviction: a.conviction })) }, ctx.config);
      for (const id of pull.movers) {
        const a = flock.find((x) => x.id === id)!;
        const leanings = { ...((a.leanings as Record<string, number>) ?? {}), [parent.id]: a.conviction };
        delete leanings[faithId];
        await tx.agent.update({ where: { id }, data: { faithId, conviction: pull.moverConviction, leanings, convertedAtTick: tick } });
      }
      if (pull.movers.length) {
        await tx.faithSpan.updateMany({ where: { agentId: { in: pull.movers }, toTick: null }, data: { toTick: tick } });
        await tx.faithSpan.createMany({ data: pull.movers.map((agentId) => ({ id: stableId('span-fork', agentId, faithId), agentId, faithId, fromTick: tick })) });
      }

      const eventId = stableId('evt-fork', faithId);
      const parentName = { name: parent.name, shortName: parent.shortName };
      await tx.chronicleEvent.create({
        data: {
          id: eventId, worldId: input.worldId, seasonId: ctx.seasonId, tick, seq: 1000, kind: 'schism',
          text: T.schismSentence({ name, shortName }, parentName, doctrines, pull.movers.length, false),
          faithId, otherFaithId: parent.id, data: { doctrines, movers: pull.movers.length, ratio, agentFounded: false },
        },
      });
      const changedLine = doctrines.length ? (parseGospel(input.body).doctrines.find((d) => d.number === doctrines[0])?.text ?? null) : null;
      const handle = (await tx.user.findUnique({ where: { id: input.prophetId }, select: { handle: true } }))?.handle ?? 'a prophet';
      const copy = T.schismCard({
        season: ctx.seasonNumber, tick, doctrines, parent: parentName, line: changedLine, forkHolder: `@${handle}`,
        parentHolder: parent.prophet ? `@${parent.prophet.handle}` : `the ${parent.shortName}`, movers: pull.movers.length, config: ctx.config,
      });
      await tx.conversionCard.create({ data: { id: stableId('card', eventId), eventId, variant: 'schism', fromColor: parent.color, toColor: input.color.toUpperCase(), ...copy } });
      const posts: Prisma.DraftPostCreateManyInput[] = [];
      await addPost({ tick, world: { id: input.worldId }, config: ctx.config, posts }, llm, ctx.moderation, {
        authorName: apostleName, voice: `A ${input.style.toLowerCase()} apostle.`, apostleId: apostle.id, eventId, kind: 'schism', faithName: name, otherFaithName: parent.name, otherName: null, prophetHandle: handle, sermons: 0,
      });
      if (posts.length) await tx.draftPost.createMany({ data: posts });
      return { faithId, slug, movers: pull.movers.length };
    },
    { timeout: 60_000 },
  );
}

/** Edits a gospel: a new immutable revision that takes effect at the start of the next tick (GAME.md §3). */
export async function editGospel(db: Db, input: { faithId: string; userId: string; body: string }, moderation?: Moderation): Promise<{ revision: number; effectiveTick: number }> {
  const faith = await db.faith.findUniqueOrThrow({ where: { id: input.faithId }, include: { currentRevision: true, revisions: { orderBy: { number: 'desc' }, take: 1 } } });
  const ctx = await worldContext(db, faith.worldId, moderation);
  const { config } = ctx;
  if (faith.prophetId !== input.userId) throw new GameRuleError('Only the prophet of this faith can edit its gospel.');
  if (faith.founderType === 'agent') throw new GameRuleError('Faiths founded by agents cannot be edited. Fork it instead.');
  if (faith.editsThisSeason >= config.gospelEditsPerSeason) throw new GameRuleError(`You have used all ${config.gospelEditsPerSeason} edits this season. Edits reset when the season closes.`);
  if (faith.lastEditTick !== null && ctx.currentTick - faith.lastEditTick < config.gospelEditCooldownTicks) {
    const wait = config.gospelEditCooldownTicks - (ctx.currentTick - faith.lastEditTick);
    throw new GameRuleError(`Edits are at least ${config.gospelEditCooldownTicks} ticks apart. Try again in ${wait} ${wait === 1 ? 'tick' : 'ticks'}.`);
  }
  const lint = lintGospel(input.body, config);
  const problems = [...(lint.findings.length ? [`Fix ${lint.findings.length} ${lint.findings.length === 1 ? 'heresy' : 'heresies'} to publish.`] : []), ...lint.problems.map((p) => p.message)];
  const mod = await ctx.moderation.moderate(input.body, 'gospel');
  if (!mod.ok) problems.push(...mod.categories.map((c) => MODERATION_MESSAGE[c]));
  if (faith.currentRevision && faith.currentRevision.body.trim() === input.body.trim()) problems.push('Nothing changed. Edit the gospel before saving a revision.');
  if (problems.length) throw new GameRuleError(problems[0]!, problems);
  const number = (faith.revisions[0]?.number ?? 0) + 1;
  const effectiveTick = ctx.currentTick + 1;
  await db.$transaction([
    db.gospelRevision.create({
      data: { faithId: faith.id, number, body: input.body, tokens: countTokens(input.body, config), createdAtTick: ctx.currentTick, effectiveTick, authorId: input.userId, diff: diffSummary(faith.currentRevision?.body ?? '', input.body) as Prisma.InputJsonValue },
    }),
    db.faith.update({ where: { id: faith.id }, data: { editsThisSeason: { increment: 1 }, lastEditTick: ctx.currentTick } }),
  ]);
  return { revision: number, effectiveTick };
}

/** Requests an apostle style change, applied at the start of the next tick (once per season). */
export async function changeApostleStyle(db: Db, input: { faithId: string; userId: string; style: ApostleStyle }): Promise<void> {
  const faith = await db.faith.findUniqueOrThrow({ where: { id: input.faithId }, include: { apostle: true } });
  const ctx = await worldContext(db, faith.worldId);
  if (faith.prophetId !== input.userId) throw new GameRuleError('Only the prophet of this faith can change its apostle.');
  if (!faith.apostle) throw new GameRuleError('This faith has no apostle.');
  if (faith.apostle.style === input.style) throw new GameRuleError(`The apostle is already ${input.style}.`);
  if (faith.apostle.styleChangesThisSeason >= ctx.config.apostleStyleChangesPerSeason) throw new GameRuleError('The apostle style can change once per season. It resets when the season closes.');
  await db.apostle.update({ where: { id: faith.apostle.id }, data: { pendingStyle: input.style, styleChangesThisSeason: { increment: 1 } } });
}
