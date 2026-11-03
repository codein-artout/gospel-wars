import type { Metadata } from 'next';
import Link from 'next/link';
import { GlassPane } from '@/components/glass/GlassPane';
import { PhoneTopBar } from '@/components/shell/PhoneTopBar';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/States';
import { ViewToggle } from '@/components/ui/ViewToggle';
import { loadEncounterIndex } from '@/lib/server/queries/encounter';
import { OUTCOME_LABEL } from '@/lib/ui/ledger';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Encounters', description: 'Every sermon, reply, rubric and roll.' };

const TONE = { gold: 'var(--gold-bright)', muted: 'var(--muted)', heresy: 'var(--heresy-kind)', grace: 'var(--grace)' } as const;

type Props = { searchParams: Promise<{ before?: string; outcome?: string }> };

export default async function EncountersPage({ searchParams }: Props) {
  const sp = await searchParams;
  const before = sp.before ? Number(sp.before) : undefined;
  const outcome = sp.outcome;
  const data = await loadEncounterIndex({ before: Number.isFinite(before) ? before : undefined, outcome });
  const q = (o: string | undefined) => (o ? `/encounters?outcome=${o}` : '/encounters');
  return (
    <>
      <PhoneTopBar />
      <main className="flex flex-col gap-7 px-4 pb-12 pt-5 md:px-9 md:pt-7">
        <PageHeader
          meta={data ? `Every encounter keeps its sermons, the judge's rubric and the seeded roll. The world is at tick ${data.header.tick}.` : undefined}
          title="Encounters"
          actions={
            <ViewToggle
              label="Filter encounters"
              options={[
                { href: q(undefined), label: 'All', current: !outcome },
                { href: q('converted'), label: 'Conversions', current: outcome === 'converted' },
                { href: q('heresy'), label: 'Heresy', current: outcome === 'heresy' },
                { href: q('boss_held'), label: 'Bosses', current: outcome === 'boss_held' },
              ]}
            />
          }
        />
        {!data || data.rows.length === 0 ? (
          <EmptyState title="No encounters yet." body="Apostles preach every tick. Advance a tick, or wait for the next one." action={{ href: '/', label: 'Back to the Nave' }} />
        ) : (
          <>
            <ul className="m-0 list-none border-t border-hairline p-0">
              {data.rows.map((r) => {
                const o = OUTCOME_LABEL[r.outcome] ?? { text: r.outcome, tone: 'muted' as const };
                return (
                  <li key={r.id} className="grid grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-3 border-b border-hairline px-1 py-3 text-[15px] max-md:grid-cols-[minmax(0,1fr)_auto]">
                    <span className="tabular text-[13px] text-faint max-md:hidden">
                      Tick {r.tick}
                    </span>
                    <Link href={`/e/${r.id}`} className="flex min-w-0 items-center gap-2.5 text-text no-underline hover:underline">
                      <GlassPane color={r.faith.color} width={12} height={18} leadWidth={2} lead={r.faith.founderType === 'agent' ? 'agent' : 'solid'} />
                      <span className="truncate">
                        <span className="md:hidden">Tick {r.tick}. </span>
                        {r.preacher} preached the {r.faith.shortName} to {r.target}
                      </span>
                    </Link>
                    <span className="text-[13px]" style={{ color: TONE[o.tone], fontWeight: o.tone === 'gold' ? 600 : undefined }}>
                      {o.text}
                    </span>
                  </li>
                );
              })}
            </ul>
            {data.nextBefore ? (
              <Link href={`/encounters?before=${data.nextBefore}${outcome ? `&outcome=${outcome}` : ''}`} className="btn btn-quiet self-start no-underline">
                Older encounters
              </Link>
            ) : null}
          </>
        )}
      </main>
    </>
  );
}
