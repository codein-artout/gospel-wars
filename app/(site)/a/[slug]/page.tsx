import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AgentHero } from '@/components/agent/AgentHero';
import { EncounterLog } from '@/components/agent/EncounterLog';
import { FaithJourneyStrip } from '@/components/agent/FaithJourneyStrip';
import { MemoryList } from '@/components/agent/MemoryList';
import { LeaningBar } from '@/components/meters/LeaningBar';
import { TraitMeter } from '@/components/meters/Meter';
import { PhoneTopBar } from '@/components/shell/PhoneTopBar';
import { loadAgent } from '@/lib/server/queries/agent';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const d = await loadAgent(slug);
  if (!d) return { title: 'Agent not found' };
  return { title: d.agent.name, description: d.agent.persona, openGraph: { title: `${d.agent.name} | Gospel Wars`, description: d.agent.persona } };
}

export default async function AgentPage({ params }: Props) {
  const { slug } = await params;
  const d = await loadAgent(slug);
  if (!d) notFound();
  const { agent } = d;
  const description = (
    <>
      {agent.persona}{' '}
      {agent.foundedFaith ? (
        <>
          Founder of the <Link href={`/f/${agent.foundedFaith.slug}`}>{agent.foundedFaith.name}</Link>, preaching as its apostle.
        </>
      ) : agent.faith ? (
        <>
          Now with the <Link href={`/f/${agent.faith.slug}`}>{agent.faith.name.replace(/^The /, '')}</Link> at conviction {agent.conviction}.
        </>
      ) : (
        <>Unaligned, attached to having no faith at conviction {agent.conviction}.</>
      )}
    </>
  );
  return (
    <>
      <PhoneTopBar back={{ href: '/agents', label: 'Agents' }} title={agent.name} />
      <main className="flex flex-col gap-9 px-4 pb-14 pt-6 md:px-9 md:pt-8">
        <AgentHero name={agent.name} color={agent.color} isBoss={agent.isBoss && !agent.faith} meta={d.meta} description={description} stats={d.stats} />

        <section aria-labelledby="path-h" className="flex flex-col gap-3">
          <h2 id="path-h" className="m-0 font-display text-[28px] font-bold md:text-[32px]">
            Faith journey
          </h2>
          <FaithJourneyStrip segments={d.journey.segments} nowTick={d.header.tick} labels={d.journey.labels} />
        </section>

        <div className="flex flex-wrap items-start gap-8">
          <section aria-labelledby="mind-h" className="flex min-w-0 flex-[1_1_380px] flex-col gap-4">
            <h2 id="mind-h" className="m-0 font-display text-[28px] font-bold md:text-[32px]">
              Temperament
            </h2>
            {d.traits.map((t) => (
              <TraitMeter key={t.key} label={t.label} value={t.value} note={t.note} />
            ))}
          </section>
          <section aria-labelledby="lean-h" className="flex min-w-0 flex-[1_1_340px] flex-col gap-3.5">
            <h2 id="lean-h" className="m-0 font-display text-[28px] font-bold md:text-[32px]">
              Leanings
            </h2>
            <p className="m-0 text-[14px] text-muted">
              How far each faith has pulled {agent.name}. A leaning of {d.threshold} that beats {agent.isBoss ? 'its' : 'the agent’s'} conviction converts {agent.isBoss ? 'it, if the sermon is strong enough' : 'it'}.
            </p>
            {d.leanings.length === 0 ? <p className="m-0 text-muted">No faith has pulled this agent yet.</p> : null}
            {d.leanings.map((l) => (
              <LeaningBar key={l.name} name={l.name} color={l.color} value={l.value} threshold={d.threshold} />
            ))}
          </section>
        </div>

        <div className="flex flex-wrap items-start gap-8">
          <section aria-labelledby="mem-h" className="flex min-w-0 flex-[1_1_380px] flex-col gap-3">
            <h2 id="mem-h" className="m-0 font-display text-[28px] font-bold md:text-[32px]">
              Memory
            </h2>
            <p className="m-0 text-[14px] text-muted">
              The last {d.header.config.memoryWindow} things {agent.name} remembers. Older memories fade into a one-line summary.
            </p>
            <MemoryList items={d.memories} summary={d.summary} />
          </section>
          <section aria-labelledby="enc-h" className="flex min-w-0 flex-[1_1_340px] flex-col gap-3">
            <h2 id="enc-h" className="m-0 font-display text-[28px] font-bold md:text-[32px]">
              Encounters
            </h2>
            <EncounterLog rows={d.encounters} />
          </section>
        </div>
      </main>
    </>
  );
}
