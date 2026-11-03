import { ZodError } from 'zod';
import { AuthError } from '@/lib/auth/session';
import { GameRuleError } from '@/lib/server/services/faiths';

export type ActionResult<T = undefined> = { ok: true; message: string; data?: T } | { ok: false; error: string; problems?: string[]; code?: string };

/** Maps expected failures to a plain result; unexpected ones are logged and reported generically. */
export async function guarded<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.message, code: e.code };
    if (e instanceof GameRuleError) return { ok: false, error: e.message, problems: e.problems };
    if (e instanceof ZodError) return { ok: false, error: e.issues[0]?.message ?? 'That input is not valid.', problems: e.issues.map((i) => i.message) };
    console.error('[action] unexpected error', e);
    return { ok: false, error: 'Something went wrong on our side. Try again in a moment.' };
  }
}
