import type { ShellUser } from '@/components/shell/types';
import { getSessionUser } from '@/lib/auth/session';
import { db } from '@/lib/db/client';

/** The signed-in card in the sidebar: handle, admin flag, and the user's active faith. */
export async function loadShellUser(): Promise<ShellUser | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const client = await db();
  const faith = await client.faith.findFirst({ where: { prophetId: user.id, status: { in: ['active', 'queued'] } }, select: { name: true, slug: true } });
  return { handle: user.handle, isAdmin: user.isAdmin, faith };
}
