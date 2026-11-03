import { PGlite } from '@electric-sql/pglite';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/** Directory PGlite stores data in when DATABASE_URL is unset. */
export function pgliteDir(): string {
  return path.resolve(process.cwd(), process.env.PGLITE_DIR || '.pglite');
}

function lockPath(dir: string): string {
  return path.join(dir, '.gw-lock');
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * PGlite is single-process. Two processes opening the same directory would corrupt it,
 * so we hold a pid lockfile and fail fast with instructions.
 */
function acquireLock(dir: string): void {
  const file = lockPath(dir);
  if (existsSync(file)) {
    const pid = Number(readFileSync(file, 'utf8').trim());
    if (pid && pid !== process.pid && isAlive(pid)) {
      throw new Error(
        `The local database in ${dir} is in use by process ${pid} (probably \`pnpm dev\` or \`pnpm start\`). ` +
          'PGlite allows one process at a time: stop that process, or use the admin "Advance tick" button instead of `pnpm tick`.',
      );
    }
  }
  writeFileSync(file, String(process.pid));
  const release = () => {
    try {
      if (existsSync(file) && readFileSync(file, 'utf8').trim() === String(process.pid)) rmSync(file);
    } catch {
      // Best effort on shutdown.
    }
  };
  process.once('exit', release);
}

export async function openPGlite(dir = pgliteDir()): Promise<PGlite> {
  if (dir === 'memory://') return PGlite.create();
  mkdirSync(dir, { recursive: true });
  acquireLock(dir);
  return PGlite.create({ dataDir: dir });
}
