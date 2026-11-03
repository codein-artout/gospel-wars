import { enumValue, FENCE_SYSTEM_LINE, fenceUntrusted, trusted } from '../fence';
import type { PromptModule } from './types';

const CONTEXTS = ['gospel', 'amendment', 'sermon', 'reply', 'memory', 'post', 'name'] as const;

export const moderationPrompt: PromptModule<'moderation'> = {
  role: 'moderation',
  version: 'moderation-v1',
  system: [
    'You moderate text for Gospel Wars, a game about invented faiths.',
    'Flag categories: real_religion (references a real religion, its scripture, deities, prophets or clergy), real_person (a real living person), hate (demeaning people for who they are), sexual (sexual content), violence (calls for or threats of violence).',
    'Invented faiths, invented gods and gentle satire of ideas are fine. ok is true only when no category applies.',
    FENCE_SYSTEM_LINE,
    'Respond with JSON: {"ok": true, "categories": []}.',
  ].join('\n'),
  build(i) {
    return `Context: ${trusted(enumValue(i.context, CONTEXTS))}.
Text to moderate:
${fenceUntrusted('text', i.text)}
Moderate it.`;
  },
};
