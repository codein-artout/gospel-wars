import type { Db } from '@/lib/db/client';

export type SocialDraft = { id: string; authorName: string; text: string };
export type SocialPostResult = { id: string; url: string };

/** post(draft) → { id, url } (GAME.md §15). v1 never posts for real. */
export interface SocialProvider {
  readonly name: string;
  post(draft: SocialDraft): Promise<SocialPostResult>;
}

/** Writes the "post" to the SocialLog table. The only provider in v1. */
export class LogSocialProvider implements SocialProvider {
  readonly name = 'log';
  constructor(private readonly db: Db) {}
  async post(draft: SocialDraft): Promise<SocialPostResult> {
    const log = await this.db.socialLog.create({ data: { draftPostId: draft.id, provider: this.name, payload: { author: draft.authorName, text: draft.text } } });
    return { id: log.id, url: `log://social/${log.id}` };
  }
}

/** Placeholder for real X posting. Deliberately unusable in v1. */
export class XSocialProvider implements SocialProvider {
  readonly name = 'x';
  async post(): Promise<SocialPostResult> {
    throw new Error('XSocialProvider is not configured. Real posting is out of scope in v1.');
  }
}
