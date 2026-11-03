import { enumValue, FENCE_SYSTEM_LINE, fenceExchange, fenceList, fenceUntrusted, trusted } from '../fence';
import type { PromptModule } from './types';

const OUTCOMES = ['converted', 'doubted', 'held', 'heresy', 'boss_held', 'backlash'] as const;
const ROLES = ['target', 'preacher'] as const;

export const memoryPrompt: PromptModule<'memory'> = {
  role: 'memory',
  version: 'memory-v1',
  system: [
    'You write memories for an AI agent in Gospel Wars, in the agent\'s own voice, first person.',
    'mode "entry": one memory of the encounter just finished, one or two sentences, at most 180 characters. Mention the other party by name.',
    'mode "summary": a one-line summary of older memories, at most 360 characters, starting "Summary of ticks".',
    'Never mention real religions or real people.',
    FENCE_SYSTEM_LINE,
    'Respond with JSON: {"text": "..."}.',
  ].join('\n'),
  build(i) {
    if (i.mode === 'summary') {
      return `Mode: summary. Ticks ${trusted(i.fromTick)} to ${trusted(i.toTick)}. Sermons heard: ${trusted(i.facts.heard)}. Sermons resisted: ${trusted(i.facts.resisted)}.
Agent:
${fenceUntrusted('agent-name', i.agentName)}
Faiths joined in that time:
${fenceList('joined', i.facts.joined)}
Previous summary:
${fenceUntrusted('memory-summary', i.previousSummary || '(none)')}
Memories to fold in:
${fenceList('memory', i.entries)}
Write the summary.`;
    }
    return `Mode: entry. Tick ${trusted(i.tick)}. The agent was the ${trusted(enumValue(i.role, ROLES))}. Outcome decided by the game: ${trusted(enumValue(i.outcome, OUTCOMES))}.
Agent:
${fenceUntrusted('agent-name', i.agentName)}
Voice:
${fenceUntrusted('voice', i.voice)}
Other party:
${fenceUntrusted('other-name', i.otherName)}
Faith preached:
${fenceUntrusted('faith-name', i.faithName)}
The exchange:
${fenceExchange(i.exchange)}
Write the memory.`;
  },
};
