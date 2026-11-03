export type FaithStanding = { id: string; members: number; conversionsThisSeason: number; foundedTick: number };
export type RankedFaith<T extends FaithStanding> = T & { share: number; rank: number };

/** Flock share = members ÷ non-boss agents (GAME.md §1). */
export function flockShare(members: number, nonBossCount: number): number {
  return nonBossCount > 0 ? members / nonBossCount : 0;
}

/**
 * Leaderboard (GAME.md §11): by share at the current tick; ties by conversions this season,
 * then earliest founding tick, then id (total order).
 */
export function rankFaiths<T extends FaithStanding>(faiths: T[], nonBossCount: number): RankedFaith<T>[] {
  return faiths
    .map((f) => ({ ...f, share: flockShare(f.members, nonBossCount) }))
    .sort(
      (a, b) =>
        b.members - a.members ||
        b.conversionsThisSeason - a.conversionsThisSeason ||
        a.foundedTick - b.foundedTick ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    )
    .map((f, i) => ({ ...f, rank: i + 1 }));
}

export type ProphetRecord = { prophetId: string; handle: string; bestFinish: number | null; totalConversions: number };

/** All-time view: prophets by best finish (lower is better), then total conversions. */
export function rankProphets(records: ProphetRecord[]): (ProphetRecord & { rank: number })[] {
  return [...records]
    .sort(
      (a, b) =>
        (a.bestFinish ?? Number.POSITIVE_INFINITY) - (b.bestFinish ?? Number.POSITIVE_INFINITY) ||
        b.totalConversions - a.totalConversions ||
        (a.handle < b.handle ? -1 : a.handle > b.handle ? 1 : 0),
    )
    .map((r, i) => ({ ...r, rank: i + 1 }));
}
