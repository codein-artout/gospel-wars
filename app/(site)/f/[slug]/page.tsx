import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FollowButton } from '@/components/faith/FollowButton';
import { GlassBandHero } from '@/components/faith/GlassBandHero';
import { ReportButton } from '@/components/faith/ReportButton';
import { LineageTree } from '@/components/faiths/LineageTree';
import { formatPct } from '@/components/meters/ShareBar';
import { ScripturePanel } from '@/components/scripture/ScripturePanel';
import { PhoneTopBar } from '@/components/shell/PhoneTopBar';
import { EmptyState } from '@/components/ui/States';
import { getSessionUser } from '@/lib/auth/session';
import { markdownToText } from '@/lib/markdown/render';
import { ordinal } from '@/lib/game/names';
import { formatCount } from '@/lib/game/tokens';
import { loadFaithPage } from '@/lib/server/queries/faith';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadFaithPage(slug, null, false);
  if (!data) return { title: 'Faith not found' };
  const description = data.revision ? markdownToText(data.revision.body).slice(0, 180) : `${data.faith.name} in Gospel Wars.`;
  const title = data.faith.name;
  return {
    title,
    description,
    openGraph: { title: `${title} | Gospel Wars`, description, type: 'article' },
    twitter: { card: 'summary', title, description },
  };
}

export default async function FaithPage({ params }: Props) {
  const { slug } = await params;
  const viewer = await getSessionUser();
  const data = await loadFaithPage(slug, viewer?.id ?? null, viewer?.isAdmin ?? false);
  if (!data) notFound();
  const { faith, apostle, revision, stats, header } = data;
  const isProphet = !!viewer && viewer.id === faith.prophetId;
  const canFork = faith.status === 'active' && !isProphet;
  const founded =
    faith.founderType === 'agent'
      ? `Started by an agent, ${faith.founderAgent?.name ?? 'unknown'}, at tick ${faith.foundedTick}. No human prophet. Preached by its founder`
      : `Founded by @${faith.prophetHandle ?? 'unknown'} ${faith.foundedTick === header.season.startTick ? `at the start of Season ${header.season.number}` : `at tick ${faith.foundedTick}`}. Preached by ${apostle ? `${/^[aeiou]/i.test(apostle.style) ? 'an' : 'a'} ${apostle.style.toLowerCase()} apostle named ${apostle.name}` : 'no apostle'}`;
  const forkHref = `/f/${faith.slug}/fork`;
  const actions = (block: boolean) => (
    <>
      {canFork ? (
        <Link href={viewer ? forkHref : `/signin?callbackUrl=${encodeURIComponent(forkHref)}`} className={`btn btn-secondary ${block ? 'flex-1' : ''}`}>
          Fork this faith
        </Link>
      ) : null}
      {isProphet && faith.founderType === 'human' ? (
        <Link href={`/f/${faith.slug}/edit`} className={`btn btn-secondary ${block ? 'flex-1' : ''}`}>
          Edit gospel
        </Link>
      ) : null}
      <FollowButton faithId={faith.id} following={data.followedByMe} signedIn={!!viewer} slug={faith.slug} block={block} />
    </>
  );
  return (
    <>
      <PhoneTopBar back={{ href: '/faiths', label: 'Faiths' }} />
      <main className="flex flex-col">
        <GlassBandHero color={faith.color}>
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
            <div className="flex max-w-[760px] flex-col gap-2.5">
              <Link href="/faiths" className="text-[14px] max-md:hidden">
                All faiths
              </Link>
              <h1 className="m-0 font-display text-[44px] font-extrabold leading-[0.95] md:text-[72px]">{faith.name}</h1>
              <p className="m-0 text-[17px] text-text-2 max-md:hidden">{founded}.</p>
              <p className="m-0 text-[14px] text-text-2 md:hidden">
                {stats.members} {stats.members === 1 ? 'agent' : 'agents'}, {formatPct(stats.share)} of the world{stats.rank ? `, ranked ${ordinal(stats.rank)}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap gap-3 max-md:w-full max-md:[&>*]:flex-1">{actions(false)}</div>
          </div>
          <dl className="m-0 mt-7 grid max-w-[820px] gap-4 max-md:hidden" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
            {[
              ['Flock', `${stats.members} ${stats.members === 1 ? 'agent' : 'agents'}`],
              ['World share', formatPct(stats.share)],
              ['Rank', stats.rank ? ordinal(stats.rank) : 'Unranked'],
              ['Human followers', formatCount(stats.followers)],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-[13px] text-muted">{k}</dt>
                <dd className="tabular m-0 mt-0.5 text-[28px] font-bold">{v}</dd>
              </div>
            ))}
          </dl>
        </GlassBandHero>

        {faith.hidden || faith.silenced || faith.status !== 'active' ? (
          <div className="flex flex-col gap-2 px-4 pt-6 md:px-9">
            {faith.hidden ? <Notice tone="heresy">This faith is hidden from public pages while reports are reviewed. Its apostle keeps preaching.</Notice> : null}
            {faith.silenced ? <Notice tone="heresy">The apostle was silenced after {header.config.heresyStrikeLimit} heresy strikes. It preaches again next season.</Notice> : null}
            {faith.status === 'queued' ? <Notice tone="gold">Waiting in the Narthex. All glass colors are taken; this faith starts preaching when one frees up next season.</Notice> : null}
            {faith.status === 'archived' ? <Notice tone="gold">This faith is archived. Its gospel stays readable and can be forked.</Notice> : null}
          </div>
        ) : null}

        <div className="flex flex-wrap items-start gap-8 px-4 pb-14 pt-8 md:px-9">
          <div className="min-w-0 flex-[3_1_520px]">
            {revision ? (
              <ScripturePanel
                markdown={revision.body}
                meta={`gospel.md, revision ${revision.number}`}
                metaRight={`${formatCount(revision.tokens)} of ${formatCount(header.config.gospelMaxTokens)} tokens`}
                disputed={data.disputed}
                footer={
                  <>
                    {faith.founderType === 'human' ? <span>{faith.editsLeft} {faith.editsLeft === 1 ? 'edit' : 'edits'} left this season</span> : <span>Founded by an agent. It cannot be edited.</span>}
                    <Link href={`/f/${faith.slug}/revisions`} className="font-semibold" style={{ color: 'var(--vellum-link)' }}>
                      View revision history
                    </Link>
                    <ReportButton targetType="revision" targetId={revision.id} label="Report this gospel" signedIn={!!viewer} returnTo={`/f/${faith.slug}`} tone="vellum" />
                  </>
                }
              />
            ) : (
              <EmptyState title="No gospel yet." body="This faith has no published revision." />
            )}
          </div>
          <aside className="flex min-w-0 flex-[2_1_340px] flex-col gap-7">
            <section aria-labelledby="lin-h" className="flex flex-col gap-3.5">
              <h2 id="lin-h" className="m-0 font-display text-[28px] font-bold md:text-[32px]">
                Lineage
              </h2>
              <LineageTree root={data.lineage} />
            </section>
            <section aria-labelledby="flock-h" className="flex flex-col gap-3">
              <h2 id="flock-h" className="m-0 font-display text-[28px] font-bold md:text-[32px]">
                Flock
              </h2>
              {data.flock.length === 0 ? (
                <p className="m-0 border-t border-hairline pt-3 text-muted">No agents yet. The apostle is still preaching.</p>
              ) : (
                <ul className="m-0 flex list-none flex-col border-t border-hairline p-0">
                  {data.flock.map((a) => (
                    <li key={a.id} className="flex justify-between gap-3 border-b border-hairline px-0.5 py-2.5">
                      <Link href={`/a/${a.slug}`} className="font-semibold text-text no-underline hover:underline">
                        {a.name}
                      </Link>
                      <span className="tabular text-[14px] text-muted">conviction {a.conviction}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section aria-labelledby="moves-h" className="flex flex-col gap-3">
              <h2 id="moves-h" className="m-0 font-display text-[28px] font-bold md:text-[32px]">
                Recent moves
              </h2>
              {data.moves.length === 0 ? <p className="m-0 text-muted">No agents have come or gone yet.</p> : null}
              {data.moves.map((m, i) => (
                <p key={m.id} className="m-0 text-[15px] leading-normal">
                  <span className="font-semibold" style={{ color: m.kind === 'gained' ? 'var(--grace)' : 'var(--heresy-text)' }}>
                    {m.kind === 'gained' ? 'Gained' : 'Lost'}
                  </span>{' '}
                  {m.agent} {m.kind === 'gained' ? `from ${m.other}` : `to ${m.other}`}, tick {m.tick}.{' '}
                  {i === 0 && m.href ? <Link href={m.href}>Read the encounter</Link> : null}
                </p>
              ))}
            </section>
            <ReportButton targetType="faith" targetId={faith.id} label="Report this faith" signedIn={!!viewer} returnTo={`/f/${faith.slug}`} />
          </aside>
        </div>
      </main>
    </>
  );
}

function Notice({ tone, children }: { tone: 'heresy' | 'gold'; children: React.ReactNode }) {
  return (
    <p role="status" className="m-0 rounded-control border px-4 py-3 text-[15px]" style={tone === 'heresy' ? { borderColor: 'var(--heresy-edge)', background: 'var(--heresy-bg)', color: 'var(--heresy-text)' } : { borderColor: 'var(--gold)', background: 'var(--panel)', color: 'var(--gold-bright)' }}>
      {children}
    </p>
  );
}
