/**
 * pnpm db:seed — builds the demo world (lib/seed/demo.ts) and runs 140 ticks on the MockProvider.
 */
import { db } from '../lib/db/client';
import { seedDemoWorld } from '../lib/seed/demo';

async function main() {
  const client = await db();
  await seedDemoWorld(client);
  await client.$disconnect();
}

main().then(
  () => process.exit(0),
  (e: unknown) => {
    console.error(e instanceof Error ? (e.stack ?? e.message) : e);
    process.exit(1);
  },
);
