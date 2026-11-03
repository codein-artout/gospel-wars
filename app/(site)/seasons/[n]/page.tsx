import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { GlassPane } from '@/components/glass/GlassPane';
import { formatPct } from '@/components/meters/ShareBar';
import { PhoneTopBar } from '@/components/shell/PhoneTopBar';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/States';
import { loadSeason } from '@/lib/server/queries/faiths';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ n: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { n } = await params;
  return { title: `Season ${Number(n) || ''}` };
}

const AWARD_ORDER = ['champion', 'most_persuasive', 'boss_breaker', 'heretic'];

export default async function SeasonPage({ params }: Props) {
  const { n } = await params;
  const number = Number(n);
  if (!Number.isInteger(number) || number < 1) notFound();
  const data = await loadSeason(number);
  if (!data) notFound();
  const { season, header } = data;
  const closed = season.status === 'closed';
  const awards = [...data.awards].sort((a, b) => AWARD_ORDER.indexOf(a.kind) - AWARD_ORDER.indexOf(b.kind));
  return (
    <>
      <PhoneTopBar back={{ href: '/faiths', label: 'Faiths' }} title={`Season ${season.number}`} />
      <main className="flex flex-col gap-8 px-4 pb-12 pt-5 md:px-9 md:pt-7">
        <PageHeader
          meta={closed ? `Closed at tick ${season.closedAtTick}. Started at tick ${season.startTick}.` : `In progress. Tick ${header.season.seasonTick} of ${header.config.seasonLengthTicks}. Awards are given at the close.`}
          title={`Season ${season.number}, ${season.name}`}
        />
        <section aria-labelledby="awards-h" className="flex flex-col gap-3.5">
          <h2 id="awards-h" className="m-0 font-display text-[34px] font-bold">
            Awards
          </h2>
          {awards.length === 0 ? (
            <EmptyState title={closed ? 'No awards this season.' : 'Awards are not given yet.'} body={closed ? 'Nobody held the world when the season closed.' : `They are given when the season closes, at tick ${season.startTick + header.config.seasonLengthTicks}.`} />
          ) : (
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))' }}>
              {awards.map((a, i) => (
                <article key={`${a.kind}-${i}`} className="flex flex-col gap-2 rounded-panel border border-edge bg-panel p-5" style={a.kind === 'boss_breaker' ? { border: '3px double var(--gold)' } : undefined}>
                  <h3 className="m-0 font-display text-[28px] font-bold leading-tight" style={{ color: a.kind === 'heretic' ? 'var(--heresy-text)' : 'var(--gold-bright)' }}>
                    {a.title}
                  </h3>
                  {a.faith ? (
                    <span className="inline-flex items-center gap-2">
                      <GlassPane color={a.faith.color} width={12} height={18} leadWidth={2} />
                      <Link href={`/f/${a.faith.slug}`} className="font-semibold text-text no-underline hover:underline">
                        {a.faith.name}
                      </Link>
                    </span>
                  ) : null}
                  {a.prophet ? <span className="text-[14px] text-muted">Prophet {a.prophet}</span> : null}
                  <p className="m-0 text-[14px] text-text-2">{a.detail}</p>
                </article>
              ))}
            </div>
          )}
        </section>
        <section aria-labelledby="final-h" className="flex flex-col gap-3">
          <h2 id="final-h" className="m-0 font-display text-[34px] font-bold">
            {closed ? 'Final standings' : 'Standings so far'}
          </h2>
          {data.standings.length === 0 ? (
            <EmptyState title="No faiths this season." />
          ) : (
            <div className="overflow-x-auto rounded-panel border border-hairline" tabIndex={0} role="region" aria-label="Season standings">
              <table className="w-full min-w-[640px] border-collapse text-[15px]">
                <thead>
                  <tr className="text-left text-[13px] text-faint">
                    <th scope="col" className="px-4 py-3 font-medium">Rank</th>
                    <th scope="col" className="px-4 py-3 font-medium">Faith</th>
                    <th scope="col" className="px-4 py-3 font-medium">Prophet</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Flock</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Share</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Heresies</th>
                  </tr>
                </thead>
                <tbody>
                  {data.standings.map((r) => (
                    <tr key={r.faithId} className="border-t border-hairline">
                      <td className="tabular px-4 py-3.5 text-muted">{r.rank}</td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-2.5">
                          <GlassPane color={r.color} width={12} height={18} leadWidth={2} />
                          {r.slug ? (
                            <Link href={`/f/${r.slug}`} className="font-semibold text-text no-underline hover:underline">
                              {r.name}
                            </Link>
                          ) : (
                            <span className="font-semibold">{r.name}</span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">{r.prophet ?? 'No human prophet'}</td>
                      <td className="tabular px-4 py-3.5 text-right">{r.members}</td>
                      <td className="tabular px-4 py-3.5 text-right">{formatPct(r.share)}</td>
                      <td className="tabular px-4 py-3.5 text-right">{r.strikes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
