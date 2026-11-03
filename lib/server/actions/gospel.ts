'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireUser } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { APOSTLE_STYLES, resolveConfig } from '@/lib/game/config';
import { checkRateLimit } from '@/lib/server/rate-limit';
import { changeApostleStyle, editGospel, publishFork, publishGospel } from '@/lib/server/services/faiths';
import { requireWorldId } from '@/lib/server/world';
import { guarded, type ActionResult } from './result';

const Body = z.string().max(20_000, 'This gospel is far too long.');
const Style = z.enum(APOSTLE_STYLES);

const DraftInput = z.object({
  kind: z.enum(['new', 'edit', 'fork']),
  faithId: z.string().max(64).optional(),
  name: z.string().max(80).default(''),
  body: Body,
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
  style: Style.nullable().optional(),
  apostleName: z.string().max(60).nullable().optional(),
});

async function worldConfig() {
  const client = await db();
  const worldId = await requireWorldId(client);
  const w = await client.world.findUniqueOrThrow({ where: { id: worldId }, select: { configOverrides: true } });
  return { client, worldId, config: resolveConfig(w.configOverrides) };
}

/** Autosaves the editor draft (draftSaveRateLimit per hour). */
export async function saveDraft(input: z.input<typeof DraftInput>): Promise<ActionResult<{ savedAt: string }>> {
  return guarded(async () => {
    const user = await requireUser('save a draft');
    const d = DraftInput.parse(input);
    const { client, config } = await worldConfig();
    const limit = await checkRateLimit(client, user.id, 'draft', config.draftSaveRateLimit);
    if (!limit.ok) return { ok: false, error: limit.message };
    const faithKey = d.kind === 'new' ? '' : (d.faithId ?? '');
    const data = { name: d.name, body: d.body, color: d.color ?? null, style: d.style ?? null, apostleName: d.apostleName ?? null };
    const draft = await client.gospelDraft.upsert({
      where: { userId_kind_faithKey: { userId: user.id, kind: d.kind, faithKey } },
      create: { userId: user.id, kind: d.kind, faithKey, ...data },
      update: data,
    });
    return { ok: true, message: 'Draft saved.', data: { savedAt: draft.updatedAt.toISOString() } };
  });
}

const PublishInput = z.object({
  name: z.string().trim().min(1, 'Name your faith.').max(80),
  body: Body,
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Pick a glass color.'),
  style: Style,
  apostleName: z.string().trim().max(60).optional(),
  attested: z.boolean(),
});

/** Publishes a new gospel. Every attempt counts toward publishRateLimit, failed lints included. */
export async function publishNewGospel(input: z.input<typeof PublishInput>): Promise<ActionResult<{ slug: string; status: 'active' | 'queued' }>> {
  return guarded(async () => {
    const user = await requireUser('publish a gospel');
    const { client, worldId, config } = await worldConfig();
    const limit = await checkRateLimit(client, user.id, 'publish', config.publishRateLimit);
    if (!limit.ok) return { ok: false, error: limit.message };
    const d = PublishInput.parse(input);
    const r = await publishGospel(client, { worldId, prophetId: user.id, name: d.name, body: d.body, color: d.color, style: d.style, apostleName: d.apostleName ?? null, attested: d.attested });
    await client.gospelDraft.deleteMany({ where: { userId: user.id, kind: 'new' } });
    revalidatePath('/', 'layout');
    return {
      ok: true,
      message: r.status === 'queued' ? 'Gospel published. It waits in the Narthex for a free glass color next season.' : 'Gospel published.',
      data: { slug: r.slug, status: r.status },
    };
  });
}

const ForkInput = PublishInput.extend({ parentId: z.string().min(1).max(64) });

/** Publishes a fork; the schism pull happens immediately. */
export async function publishForkGospel(input: z.input<typeof ForkInput>): Promise<ActionResult<{ slug: string; movers: number }>> {
  return guarded(async () => {
    const user = await requireUser('fork a faith');
    const { client, worldId, config } = await worldConfig();
    const limit = await checkRateLimit(client, user.id, 'publish', config.publishRateLimit);
    if (!limit.ok) return { ok: false, error: limit.message };
    const d = ForkInput.parse(input);
    const r = await publishFork(client, { worldId, prophetId: user.id, parentId: d.parentId, name: d.name, body: d.body, color: d.color, style: d.style, apostleName: d.apostleName ?? null, attested: d.attested });
    await client.gospelDraft.deleteMany({ where: { userId: user.id, kind: 'fork', faithKey: d.parentId } });
    revalidatePath('/', 'layout');
    return { ok: true, message: `Fork published. ${r.movers} ${r.movers === 1 ? 'agent' : 'agents'} followed.`, data: { slug: r.slug, movers: r.movers } };
  });
}

const EditInput = z.object({ faithId: z.string().min(1).max(64), body: Body });

/** Saves a new revision of the prophet's own gospel; it takes effect at the next tick. */
export async function publishEdit(input: z.input<typeof EditInput>): Promise<ActionResult<{ revision: number }>> {
  return guarded(async () => {
    const user = await requireUser('edit a gospel');
    const { client, config } = await worldConfig();
    const limit = await checkRateLimit(client, user.id, 'publish', config.publishRateLimit);
    if (!limit.ok) return { ok: false, error: limit.message };
    const d = EditInput.parse(input);
    const r = await editGospel(client, { faithId: d.faithId, userId: user.id, body: d.body });
    await client.gospelDraft.deleteMany({ where: { userId: user.id, kind: 'edit', faithKey: d.faithId } });
    revalidatePath('/', 'layout');
    return { ok: true, message: `Revision ${r.revision} saved. It is preached from tick ${r.effectiveTick}.`, data: { revision: r.revision } };
  });
}

const StyleInput = z.object({ faithId: z.string().min(1).max(64), style: Style });

/** Requests an apostle style change (once per season, applied at the next tick). */
export async function requestStyleChange(input: z.input<typeof StyleInput>): Promise<ActionResult> {
  return guarded(async () => {
    const user = await requireUser('change the apostle');
    const d = StyleInput.parse(input);
    const client = await db();
    await changeApostleStyle(client, { faithId: d.faithId, userId: user.id, style: d.style });
    revalidatePath('/', 'layout');
    return { ok: true, message: `The apostle becomes ${d.style} at the next tick.` };
  });
}
