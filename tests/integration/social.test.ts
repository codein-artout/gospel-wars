import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '@/lib/db/client';
import { createTestDb } from '@/lib/db/test-db';
import { LogSocialProvider, XSocialProvider } from '@/lib/social';

let db: Db;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});
afterAll(async () => close());

describe('social providers (no real posting in v1)', () => {
  it('LogSocialProvider writes the post to the log table', async () => {
    const world = await db.world.create({ data: { slug: 'w', name: 'W', seed: 's' } });
    const post = await db.draftPost.create({ data: { id: 'p1', worldId: world.id, authorName: 'Dolores', text: 'I am a Spreadsheet now.' } });
    const r = await new LogSocialProvider(db).post({ id: post.id, authorName: post.authorName, text: post.text });
    expect(r.url).toMatch(/^log:\/\/social\//);
    const log = await db.socialLog.findUniqueOrThrow({ where: { id: r.id } });
    expect(log.payload).toEqual({ author: 'Dolores', text: 'I am a Spreadsheet now.' });
  });
  it('XSocialProvider refuses', async () => {
    await expect(new XSocialProvider().post()).rejects.toThrow('not configured');
  });
});
