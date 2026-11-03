/**
 * pnpm db:seed — builds the demo world from the mockup data and runs 140 ticks on the
 * MockProvider: conversions, a human fork, an agent-started schism, heresy strikes, boss
 * resistances, cards and draft posts. Deterministic: the same seed gives the same world.
 */
import { readFileSync } from 'node:fs';
import type { Db } from '@/lib/db/client';
import { runTick } from '@/lib/engine';
import { DEFAULT_CONFIG } from '@/lib/game/config';
import { stableId } from '@/lib/game/rng';
import { firstFreeColor, schismPull } from '@/lib/game/rules/schism';
import { createLLMClient } from '@/lib/llm';
import { createWorld } from '@/lib/seed/build';
import { editGospel, publishFork } from '@/lib/server/services/faiths';
import { AGENT_NAMES, SEED_FAITHS, WORLD } from '@/prisma/seed-data/world';

const TICKS = Number(process.env.SEED_TICKS ?? 140);
/** The fork happens in a window after forkTick, at the first tick where the schism pull would move enough agents. */
const FORK_WINDOW = 7;
const FORK_MIN_MOVERS = 2;

/** Dry-runs the schism pull the fork would make at the world's current tick (same seed, same ids). */
async function forkMovers(client: Db, worldId: string, parentId: string, prophetId: string): Promise<number> {
  const w = await client.world.findUniqueOrThrow({ where: { id: worldId } });
  const flock = await client.agent.findMany({ where: { faithId: parentId, isBoss: false, isFounder: false }, select: { id: true, conviction: true } });
  const forkFaithId = stableId('fork', worldId, parentId, prophetId, w.currentTick);
  return schismPull({ worldSeed: w.seed, tick: w.currentTick, forkFaithId, parentFlock: flock }, DEFAULT_CONFIG).movers.length;
}
const gospel = (slug: string) => readFileSync(`prisma/seed-data/gospels/${slug}.md`, 'utf8');

/**
 * Seed-only nudges (never stored on the world, never in the engine): a slightly higher
 * agent-schism chance in the second half so the demo shows one.
 */
const SEED_NUDGE = { agentSchismChance: 0.06 };

const DEMO_USERS = [
  ...SEED_FAITHS.map((f) => f.prophet),
  { handle: 'admin', email: 'admin@gospelwars.test', name: 'Admin' },
  { handle: 'pilgrim', email: 'pilgrim@gospelwars.test', name: 'Pilgrim' },
];

async function wipe(client: Db): Promise<void> {
  const tables = await client.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length) await client.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(', ')} CASCADE`);
}

export async function seedDemoWorld(client: Db, log: (line: string) => void = console.log): Promise<Record<string, number>> {
  const started = Date.now();
  await wipe(client);

  // Demo accounts, a day old so they can publish immediately.
  const dayAgo = new Date(Date.now() - 24 * 3600_000);
  const users = new Map<string, string>();
  for (const u of DEMO_USERS) {
    const id = stableId('user', u.handle);
    await client.user.create({ data: { id, email: u.email, handle: u.handle, name: u.name, emailVerified: dayAgo, createdAt: dayAgo } });
    users.set(u.handle, id);
  }

  const founders = SEED_FAITHS.filter((f) => !f.forkOf);
  const { worldId, faithIds } = await createWorld(client, {
    slug: WORLD.slug,
    name: WORLD.name,
    seed: WORLD.seed,
    agentNames: AGENT_NAMES,
    faiths: founders.map((f) => ({ slug: f.slug, name: f.name, color: f.color, style: f.style, apostleName: f.apostleName, gospel: gospel(f.slug), prophetId: users.get(f.prophet.handle)!, founding: f.founding })),
  });

  const fork = SEED_FAITHS.find((f) => f.forkOf)!;
  let forked = false;
  const llm = () => createLLMClient(DEFAULT_CONFIG, { forceMock: true });
  for (let t = 1; t <= TICKS; t++) {
    const s = await runTick(client, worldId, { llm: llm(), configOverride: t > TICKS / 2 ? SEED_NUDGE : undefined });
    if (s.status !== 'done') throw new Error(`Tick ${t} did not run: ${s.status}`);

    // The Patient Kettle revises its gospel once (revision 2), as in the Faith mockup.
    if (t === 48) {
      const body = gospel('patient-kettle').replace('- Leave one cup unpoured for the stranger.', '- Leave one cup unpoured for the stranger.\n- Pour the stranger\'s cup last, and warmest.');
      await editGospel(client, { faithId: faithIds['patient-kettle']!, userId: users.get('slowboil')!, body });
    }
    // The human fork: @hotwater forks the Patient Kettle over doctrine 4.
    if (!forked && t >= fork.forkTick! && (t >= fork.forkTick! + FORK_WINDOW || (await forkMovers(client, worldId, faithIds[fork.forkOf!]!, users.get(fork.prophet.handle)!)) >= FORK_MIN_MOVERS)) {
      forked = true;
      const taken = new Set((await client.faith.findMany({ where: { status: 'active' }, select: { color: true } })).map((f) => f.color.toUpperCase()));
      const color = taken.has(fork.color.toUpperCase()) ? firstFreeColor(taken, DEFAULT_CONFIG)! : fork.color;
      const r = await publishFork(client, {
        worldId,
        prophetId: users.get(fork.prophet.handle)!,
        parentId: faithIds[fork.forkOf!]!,
        name: fork.name,
        color,
        style: fork.style,
        apostleName: fork.apostleName,
        body: gospel(fork.slug),
        attested: true,
      });
      log(`Tick ${t}: ${fork.name} forked from the Patient Kettle and took ${r.movers} ${r.movers === 1 ? 'agent' : 'agents'}.`);
    }
    if (t % 20 === 0) log(`Tick ${t} of ${TICKS}. ${s.conversions} conversions this tick. ${Math.round((Date.now() - started) / 1000)}s.`);
  }

  // Humans following faiths (a vanity count) and one open report for the admin queue.
  const follows: [string, string][] = [
    ['pilgrim', 'patient-kettle'], ['admin', 'patient-kettle'], ['ledgerwitch', 'patient-kettle'], ['moonclerk', 'final-spreadsheet'], ['pilgrim', 'second-moon'], ['hingeworks', 'second-moon'],
  ];
  for (const [handle, slug] of follows) {
    const faith = await client.faith.findUnique({ where: { slug }, select: { id: true } });
    if (faith) await client.follow.create({ data: { userId: users.get(handle)!, faithId: faith.id } });
  }
  const unbuffered = await client.faith.findUnique({ where: { slug: 'unbuffered' }, select: { id: true } });
  if (unbuffered) {
    await client.report.create({ data: { reporterId: users.get('pilgrim')!, targetType: 'faith', targetId: unbuffered.id, faithId: unbuffered.id, reason: 'spam', note: 'The apostle keeps trying to talk to the judge.' } });
  }

  const summary = {
    ticks: (await client.world.findUniqueOrThrow({ where: { id: worldId } })).currentTick,
    encounters: await client.encounter.count(),
    conversions: await client.encounter.count({ where: { converted: true } }),
    humanForks: await client.faith.count({ where: { founderType: 'human', parentId: { not: null } } }),
    agentSchisms: await client.faith.count({ where: { founderType: 'agent' } }),
    heresyStrikes: await client.encounter.count({ where: { heresy: true } }),
    bossResistances: await client.chronicleEvent.count({ where: { kind: 'boss_held' } }),
    cards: await client.conversionCard.count(),
    draftPosts: await client.draftPost.count(),
  };
  log(`Seeded: ${JSON.stringify(summary)}`);
  const missing = Object.entries({ conversions: summary.conversions, humanForks: summary.humanForks, agentSchisms: summary.agentSchisms, heresyStrikes: summary.heresyStrikes, bossResistances: summary.bossResistances, cards: summary.cards, draftPosts: summary.draftPosts })
    .filter(([, v]) => v === 0)
    .map(([k]) => k);
  if (TICKS >= 140 && missing.length) throw new Error(`The seeded world is missing: ${missing.join(', ')}. Adjust the seed nudges.`);
  log(`Done in ${Math.round((Date.now() - started) / 1000)}s. Demo sign-in: any of ${DEMO_USERS.map((u) => u.email).join(', ')} (dev login).`);
  return summary;
}
