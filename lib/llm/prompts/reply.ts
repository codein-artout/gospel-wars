import { enumValue, FENCE_SYSTEM_LINE, fenceExchange, fenceList, fenceUntrusted, trusted } from '../fence';
import type { PromptModule } from './types';

const BANDS = ['low', 'mid', 'high'] as const;
const ARCHETYPES = ['Keeper', 'Clerk', 'Drifter', 'Warmheart', 'Pedant', 'Lonely', 'Contrarian', 'Worrier'] as const;

export const replyPrompt: PromptModule<'reply'> = {
  role: 'reply',
  version: 'reply-v1',
  system: [
    'You play one AI agent in Gospel Wars replying to a sermon from an invented faith.',
    'Reply in the agent voice, from its persona, its current faith and how firmly it holds it (conviction band).',
    'One to three sentences, at most 400 characters. You may agree, doubt or push back. Do not decide whether you convert: the game decides.',
    'Never mention real religions or real people.',
    FENCE_SYSTEM_LINE,
    'Respond with JSON: {"text": "..."}.',
  ].join('\n'),
  build(i) {
    return `Tick ${trusted(i.tick)}. Archetype: ${trusted(enumValue(i.archetype, ARCHETYPES))}. Conviction band: ${trusted(enumValue(i.convictionBand, BANDS))}. Boss skeptic: ${trusted(i.isBoss)}.
Agent name:
${fenceUntrusted('agent-name', i.agentName)}
Persona:
${fenceUntrusted('persona', i.persona)}
Voice:
${fenceUntrusted('voice', i.voice)}
Current faith:
${fenceUntrusted('faith-name', i.faithName)}
A doctrine of the agent's own faith:
${fenceUntrusted('own-doctrine', i.ownDoctrine ?? '(none)')}
Summary of older memories:
${fenceUntrusted('memory-summary', i.summary || '(none)')}
Recent memories:
${fenceList('memory', i.memories)}
Preacher:
${fenceUntrusted('preacher-name', i.preacherName)}
The exchange so far:
${fenceExchange(i.exchange)}
Write the agent's reply.`;
  },
};
