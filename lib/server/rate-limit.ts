import type { Db } from '@/lib/db/client';
import type { RateLimit } from '@/lib/game/config';

export type RateLimitResult = { ok: true } | { ok: false; retryAt: Date; message: string };

const LABEL: Record<string, string> = {
  draft: 'Draft saves',
  publish: 'Publishing',
  report: 'Reports',
  follow: 'Follows',
  tick: 'Advancing ticks',
};

/**
 * DB-backed sliding window (GAME.md §14, no Redis in v1): counts this user's hits for the
 * action in the last windowMinutes, records a new hit when under the limit.
 */
export async function checkRateLimit(db: Db, userId: string, action: string, rule: RateLimit, now = new Date()): Promise<RateLimitResult> {
  const since = new Date(now.getTime() - rule.windowMinutes * 60_000);
  const hits = await db.rateLimitHit.findMany({
    where: { userId, action, createdAt: { gt: since } },
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true },
    take: rule.limit,
  });
  if (hits.length >= rule.limit) {
    const retryAt = new Date(hits[0]!.createdAt.getTime() + rule.windowMinutes * 60_000);
    const hm = retryAt.toISOString().slice(11, 16);
    return { ok: false, retryAt, message: `${LABEL[action] ?? 'This action'} is limited to ${rule.limit} per ${windowLabel(rule.windowMinutes)}. Try again at ${hm} UTC.` };
  }
  await db.rateLimitHit.create({ data: { userId, action, createdAt: now } });
  return { ok: true };
}

function windowLabel(minutes: number): string {
  if (minutes === 60) return 'hour';
  if (minutes === 1440) return 'day';
  return minutes % 60 === 0 ? `${minutes / 60} hours` : `${minutes} minutes`;
}
