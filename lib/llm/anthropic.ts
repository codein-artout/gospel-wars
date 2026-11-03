import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { z } from 'zod';
import type { GameConfig, LlmRole } from '@/lib/game/config';
import { PROMPTS } from './prompts';
import { LLMOutputError, type LLMProvider } from './provider';
import { INPUT_SCHEMAS, WIRE_SCHEMAS, type RoleInputs } from './schemas';

/**
 * Claude via the official SDK. Active only when ANTHROPIC_API_KEY is set. Model and output
 * budget per role come from GameConfig; structured outputs constrain the JSON shape, and the
 * caller's strict zod schema validates the result.
 */
export class AnthropicProvider implements LLMProvider {
  readonly name = 'anthropic';
  private readonly client: Anthropic;

  constructor(
    private readonly config: GameConfig,
    apiKey = process.env.ANTHROPIC_API_KEY,
  ) {
    if (!apiKey) throw new Error('AnthropicProvider needs ANTHROPIC_API_KEY.');
    // The client retries 429/5xx itself; our layer retries once more on invalid output.
    this.client = new Anthropic({ apiKey, maxRetries: 2, timeout: 60_000 });
  }

  async generate<R extends LlmRole, T>(role: R, input: RoleInputs[R], schema: z.ZodType<T>): Promise<T> {
    const prompt = PROMPTS[role];
    const safeInput = INPUT_SCHEMAS[role].parse(input) as RoleInputs[R];
    const response = await this.client.messages.parse({
      model: this.config.llmModels[role],
      max_tokens: this.config.llmMaxTokens[role],
      system: prompt.system,
      messages: [{ role: 'user', content: prompt.build(safeInput) }],
      output_config: { format: zodOutputFormat(WIRE_SCHEMAS[role]), effort: this.config.llmEffort[role] },
    });
    if (response.stop_reason === 'refusal') throw new LLMOutputError(role, 'the model declined');
    if (response.stop_reason === 'max_tokens') throw new LLMOutputError(role, 'output was cut off');
    const parsed = schema.safeParse(response.parsed_output);
    if (!parsed.success) throw new LLMOutputError(role, `invalid output: ${parsed.error.issues.map((i) => i.path.join('.') + ' ' + i.message).join('; ')}`);
    return parsed.data;
  }
}
