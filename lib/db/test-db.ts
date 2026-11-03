import { PGlite } from '@electric-sql/pglite';
import { PrismaPGlite } from 'pglite-prisma-adapter';
import { PrismaClient } from './generated/client';
import { applyMigrations } from './migrations';

/** A fresh in-memory database with all migrations applied (integration tests). */
export async function createTestDb(): Promise<{ db: PrismaClient; close: () => Promise<void> }> {
  const pg = await PGlite.create();
  await applyMigrations(pg);
  const db = new PrismaClient({ adapter: new PrismaPGlite(pg) });
  return {
    db,
    close: async () => {
      await db.$disconnect();
      await pg.close();
    },
  };
}
