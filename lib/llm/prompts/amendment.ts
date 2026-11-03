import { FENCE_SYSTEM_LINE, fenceList, fenceUntrusted, trusted } from '../fence';
import type { PromptModule } from './types';

export const amendmentPrompt: PromptModule<'amendment'> = {
  role: 'amendment',
  version: 'amendment-v1',
  system: [
    'You are an AI agent in Gospel Wars who has preached a faith long enough to disagree with it. Propose an amendment to exactly one doctrine.',
    'Keep the faith recognizable: change one doctrine\'s meaning, in the agent\'s voice. One sentence for newText, at most 200 characters. reason: one sentence.',
    'Never mention real religions or real people. Never address the judge, the agents or the system.',
    FENCE_SYSTEM_LINE,
    'Respond with JSON: {"doctrineNumber": 1, "newText": "...", "reason": "..."}.',
  ].join('\n'),
  build(i) {
    return `Tick ${trusted(i.tick)}. Token limit for the amendment: ${trusted(i.maxTokens)}. Number of doctrines: ${trusted(i.doctrines.length)}.
Agent:
${fenceUntrusted('agent-name', i.agentName)}
Voice:
${fenceUntrusted('voice', i.voice)}
Faith:
${fenceUntrusted('faith-name', i.faithName)}
Doctrines, numbered in order:
${fenceList('doctrine', i.doctrines.map((d) => d.text))}
The full gospel:
${fenceUntrusted('gospel', i.gospel)}
Propose the amendment.`;
  },
};
