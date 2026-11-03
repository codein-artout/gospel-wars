import { afterEach, describe, expect, it } from 'vitest';
import { GET, POST } from '@/app/api/cron/tick/route';

const req = (auth?: string) => new Request('http://localhost/api/cron/tick', { method: 'POST', headers: auth ? { authorization: auth } : {} });

afterEach(() => {
  delete process.env.CRON_SECRET;
});

describe('POST /api/cron/tick', () => {
  it('is disabled without CRON_SECRET', async () => {
    const res = await POST(req('Bearer anything'));
    expect(res.status).toBe(503);
  });
  it('rejects a missing or wrong bearer token', async () => {
    process.env.CRON_SECRET = 's3cret';
    expect((await POST(req())).status).toBe(401);
    expect((await POST(req('Bearer nope'))).status).toBe(401);
    expect((await GET(req('Bearer s3cret-but-longer'))).status).toBe(401);
  });
});
