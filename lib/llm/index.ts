import type { GameConfig } from '@/lib/game/config';
import { AnthropicProvider } from './anthropic';
import { CallBudget, LLMClient } from './client';
import { MockProvider } from './mock';
import type { LLMProvider } from './provider';

export { CallBudget, LLMClient } from './client';
export { MockProvider } from './mock';
export { AnthropicProvider } from './anthropic';
export type { LLMProvider } from './provider';

/** AnthropicProvider when ANTHROPIC_API_KEY is set (and not forced to mock), MockProvider otherwise. */
export function createProvider(config: GameConfig, opts: { forceMock?: boolean } = {}): LLMProvider {
  if (!opts.forceMock && process.env.ANTHROPIC_API_KEY && process.env.GW_LLM !== 'mock') return new AnthropicProvider(config);
  return new MockProvider(config);
}

export function createLLMClient(config: GameConfig, opts: { forceMock?: boolean } = {}): LLMClient {
  return new LLMClient(createProvider(config, opts), config, new CallBudget(config.llmMaxCallsPerTick), (role, e) => {
    console.warn(`[llm] ${role} call failed, will retry or fall back:`, e instanceof Error ? e.message : e);
  });
}
