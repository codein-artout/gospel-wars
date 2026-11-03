/**
 * Advances the world: `pnpm tick` runs one tick, `pnpm tick --n 10` runs ten.
 * Uses PGlite (.pglite/) unless DATABASE_URL is set; MockProvider unless ANTHROPIC_API_KEY is set.
 */
import { db } from '../lib/db/client';
import { runTick } from '../lib/engine';
import { tickDetails, tickHeadline } from '../lib/engine/describe';
import { requireWorldId } from '../lib/server/world';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const n = Number(arg('n') ?? 1);
  if (!Number.isInteger(n) || n < 1 || n > 1000) throw new Error('--n must be an integer from 1 to 1000.');
  const client = await db();
  const worldId = await requireWorldId(client);
  for (let i = 0; i < n; i++) {
    const s = await runTick(client, worldId);
    console.log(`${tickHeadline(s)} ${tickDetails(s)}`);
    for (const h of s.headlines.slice(0, 8)) console.log(`  ${h}`);
    if (s.status !== 'done') break;
  }
  await client.$disconnect();
}

main().then(
  () => process.exit(0),
  (e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  },
);
