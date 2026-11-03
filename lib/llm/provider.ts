import type { z } from 'zod';
import type { LlmRole } from '@/lib/game/config';
import type { RoleInputs } from './schemas';

/** One interface for every model call (GAME.md §16). */
export interface LLMProvider {
  readonly name: string;
  generate<R extends LlmRole, T>(role: R, input: RoleInputs[R], schema: z.ZodType<T>): Promise<T>;
}

export class LLMOutputError extends Error {
  constructor(
    readonly role: LlmRole,
    message: string,
  ) {
    super(`${role}: ${message}`);
  }
}
