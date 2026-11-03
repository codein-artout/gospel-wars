import type { LlmRole } from '@/lib/game/config';
import type { RoleInputs } from '../schemas';

export type PromptModule<R extends LlmRole> = {
  role: R;
  /** Bump when the wording changes; stored with outputs for audit. */
  version: string;
  /** Fixed system prompt. Never contains user text. */
  system: string;
  /** User message. Untrusted strings only through fenceUntrusted/fenceList/fenceExchange, scalars through trusted(). */
  build(input: RoleInputs[R]): string;
};
