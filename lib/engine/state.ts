import type { Db, Tx } from '@/lib/db/client';
import { resolveConfig, type ApostleStyle, type Archetype, type GameConfig } from '@/lib/game/config';
import type { AgentState } from '@/lib/game/types';

/** Everything a tick needs, loaded in a fixed number of queries (no N+1). */

export type FaithRow = {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  color: string;
  founderType: 'human' | 'agent';
  prophetId: string | null;
  prophetHandle: string | null;
  founderAgentId: string | null;
  parentId: string | null;
  strikes: number;
  silenced: boolean;
  foundedTick: number;
  currentRevisionId: string | null;
  conversionsThisSeason: number;
};

export type ApostleRow = {
  id: string;
  faithId: string;
  name: string;
  style: ApostleStyle;
  pendingStyle: ApostleStyle | null;
  agentId: string | null;
  winsThisSeason: number;
  totalWins: number;
};

export type RevisionRow = { id: string; faithId: string; number: number; body: string };

export type AgentRow = AgentState & {
  slug: string;
  persona: string;
  voice: string;
  seat: number;
  bossTitle: string | null;
  sermonsHeard: number;
  conversions: number;
  bossResistances: number;
  memorySummary: string;
  memorySinceSummary: number;
};

export type MemoryRow = { id: string; agentId: string; tick: number; text: string; aboutAgentId: string | null; faithId: string | null };

export type WorldState = {
  world: { id: string; slug: string; seed: string; currentTick: number; stateVersion: number; configOverrides: unknown };
  config: GameConfig;
  season: { id: string; number: number; name: string; startTick: number };
  faiths: FaithRow[];
  apostles: ApostleRow[];
  /** Current revision per faith after applying edits effective at `tick`. */
  revisions: Map<string, RevisionRow>;
  agents: AgentRow[];
  /** Last memoryWindow entries per agent this season, newest first. */
  memories: Map<string, MemoryRow[]>;
  recentPairs: Set<string>;
  seasonAgentSchisms: number;
  /** Faith colors in use by active faiths. */
  takenColors: Set<string>;
};

type Client = Db | Tx;

export async function loadWorldState(db: Client, worldId: string, tick: number, configOverride?: unknown): Promise<WorldState> {
  const world = await db.world.findUniqueOrThrow({ where: { id: worldId }, include: { currentSeason: true } });
  if (!world.currentSeason) throw new Error(`World ${world.slug} has no current season.`);
  const config = resolveConfig(configOverride === undefined ? world.configOverrides : deepMergeOverrides(world.configOverrides, configOverride));
  const season = world.currentSeason;

  const faithRows = await db.faith.findMany({
    where: { worldId, status: 'active' },
    include: { apostle: true, prophet: { select: { handle: true } } },
    orderBy: { id: 'asc' },
  });
  const faithIds = faithRows.map((f) => f.id);

  // Latest non-deleted revision effective by this tick, per faith.
  const revs = await db.gospelRevision.findMany({
    where: { faithId: { in: faithIds }, effectiveTick: { lte: tick }, deletedAt: null },
    orderBy: [{ faithId: 'asc' }, { number: 'desc' }],
    distinct: ['faithId'],
    select: { id: true, faithId: true, number: true, body: true },
  });

  const agentRows = await db.agent.findMany({ where: { worldId }, orderBy: { seat: 'asc' } });

  const memRows = await db.$queryRaw<MemoryRow[]>`
    SELECT id, "agentId", tick, text, "aboutAgentId", "faithId" FROM (
      SELECT m.*, ROW_NUMBER() OVER (PARTITION BY m."agentId" ORDER BY m.tick DESC, m.id DESC) AS rn
      FROM "AgentMemory" m JOIN "Agent" a ON a.id = m."agentId"
      WHERE a."worldId" = ${worldId} AND m.tick > ${season.startTick}
    ) ranked WHERE rn <= ${config.memoryWindow} ORDER BY "agentId", tick DESC, id DESC`;

  const recent = await db.encounter.findMany({
    where: { worldId, tick: { gt: tick - 1 - config.pairCooldownTicks, lt: tick } },
    select: { apostleId: true, preacherAgentId: true, targetId: true },
  });

  const seasonAgentSchisms = await db.faith.count({ where: { worldId, seasonId: season.id, founderType: 'agent' } });

  const memories = new Map<string, MemoryRow[]>();
  for (const m of memRows) {
    const list = memories.get(m.agentId) ?? [];
    list.push({ ...m, tick: Number(m.tick) });
    memories.set(m.agentId, list);
  }

  const apostles: ApostleRow[] = faithRows.flatMap((f) =>
    f.apostle
      ? [
          {
            id: f.apostle.id,
            faithId: f.id,
            name: f.apostle.name,
            style: f.apostle.style,
            pendingStyle: f.apostle.pendingStyle,
            agentId: f.apostle.agentId,
            winsThisSeason: f.apostle.winsThisSeason,
            totalWins: f.apostle.totalWins,
          },
        ]
      : [],
  );

  return {
    world: { id: world.id, slug: world.slug, seed: world.seed, currentTick: world.currentTick, stateVersion: world.stateVersion, configOverrides: world.configOverrides },
    config,
    season: { id: season.id, number: season.number, name: season.name, startTick: season.startTick },
    faiths: faithRows.map((f) => ({
      id: f.id,
      slug: f.slug,
      name: f.name,
      shortName: f.shortName,
      color: f.color,
      founderType: f.founderType,
      prophetId: f.prophetId,
      prophetHandle: f.prophet?.handle ?? null,
      founderAgentId: f.founderAgentId,
      parentId: f.parentId,
      strikes: f.strikes,
      silenced: f.silenced,
      foundedTick: f.foundedTick,
      currentRevisionId: f.currentRevisionId,
      conversionsThisSeason: f.conversionsThisSeason,
    })),
    apostles,
    revisions: new Map(revs.map((r) => [r.faithId, r])),
    agents: agentRows.map((a) => ({
      id: a.id,
      name: a.name,
      archetype: a.archetype as Archetype,
      traits: { openness: a.openness, loyalty: a.loyalty, pedantry: a.pedantry, sociability: a.sociability, skepticism: a.skepticism },
      isBoss: a.isBoss,
      isFounder: a.isFounder,
      faithId: a.faithId,
      conviction: a.conviction,
      leanings: parseLeanings(a.leanings),
      convertedAtTick: a.convertedAtTick,
      wins: a.wins,
      slug: a.slug,
      persona: a.persona,
      voice: a.voice,
      seat: a.seat,
      bossTitle: a.bossTitle,
      sermonsHeard: a.sermonsHeard,
      conversions: a.conversions,
      bossResistances: a.bossResistances,
      memorySummary: a.memorySummary,
      memorySinceSummary: a.memorySinceSummary,
    })),
    memories,
    recentPairs: new Set(recent.map((e) => `${e.apostleId ?? e.preacherAgentId}>${e.targetId}`)),
    seasonAgentSchisms,
    takenColors: new Set(faithRows.map((f) => f.color.toUpperCase())),
  };
}

export function parseLeanings(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    for (const [k, n] of Object.entries(v as Record<string, unknown>)) {
      const x = Number(n);
      if (Number.isFinite(x) && x > 0) out[k] = Math.max(0, Math.min(100, Math.round(x)));
    }
  }
  return out;
}

function deepMergeOverrides(a: unknown, b: unknown): unknown {
  if (!a || typeof a !== 'object' || Array.isArray(a)) return b;
  if (!b || typeof b !== 'object' || Array.isArray(b)) return b;
  const out: Record<string, unknown> = { ...(a as Record<string, unknown>) };
  for (const [k, v] of Object.entries(b as Record<string, unknown>)) out[k] = deepMergeOverrides(out[k], v);
  return out;
}
