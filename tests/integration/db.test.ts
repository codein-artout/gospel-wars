import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb } from '@/lib/db/test-db';
import type { Db } from '@/lib/db/client';

let db: Db;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});
afterAll(async () => close());

describe('database on PGlite', () => {
  it('applies migrations and round-trips a world', async () => {
    const world = await db.world.create({ data: { slug: 'w', name: 'World', seed: 'gw-world-1' } });
    const season = await db.season.create({ data: { worldId: world.id, number: 1, name: 'the First Tithing', startTick: 0 } });
    await db.world.update({ where: { id: world.id }, data: { currentSeasonId: season.id } });
    const got = await db.world.findUniqueOrThrow({ where: { id: world.id }, include: { currentSeason: true } });
    expect(got.currentSeason?.number).toBe(1);
    expect(got.configOverrides).toEqual({});
  });

  it('enforces one tick run per (world, tick)', async () => {
    const world = await db.world.create({ data: { slug: 'w2', name: 'World 2', seed: 's' } });
    await db.tickRun.create({ data: { worldId: world.id, tick: 1, config: {} } });
    await expect(db.tickRun.create({ data: { worldId: world.id, tick: 1, config: {} } })).rejects.toThrow();
  });

  it('stores integer arrays and JSON leanings', async () => {
    const world = await db.world.create({ data: { slug: 'w3', name: 'World 3', seed: 's' } });
    const season = await db.season.create({ data: { worldId: world.id, number: 1, name: 'S', startTick: 0 } });
    const f = await db.faith.create({
      data: { worldId: world.id, seasonId: season.id, slug: 'f', name: 'The F', shortName: 'F', color: '#2F5FD8', founderType: 'human', foundedTick: 0, changedDoctrines: [2, 4] },
    });
    const a = await db.agent.create({
      data: {
        worldId: world.id, slug: 'a', name: 'A', persona: 'p', voice: 'v', archetype: 'Keeper', seat: 0,
        openness: 50, loyalty: 50, pedantry: 50, sociability: 50, skepticism: 50, conviction: 40, leanings: { [f.id]: 12 },
      },
    });
    expect((await db.faith.findUniqueOrThrow({ where: { id: f.id } })).changedDoctrines).toEqual([2, 4]);
    expect((await db.agent.findUniqueOrThrow({ where: { id: a.id } })).leanings).toEqual({ [f.id]: 12 });
  });
});
