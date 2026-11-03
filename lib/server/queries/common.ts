import type { GlassLead } from '@/components/glass/GlassPane';
import { resolveConfig, type GameConfig } from '@/lib/game/config';
import { db, type Db } from '@/lib/db/client';
import { worldSlug } from '@/lib/server/world';

export type WorldHeader = {
  id: string;
  seed: string;
  tick: number;
  config: GameConfig;
  season: { id: string; number: number; name: string; startTick: number; seasonTick: number; ticksLeft: number };
};

/** The world and its current season, or null before seeding. */
export async function loadWorldHeader(client?: Db): Promise<WorldHeader | null> {
  const c = client ?? (await db());
  const w = await c.world.findUnique({ where: { slug: worldSlug() }, include: { currentSeason: true } });
  if (!w || !w.currentSeason) return null;
  const config = resolveConfig(w.configOverrides);
  const seasonTick = w.currentTick - w.currentSeason.startTick;
  return {
    id: w.id,
    seed: w.seed,
    tick: w.currentTick,
    config,
    season: { id: w.currentSeason.id, number: w.currentSeason.number, name: w.currentSeason.name, startTick: w.currentSeason.startTick, seasonTick, ticksLeft: Math.max(0, config.seasonLengthTicks - seasonTick) },
  };
}

export function leadFor(founderType: 'human' | 'agent' | null | undefined): Exclude<GlassLead, 'boss'> {
  return founderType === 'agent' ? 'agent' : 'solid';
}

/** "ends in about 26 hours" from ticks left and tickMinutes. */
export function endsIn(ticksLeft: number, tickMinutes: number): string {
  const minutes = ticksLeft * tickMinutes;
  if (minutes <= 0) return 'ends this tick';
  if (minutes < 90) return `ends in about ${minutes} minutes`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `ends in about ${hours} hours`;
  return `ends in about ${Math.round(hours / 24)} days`;
}

export function seasonMeta(h: WorldHeader): string {
  return `Season ${h.season.number}, ${h.season.name}. Tick ${h.season.seasonTick} of ${h.config.seasonLengthTicks}, ${endsIn(h.season.ticksLeft, h.config.tickMinutes)}.`;
}
