import type { LlmRole } from '@/lib/game/config';
import { amendmentPrompt } from './amendment';
import { judgePrompt } from './judge';
import { memoryPrompt } from './memory';
import { moderationPrompt } from './moderation';
import { postPrompt } from './post';
import { replyPrompt } from './reply';
import { sermonPrompt } from './sermon';
import type { PromptModule } from './types';

export const PROMPTS: { [R in LlmRole]: PromptModule<R> } = {
  sermon: sermonPrompt,
  reply: replyPrompt,
  judge: judgePrompt,
  memory: memoryPrompt,
  amendment: amendmentPrompt,
  post: postPrompt,
  moderation: moderationPrompt,
};

export type { PromptModule };
