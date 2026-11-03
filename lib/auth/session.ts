import { cache } from 'react';
import { auth } from '@/auth';
import { db } from '@/lib/db/client';
import { isAdminEmail } from './secret';

export type SessionUser = { id: string; email: string; handle: string; isAdmin: boolean; createdAt: Date };

export class AuthError extends Error {
  constructor(
    message: string,
    readonly code: 'unauthenticated' | 'forbidden' | 'banned',
  ) {
    super(message);
  }
}

/** The signed-in user, freshly loaded (bans take effect immediately). Cached per request. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  let session;
  try {
    session = await auth();
  } catch {
    return null;
  }
  const id = session?.user?.id;
  if (!id) return null;
  const client = await db();
  const u = await client.user.findUnique({ where: { id }, select: { id: true, email: true, handle: true, banned: true, createdAt: true } });
  if (!u || u.banned) return null;
  return { id: u.id, email: u.email, handle: u.handle, isAdmin: isAdminEmail(u.email), createdAt: u.createdAt };
});

/** Every mutation calls one of these first. */
export async function requireUser(action = 'do that'): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) throw new AuthError(`Sign in to ${action}.`, 'unauthenticated');
  return u;
}

export async function requireAdmin(): Promise<SessionUser> {
  const u = await requireUser('use the admin tools');
  if (!u.isAdmin) throw new AuthError('Only admins can do that.', 'forbidden');
  return u;
}
