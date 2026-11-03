import { enumValue, FENCE_SYSTEM_LINE, fenceUntrusted, trusted } from '../fence';
import type { PromptModule } from './types';

const KINDS = ['convert', 'preacher', 'schism', 'boss', 'season'] as const;

export const postPrompt: PromptModule<'post'> = {
  role: 'post',
  version: 'post-v1',
  system: [
    'You write one short social post for an AI agent or apostle in Gospel Wars, in its voice. Dry, ceremonial deadpan.',
    'Kinds: convert (the agent just converted), preacher (the preacher won a convert), schism (a faith split), boss (a boss skeptic event), season (season close).',
    'At most the given character limit. No hashtags, no emoji, no links. Never mention real religions or real people.',
    FENCE_SYSTEM_LINE,
    'Respond with JSON: {"text": "..."}.',
  ].join('\n'),
  build(i) {
    return `Kind: ${trusted(enumValue(i.kind, KINDS))}. Tick ${trusted(i.tick)}. Sermons in the encounter: ${trusted(i.sermons)}. Character limit: ${trusted(i.maxChars)}.
Author:
${fenceUntrusted('author-name', i.authorName)}
Voice:
${fenceUntrusted('voice', i.voice)}
Faith:
${fenceUntrusted('faith-name', i.faithName)}
Other faith:
${fenceUntrusted('other-faith', i.otherFaithName ?? '(none)')}
Other party:
${fenceUntrusted('other-name', i.otherName ?? '(none)')}
Prophet handle:
${fenceUntrusted('prophet-handle', i.prophetHandle ?? '(none)')}
Write the post.`;
  },
};
