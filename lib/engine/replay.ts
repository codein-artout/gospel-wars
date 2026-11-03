import type { Db } from '@/lib/db/client';
import { GameConfigSchema, resolveConfig, type GameConfig } from '@/lib/game/config';
import { encounterDraws, resolveEncounter, type RollInput } from '@/lib/game/rules/encounter';

export type ReplayResult = {
  encounterId: string;
  identical: boolean;
  differences: { field: string; stored: unknown; replayed: unknown }[];
};

/**
 * Re-runs resolveEncounter from the stored roll input with the config the tick used, and
 * re-derives the seeded draws, then compares with the stored result (GAME.md §17).
 */
export async function replayEncounter(db: Db, encounterId: string): Promise<ReplayResult> {
  const e = await db.encounter.findUniqueOrThrow({ where: { id: encounterId }, include: { world: { select: { seed: true, configOverrides: true } } } });
  const run = await db.tickRun.findUnique({ where: { worldId_tick: { worldId: e.worldId, tick: e.tick } }, select: { config: true } });
  const parsed = GameConfigSchema.safeParse(run?.config);
  const config: GameConfig = parsed.success ? parsed.data : resolveConfig(e.world.configOverrides);
  const input = e.rollInput as unknown as RollInput;
  const replayed = resolveEncounter(input, config) as unknown as Record<string, unknown>;
  const stored = e.rollResult as unknown as Record<string, unknown>;
  const differences: ReplayResult['differences'] = [];
  for (const k of new Set([...Object.keys(stored), ...Object.keys(replayed)])) {
    if (JSON.stringify(stored[k]) !== JSON.stringify(replayed[k])) differences.push({ field: k, stored: stored[k], replayed: replayed[k] });
  }
  const draws = encounterDraws(e.world.seed, e.tick, e.index);
  if (draws.noiseUnit !== input.noiseUnit) differences.push({ field: 'noiseUnit', stored: input.noiseUnit, replayed: draws.noiseUnit });
  if (draws.backlashUnit !== input.backlashUnit) differences.push({ field: 'backlashUnit', stored: input.backlashUnit, replayed: draws.backlashUnit });
  for (const [field, value] of [['S', e.S], ['R', e.R], ['noise', e.noise], ['pull', e.pull]] as const) {
    if (replayed[field] !== value) differences.push({ field: `column.${field}`, stored: value, replayed: replayed[field] });
  }
  return { encounterId, identical: differences.length === 0, differences };
}
