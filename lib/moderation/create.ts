import type { GameConfig } from '@/lib/game/config';
import type { LLMClient } from '@/lib/llm/client';
import { MockModeration, type Moderation } from './index';
import { LLMModeration } from './llm';

/** LLMModeration with a key, MockModeration otherwise. The mock denylist always runs first. */
export function createModeration(config: GameConfig, llm?: LLMClient): Moderation {
  const mock = new MockModeration(config);
  if (!llm || llm.providerName === 'mock') return mock;
  const model = new LLMModeration(llm);
  return {
    name: 'mock+llm',
    async moderate(text, context) {
      const first = mock.check(text);
      if (!first.ok) return first;
      return model.moderate(text, context);
    },
  };
}
