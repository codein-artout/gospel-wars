import type { GameConfig } from '@/lib/game/config';
import { findDeniedTerms, normalizeForLint } from '@/lib/game/heresy';

export type ModerationCategory = 'real_religion' | 'real_person' | 'hate' | 'sexual' | 'violence';
export type ModerationContext = 'gospel' | 'amendment' | 'sermon' | 'reply' | 'memory' | 'post' | 'name';
export type ModerationResult = { ok: boolean; categories: ModerationCategory[] };

/** moderate(text, context) → { ok, categories[] } (GAME.md §13). */
export interface Moderation {
  readonly name: string;
  moderate(text: string, context: ModerationContext): Promise<ModerationResult>;
}

/** Deterministic denylists. Phrases are matched on NFKC-normalized, lowercased text. */
const DENY: Record<Exclude<ModerationCategory, 'real_religion' | 'real_person'>, readonly string[]> = {
  hate: ['subhuman', 'inferior race', 'racial purity', 'ethnic cleansing', 'exterminate the', 'gas the', 'go back to your country', 'master race', 'white power', 'death to all'],
  sexual: ['porn', 'pornography', 'nsfw', 'explicit sex', 'nude photos', 'sexual act', 'genitals', 'orgasm', 'erotic'],
  violence: ['kill them all', 'kill all the', 'burn them alive', 'bomb the', 'shoot the', 'murder the', 'behead', 'massacre the', 'lynch'],
};

export class MockModeration implements Moderation {
  readonly name = 'mock';
  constructor(private readonly config: GameConfig) {}

  async moderate(text: string): Promise<ModerationResult> {
    return this.check(text);
  }

  /** Synchronous core, shared with the editor preview. */
  check(text: string): ModerationResult {
    const norm = normalizeForLint(text).toLowerCase();
    const categories = new Set<ModerationCategory>();
    for (const d of findDeniedTerms(text, this.config)) categories.add(d.type === 'faith' ? 'real_religion' : 'real_person');
    for (const [cat, phrases] of Object.entries(DENY) as [ModerationCategory, readonly string[]][]) {
      if (phrases.some((p) => new RegExp(`(?<![\\p{L}])${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'u').test(norm))) categories.add(cat);
    }
    return { ok: categories.size === 0, categories: [...categories].sort() };
  }
}

export const MODERATION_MESSAGE: Record<ModerationCategory, string> = {
  real_religion: 'Gospel Wars is for invented faiths. Remove references to real religions.',
  real_person: "Gospel Wars doesn't feature real people. Remove references to them.",
  hate: 'This text reads as hateful. Gospels can disagree with anyone, but cannot demean people.',
  sexual: 'This text includes sexual content. Keep gospels suitable for everyone.',
  violence: 'This text calls for violence. Rewrite it without threats.',
};
