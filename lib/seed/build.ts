import type { Db } from '@/lib/db/client';
import type { Prisma } from '@/lib/db/generated/client';
import { generateAgents } from '@/lib/game/agents';
import { resolveConfig, type ApostleStyle } from '@/lib/game/config';
import { shortFaithName } from '@/lib/game/names';
import { seed, stableId } from '@/lib/game/rng';
import { countTokens } from '@/lib/game/tokens';

export type SeedFaith = {
  slug: string;
  name: string;
  color: string;
  style: ApostleStyle;
  apostleName: string;
  gospel: string;
  prophetId: string | null;
  /** Agents in this faith at tick 0. */
  founding: number;
};

export type CreateWorldInput = {
  slug: string;
  name: string;
  seed: string;
  agentNames: readonly string[];
  faiths: SeedFaith[];
  configOverrides?: Prisma.InputJsonValue;
};

/** Builds a world at tick 0: season 1, faiths with founding flocks, agents, spans and snapshots. */
export async function createWorld(db: Db, input: CreateWorldInput): Promise<{ worldId: string; seasonId: string; faithIds: Record<string, string> }> {
  const config = resolveConfig(input.configOverrides ?? {});
  const worldId = stableId('world', input.slug);
  const seasonId = stableId('season', worldId, 1);
  const agents = generateAgents(input.agentNames, input.seed, config);

  return db.$transaction(
    async (tx) => {
      await tx.world.create({ data: { id: worldId, slug: input.slug, name: input.name, seed: input.seed, configOverrides: input.configOverrides ?? {} } });
      await tx.season.create({ data: { id: seasonId, worldId, number: 1, name: config.seasonNames[0]!, startTick: 0 } });
      await tx.world.update({ where: { id: worldId }, data: { currentSeasonId: seasonId } });

      const faithIds: Record<string, string> = {};
      for (const f of input.faiths) {
        const id = stableId('faith', worldId, f.slug);
        const revId = stableId('rev', id, 1);
        faithIds[f.slug] = id;
        await tx.faith.create({
          data: { id, worldId, seasonId, slug: f.slug, name: f.name, shortName: shortFaithName(f.name), color: f.color, founderType: 'human', prophetId: f.prophetId, foundedTick: 0 },
        });
        await tx.gospelRevision.create({ data: { id: revId, faithId: id, number: 1, body: f.gospel, tokens: countTokens(f.gospel, config), createdAtTick: 0, effectiveTick: 0, authorId: f.prophetId } });
        await tx.faith.update({ where: { id }, data: { currentRevisionId: revId } });
        await tx.apostle.create({ data: { id: stableId('apostle', id), faithId: id, name: f.apostleName, style: f.style } });
      }

      // Founding flocks: a seeded shuffle of the non-boss agents.
      const rng = seed(input.seed, 0, 'founding');
      const seats = rng.shuffle(agents.filter((a) => !a.isBoss).map((a) => a.seat));
      const faithOfSeat = new Map<number, string>();
      let k = 0;
      for (const f of input.faiths) for (let i = 0; i < f.founding && k < seats.length; i++) faithOfSeat.set(seats[k++]!, faithIds[f.slug]!);

      const rows: Prisma.AgentCreateManyInput[] = agents.map((a) => {
        const faithId = faithOfSeat.get(a.seat) ?? null;
        const conviction = faithId ? seed(input.seed, 0, 'initial-conviction', a.seat).int(config.initialConviction.min, config.initialConviction.max) : a.conviction;
        return {
          id: stableId('agent', worldId, a.seat),
          worldId,
          slug: a.slug,
          name: a.name,
          persona: a.persona,
          voice: a.voice,
          archetype: a.archetype,
          seat: a.seat,
          ...a.traits,
          isBoss: a.isBoss,
          bossTitle: a.bossTitle,
          faithId,
          conviction,
          leanings: {},
          convertedAtTick: faithId ? 0 : null,
        };
      });
      await tx.agent.createMany({ data: rows });
      await tx.faithSpan.createMany({ data: rows.map((r) => ({ id: stableId('span', r.id!, 0), agentId: r.id!, faithId: r.faithId ?? null, fromTick: 0 })) });

      const nonBoss = rows.filter((r) => !r.isBoss);
      const keys = [...Object.values(faithIds), 'unaligned'];
      await tx.shareSnapshot.createMany({
        data: keys.map((key) => {
          const members = nonBoss.filter((r) => (key === 'unaligned' ? !r.faithId : r.faithId === key)).length;
          return { id: stableId('snap', worldId, 0, key), worldId, seasonId, tick: 0, faithKey: key, faithId: key === 'unaligned' ? null : key, members, share: nonBoss.length ? members / nonBoss.length : 0 };
        }),
      });
      return { worldId, seasonId, faithIds };
    },
    { timeout: 60_000 },
  );
}
