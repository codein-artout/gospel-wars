import { execSync } from 'node:child_process';
import { cpSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';

/**
 * E2E runs against a fresh copy of the seeded world in .pglite-e2e, so tests that publish,
 * fork and advance ticks never touch your local .pglite. If there is no seeded world yet,
 * it migrates and seeds one directly into .pglite-e2e. Runs as part of the Playwright
 * webServer command, before `next start` opens the database.
 */
function prepare(): void {
  if (process.env.DATABASE_URL) return; // A real Postgres is managed by the caller.
  const root = process.cwd();
  const src = path.join(root, '.pglite');
  const dst = path.join(root, '.pglite-e2e');
  rmSync(dst, { recursive: true, force: true });
  const seeded = existsSync(path.join(src, 'PG_VERSION'));
  if (seeded) {
    cpSync(src, dst, { recursive: true, filter: (f) => !f.endsWith('.gw-lock') });
    return;
  }
  const env = { ...process.env, PGLITE_DIR: '.pglite-e2e' };
  execSync('pnpm db:migrate', { stdio: 'inherit', env });
  execSync('pnpm db:seed', { stdio: 'inherit', env });
}

prepare();
