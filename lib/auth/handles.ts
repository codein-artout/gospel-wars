import type { Db } from '@/lib/db/client';

/** A unique public handle from an email local part: "ledger.witch+x@…" -> "ledgerwitch". */
export async function uniqueHandle(db: Db, email: string): Promise<string> {
  const base =
    (email.split('@')[0] ?? 'prophet')
      .split('+')[0]!
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 20) || 'prophet';
  let handle = base.length >= 3 ? base : `${base}prophet`;
  for (let n = 2; await db.user.findUnique({ where: { handle }, select: { id: true } }); n++) handle = `${base}${n}`;
  return handle;
}
