import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { applyMigrations } from '../lib/db/migrations';
import { openPGlite, pgliteDir } from '../lib/db/pglite';

async function main() {
  const reset = process.argv.includes('--reset');
  if (process.env.DATABASE_URL) {
    if (reset) execSync('prisma migrate reset --force --skip-seed', { stdio: 'inherit' });
    else execSync('prisma migrate deploy', { stdio: 'inherit' });
    return;
  }
  const dir = pgliteDir();
  if (reset) {
    rmSync(dir, { recursive: true, force: true });
    console.log(`Removed ${dir}.`);
  }
  const pg = await openPGlite(dir);
  const ran = await applyMigrations(pg);
  await pg.close();
  console.log(ran.length ? `Applied ${ran.length} migration(s) to PGlite at ${dir}: ${ran.join(', ')}` : `PGlite at ${dir} is up to date.`);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
