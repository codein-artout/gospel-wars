import type { LLMClient } from '@/lib/llm/client';
import type { Moderation, ModerationContext, ModerationResult } from './index';

/** Moderation through the LLM layer (role "moderation"). Runs only when a key is present; falls back to Mock like every role. */
export class LLMModeration implements Moderation {
  readonly name = 'llm';
  constructor(private readonly llm: LLMClient) {}
  async moderate(text: string, context: ModerationContext): Promise<ModerationResult> {
    const { value } = await this.llm.run('moderation', { text, context });
    return value;
  }
}
