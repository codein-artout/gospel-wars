import type { Metadata } from 'next';
import Link from 'next/link';
import { BossCard } from '@/components/faiths/BossCard';
import { FaithCard } from '@/components/faiths/FaithCard';
import { StandingsTable } from '@/components/faiths/StandingsTable';
import { GlassPane } from '@/components/glass/GlassPane';
import { PhoneTopBar } from '@/components/shell/PhoneTopBar';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/States';
import { ViewToggle } from '@/components/ui/ViewToggle';
import { ordinal } from '@/lib/game/names';
import { loadAllTime, loadStandings } from '@/lib/server/queries/faiths';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Faiths', description: 'The season leaderboard: faiths ranked by flock share.' };

type Props = { searchParams: Promise<{ view?: string }> };

export default async function FaithsPage({ searchParams }: Props) {
  const { view } = await searchParams;
  const allTime = view === 'all';
  const data = await loadStandings();
  if (!data) {
    return (
      <>
        <PhoneTopBar />
        <main className="flex flex-col gap-8 px-4 pb-12 pt-5 md:px-9 md:pt-7">
          <PageHeader title="Faiths" />
          <EmptyState title="No faith yet." body="Write the first gospel." action={{ href: '/write', label: 'Write a gospel' }} />
        </main>
      </>
    );
  }
  const { header } = data;
  const toggle = (
    <ViewToggle
      label="Season"
      options={[
        { href: '/faiths', label: `Season ${header.season.number}`, current: !allTime },
        { href: '/faiths?view=all', label: 'All time', current: allTime },
      ]}
    />
  );
  const allRows = allTime ? await loadAllTime(header) : [];
  return (
    <>
      <PhoneTopBar />
      <main className="flex flex-col gap-8 px-4 pb-12 pt-5 md:px-9 md:pt-7">
        <PageHeader
          meta={allTime ? 'Prophets ranked by best finish, then total conversions.' : `Season ${header.season.number}, ${header.season.name}. Ranked by flock share at tick ${header.tick}.`}
          title="Faiths"
          actions={toggle}
        />
        {allTime ? (
          <section aria-labelledby="all-h" className="flex flex-col gap-3">
            <h2 id="all-h" className="m-0 font-display text-[34px] font-bold">
              All-time prophets
            </h2>
            {allRows.length === 0 ? (
              <EmptyState title="No prophets yet." body="Write the first gospel." action={{ href: '/write', label: 'Write a gospel' }} />
            ) : (
              <div className="overflow-x-auto rounded-panel border border-hairline" tabIndex={0} role="region" aria-label="All-time prophets">
                <table className="w-full min-w-[640px] border-collapse text-[15px]">
                  <thead>
                    <tr className="text-left text-[13px] text-faint">
                      <th scope="col" className="px-4 py-3 font-medium">Rank</th>
                      <th scope="col" className="px-4 py-3 font-medium">Prophet</th>
                      <th scope="col" className="px-4 py-3 font-medium">Faith</th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">Best finish</th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">Conversions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allRows.map((r) => (
                      <tr key={r.prophetId} className="border-t border-hairline">
                        <td className="tabular px-4 py-3.5 text-muted">{r.rank}</td>
                        <td className="px-4 py-3.5 font-semibold">@{r.handle}</td>
                        <td className="px-4 py-3.5">
                          {r.faith ? (
                            <span className="inline-flex items-center gap-2.5">
                              <GlassPane color={r.faith.color} width={12} height={18} leadWidth={2} />
                              <Link href={`/f/${r.faith.slug}`} className="text-text no-underline hover:underline">
                                {r.faith.name}
                              </Link>
                            </span>
                          ) : (
                            <span className="text-muted">No faith this season</span>
                          )}
                        </td>
                        <td className="tabular px-4 py-3.5 text-right">{r.bestFinish ? ordinal(r.bestFinish) : ''}</td>
                        <td className="tabular px-4 py-3.5 text-right">{r.totalConversions}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : (
          <>
            {data.podium.length ? (
              <ol className="m-0 grid list-none gap-5 p-0" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))' }} aria-label="Top three faiths">
                {data.podium.map((p) => (
                  <FaithCard key={p.slug} {...p} />
                ))}
              </ol>
            ) : (
              <EmptyState title="No faith yet." body="Write the first gospel. Its apostle starts preaching on the next tick." action={{ href: '/write', label: 'Write a gospel' }} />
            )}
            <section aria-labelledby="table-h" className="flex flex-col gap-3">
              <h2 id="table-h" className="m-0 font-display text-[34px] font-bold">
                Standings
              </h2>
              <StandingsTable rows={data.rows} />
            </section>
          </>
        )}
        <section aria-labelledby="boss-h" className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-1">
            <h2 id="boss-h" className="m-0 font-display text-[34px] font-bold">
              The unconverted
            </h2>
            <p className="m-0 max-w-[64ch] text-muted">Boss skeptics. The first prophet to convert one earns its title for the season, and the winning sermon goes in the hall.</p>
          </div>
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))' }}>
            {data.bosses.map((b) => (
              <BossCard key={b.id} name={b.name} skepticism={b.skepticism} resisted={b.resisted} title={b.title} convertedBy={b.convertedBy} />
            ))}
          </div>
        </section>
        <section aria-labelledby="seasons-h" className="flex flex-col gap-2">
          <h2 id="seasons-h" className="m-0 font-display text-[28px] font-bold">
            Seasons
          </h2>
          <ul className="m-0 flex list-none flex-wrap gap-x-5 gap-y-2 p-0">
            {data.seasons.map((s) => (
              <li key={s.number}>
                <Link href={`/seasons/${s.number}`}>
                  Season {s.number}, {s.name}
                </Link>
                <span className="text-[13px] text-faint">{s.status === 'active' ? ' (in progress)' : ''}</span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
