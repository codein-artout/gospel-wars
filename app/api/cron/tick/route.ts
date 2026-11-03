import { timingSafeEqual } from 'node:crypto';
import { db } from '@/lib/db/client';
import { runTick } from '@/lib/engine';
import { tickHeadline } from '@/lib/engine/describe';
import { getWorldId } from '@/lib/server/world';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get('authorization') ?? '';
  const expected = Buffer.from(`Bearer ${secret}`);
  const got = Buffer.from(header);
  return got.length === expected.length && timingSafeEqual(got, expected);
}

async function handle(req: Request): Promise<Response> {
  if (!process.env.CRON_SECRET) return Response.json({ error: 'Cron is not configured. Set CRON_SECRET.' }, { status: 503 });
  if (!authorized(req)) return Response.json({ error: 'Unauthorized.' }, { status: 401 });
  const client = await db();
  const worldId = await getWorldId(client);
  if (!worldId) return Response.json({ error: 'No world. Seed the database first.' }, { status: 404 });
  const s = await runTick(client, worldId);
  return Response.json({ message: tickHeadline(s), summary: { ...s, headlines: s.headlines.slice(0, 20) } }, { status: s.status === 'busy' ? 409 : 200 });
}

/** Vercel Cron calls GET with the bearer token; POST is for everything else. */
export const GET = handle;
export const POST = handle;
