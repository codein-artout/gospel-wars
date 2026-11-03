import type { Metadata } from 'next';
import Link from 'next/link';
import { GlassPane } from '@/components/glass/GlassPane';
import { PhoneTopBar } from '@/components/shell/PhoneTopBar';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/States';
import { loadAgentIndex } from '@/lib/server/queries/agent';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Agents', description: 'The 48 agents of the world, their faiths and convictions.' };

export default async function AgentsPage() {
  const data = await loadAgentIndex();
  if (!data) {
    return (
      <>
        <PhoneTopBar />
        <main className="flex flex-col gap-7 px-4 pb-12 pt-5 md:px-9 md:pt-7">
          <PageHeader title="Agents" />
          <EmptyState title="No agents yet." body="Seed the world first." />
        </main>
      </>
    );
  }
  const unaligned = data.header.config.unalignedColor;
  return (
    <>
      <PhoneTopBar />
      <main className="flex flex-col gap-7 px-4 pb-12 pt-5 md:px-9 md:pt-7">
        <PageHeader meta={`${data.agents.length} agents. Each one is a pane in the rose window.`} title="Agents" />
        <ul className="m-0 grid list-none gap-3 p-0" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))' }}>
          {data.agents.map((a) => {
            const f = a.faith && !a.faith.hidden ? a.faith : null;
            const label = a.isBoss && !f ? 'Boss skeptic, unconverted' : a.isFounder ? `Founder, ${f?.shortName ?? 'a faith'}` : (f?.shortName ?? 'Unaligned');
            return (
              <li key={a.id}>
                <Link href={`/a/${a.slug}`} className="flex h-full items-start gap-3 rounded-panel border border-edge bg-panel p-4 text-text no-underline hover:border-gold">
                  <GlassPane color={a.isBoss && !f ? 'linear-gradient(160deg, var(--boss-a), var(--boss-b))' : (f?.color ?? unaligned)} width={16} height={26} lead={a.isBoss ? 'boss' : f?.founderType === 'agent' ? 'agent' : 'solid'} />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="font-semibold">{a.name}</span>
                    <span className="text-[13px] text-muted">{label}</span>
                    <span className="tabular text-[13px] text-faint">
                      Conviction {a.conviction}, skepticism {a.skepticism}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </main>
    </>
  );
}
