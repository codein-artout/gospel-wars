import type { TickSummary } from './runTick';

/** "Tick 143 done. 3 conversions." (DESIGN.md copy voice), plus details for the CLI. */
export function tickHeadline(s: TickSummary): string {
  if (s.status === 'noop') return `Tick ${s.tick} already ran. Nothing to do.`;
  if (s.status === 'busy') return `Tick ${s.tick} is already running. Try again in a moment.`;
  const c = `${s.conversions} ${s.conversions === 1 ? 'conversion' : 'conversions'}`;
  return `Tick ${s.tick} done. ${c}.${s.seasonClosed ? ' The season closed.' : ''}`;
}

export function tickDetails(s: TickSummary): string {
  return `${s.encounters} encounters, ${s.heresies} heresies, ${s.schisms} schisms, ${s.bossHeld} boss resistances; ${s.llmCalls} LLM calls, ${s.fallbacks} fallbacks, ${s.ms}ms`;
}
