import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaPGlite } from 'pglite-prisma-adapter';
import { PrismaClient } from './generated/client';
import { openPGlite, pgliteDir } from './pglite';

export type Db = PrismaClient;
/** The client passed to an interactive transaction callback. */
export type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'>;

type GlobalDb = { gwDb?: Promise<PrismaClient> };
const g = globalThis as unknown as GlobalDb;

export function usingPGlite(): boolean {
  return !process.env.DATABASE_URL;
}

async function create(): Promise<PrismaClient> {
  const url = process.env.DATABASE_URL;
  if (url) {
    return new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: Number(process.env.DATABASE_POOL_MAX ?? 5) }) });
  }
  const pg = await openPGlite(pgliteDir());
  const client = new PrismaClient({ adapter: new PrismaPGlite(pg) });
  const close = () => {
    void pg.close().catch(() => undefined);
  };
  process.once('SIGINT', () => {
    close();
    process.exit(130);
  });
  process.once('SIGTERM', () => {
    close();
    process.exit(143);
  });
  return client;
}

/** The app-wide Prisma client: Postgres when DATABASE_URL is set, PGlite otherwise. Opened lazily. */
export function db(): Promise<PrismaClient> {
  g.gwDb ??= create().catch((e: unknown) => {
    g.gwDb = undefined;
    throw e;
  });
  return g.gwDb;
}
