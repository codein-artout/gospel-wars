import { createHash, randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * A tiny migration runner for PGlite (Prisma's CLI cannot open in-process PGlite).
 * It applies prisma/migrations/<name>/migration.sql in order and records them in
 * _prisma_migrations with the same columns `prisma migrate deploy` uses on Postgres.
 */

export type SqlExecutor = {
  exec(sql: string): Promise<unknown>;
  query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
};

export type Migration = { name: string; sql: string; checksum: string };

export function migrationsDir(): string {
  return path.join(process.cwd(), 'prisma', 'migrations');
}

export function loadMigrations(dir = migrationsDir()): Migration[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .map((name) => {
      const sql = readFileSync(path.join(dir, name, 'migration.sql'), 'utf8');
      return { name, sql, checksum: createHash('sha256').update(sql).digest('hex') };
    });
}

const LEDGER = `CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
  "id" VARCHAR(36) PRIMARY KEY NOT NULL,
  "checksum" VARCHAR(64) NOT NULL,
  "finished_at" TIMESTAMPTZ,
  "migration_name" VARCHAR(255) NOT NULL,
  "logs" TEXT,
  "rolled_back_at" TIMESTAMPTZ,
  "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "applied_steps_count" INTEGER NOT NULL DEFAULT 0
)`;

export async function applyMigrations(db: SqlExecutor, migrations = loadMigrations()): Promise<string[]> {
  await db.exec(LEDGER);
  const done = await db.query<{ migration_name: string; checksum: string }>(
    `SELECT migration_name, checksum FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`,
  );
  const applied = new Map(done.rows.map((r) => [r.migration_name, r.checksum]));
  const ran: string[] = [];
  for (const m of migrations) {
    const prev = applied.get(m.name);
    if (prev) {
      if (prev !== m.checksum) {
        throw new Error(`Migration ${m.name} was modified after it was applied. Reset the local database with pnpm db:reset.`);
      }
      continue;
    }
    await db.exec(`BEGIN;\n${m.sql}\nCOMMIT;`);
    await db.query(
      `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, applied_steps_count) VALUES ($1, $2, now(), $3, 1)`,
      [randomUUID(), m.checksum, m.name],
    );
    ran.push(m.name);
  }
  return ran;
}
