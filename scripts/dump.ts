/** Dev tool: prints a stable digest of the world (determinism checks) and a short summary. */
import { createHash } from 'node:crypto';
import { db } from '../lib/db/client';

async function main() {
  const c = await db();
  const faiths = await c.faith.findMany({ orderBy: { slug: 'asc' }, include: { _count: { select: { members: { where: { isBoss: false, isFounder: false } } } } } });
  for (const f of faiths) console.log(`${f.name.padEnd(36)} ${String(f._count.members).padStart(3)} members  strikes ${f.strikes}${f.silenced ? ' silenced' : ''}  ${f.founderType}${f.parentId ? ' fork' : ''}  ${f.color}`);
  console.log('unaligned', await c.agent.count({ where: { faithId: null, isBoss: false } }));
  const digest = createHash('sha256');
  for (const e of await c.chronicleEvent.findMany({ orderBy: [{ tick: 'asc' }, { seq: 'asc' }], select: { id: true, text: true } })) digest.update(e.id + e.text);
  for (const a of await c.agent.findMany({ orderBy: { seat: 'asc' }, select: { id: true, faithId: true, conviction: true, leanings: true, memorySummary: true } })) digest.update(JSON.stringify(a));
  for (const t of await c.encounterTurn.findMany({ orderBy: { id: 'asc' }, select: { id: true, text: true } })) digest.update(t.id + t.text);
  console.log('digest', digest.digest('hex').slice(0, 16));
  await c.$disconnect();
}
main().then(() => process.exit(0));
