import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '@/lib/db/client';
import { createTestDb } from '@/lib/db/test-db';
import { DEFAULT_CONFIG } from '@/lib/game/config';
import { checkRateLimit } from '@/lib/server/rate-limit';

let db: Db;
let close: () => Promise<void>;
let userId: string;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  userId = (await db.user.create({ data: { email: 'r@example.com', handle: 'r' } })).id;
});
afterAll(async () => close());

describe('DB-backed sliding-window rate limits (GAME.md §14)', () => {
  it('allows publishRateLimit attempts per hour, then refuses with a retry time', async () => {
    const t0 = new Date('2026-11-03T12:00:00Z');
    const rule = DEFAULT_CONFIG.publishRateLimit;
    for (let i = 0; i < rule.limit; i++) expect((await checkRateLimit(db, userId, 'publish', rule, new Date(t0.getTime() + i * 1000))).ok).toBe(true);
    const blocked = await checkRateLimit(db, userId, 'publish', rule, new Date(t0.getTime() + 10_000));
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.retryAt.toISOString()).toBe('2026-11-03T13:00:00.000Z');
      expect(blocked.message).toBe('Publishing is limited to 3 per hour. Try again at 13:00 UTC.');
    }
    // The window slides: an hour after the first attempt, one more is allowed.
    expect((await checkRateLimit(db, userId, 'publish', rule, new Date(t0.getTime() + 3600_000 + 1))).ok).toBe(true);
  });

  it('counts actions and users separately', async () => {
    const other = (await db.user.create({ data: { email: 'o@example.com', handle: 'o' } })).id;
    const rule = { limit: 1, windowMinutes: 1440 };
    expect((await checkRateLimit(db, userId, 'report', rule)).ok).toBe(true);
    expect((await checkRateLimit(db, userId, 'report', rule)).ok).toBe(false);
    expect((await checkRateLimit(db, userId, 'follow', rule)).ok).toBe(true);
    expect((await checkRateLimit(db, other, 'report', rule)).ok).toBe(true);
  });
});
