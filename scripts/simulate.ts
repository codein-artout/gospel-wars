/**
 * Dev tool: runs N ticks on a throwaway in-memory world and prints how the mock world reads.
 * pnpm tsx scripts/simulate.ts --ticks 60
 */
import { readFileSync } from 'node:fs';
import { createTestDb } from '../lib/db/test-db';
import { runTick } from '../lib/engine';
import { SEED_FAITHS, AGENT_NAMES } from '../prisma/seed-data/world';
import { createWorld } from '../lib/seed/build';

const arg = (name: string, d: number) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? Number(process.argv[i + 1]) : d;
};

async function main() {
  const ticks = arg('ticks', 60);
  const { db, close } = await createTestDb();
  const gospel = (f: string) => readFileSync(`prisma/seed-data/gospels/${f}.md`, 'utf8');
  const { worldId } = await createWorld(db, {
    slug: 'sim',
    name: 'Simulation',
    seed: process.env.SEED ?? 'gw-world-1',
    agentNames: AGENT_NAMES,
    faiths: SEED_FAITHS.filter((f) => !f.forkOf).map((f) => ({ slug: f.slug, name: f.name, color: f.color, style: f.style, apostleName: f.apostleName, gospel: gospel(f.slug), prophetId: null, founding: f.founding })),
  });
  const t0 = Date.now();
  for (let i = 0; i < ticks; i++) await runTick(db, worldId);
  console.log(`${ticks} ticks in ${Date.now() - t0}ms`);
  const stats = await db.encounter.groupBy({ by: ['outcome'], _count: true });
  console.log(stats.map((s) => `${s.outcome}:${s._count}`).join('  '));
  console.log(await db.encounter.aggregate({ _avg: { S: true, R: true, pull: true } }));
  const kinds = await db.chronicleEvent.groupBy({ by: ['kind'], _count: true });
  console.log(kinds.map((s) => `${s.kind}:${s._count}`).join('  '));
  for (const e of await db.chronicleEvent.findMany({ orderBy: [{ tick: 'desc' }, { seq: 'desc' }], take: 10 })) console.log(`t${e.tick} ${e.kind}: ${e.text}`);
  const enc = await db.encounter.findFirst({ where: { converted: true }, orderBy: { tick: 'desc' }, include: { turns: { orderBy: { order: 'asc' } } } });
  if (enc) {
    console.log(`\nS ${enc.S} R ${enc.R} pull ${enc.pull.toFixed(3)} | ${enc.rationale} | best: ${enc.bestLine}`);
    for (const t of enc.turns) console.log(`  [${t.speakerName}] ${t.text}`);
  }
  const faiths = await db.faith.findMany({ include: { _count: { select: { members: { where: { isBoss: false, isFounder: false } } } } } });
  console.log('\n' + faiths.map((f) => `${f.shortName}=${f._count.members}${f.silenced ? ' (silenced)' : ''} strikes=${f.strikes}`).join('\n'));
  console.log('unaligned', await db.agent.count({ where: { faithId: null, isBoss: false } }));
  await close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
