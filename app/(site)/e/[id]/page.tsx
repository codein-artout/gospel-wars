import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CopyLinkButton } from '@/components/encounter/CopyLinkButton';
import { ExchangeList } from '@/components/encounter/ExchangeList';
import { HeresyCheckNote } from '@/components/encounter/HeresyCheckNote';
import { OutcomeBanner } from '@/components/encounter/OutcomeBanner';
import { RollLedger } from '@/components/encounter/RollLedger';
import { RubricTable } from '@/components/encounter/RubricTable';
import { ReportButton } from '@/components/faith/ReportButton';
import { GlassPane } from '@/components/glass/GlassPane';
import { PhoneTopBar } from '@/components/shell/PhoneTopBar';
import { getSessionUser } from '@/lib/auth/session';
import { RUBRIC_KEYS } from '@/lib/game/config';
import { loadEncounter, loadEvent, RUBRIC_LABEL, type EncounterView } from '@/lib/server/queries/encounter';
import { ledgerItems } from '@/lib/ui/ledger';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

/** /e/[id] is an encounter, or a chronicle event's share page (schism cards have no encounter). */
async function resolve(id: string): Promise<{ encounter: EncounterView; cardEventId: string | null } | { event: NonNullable<Awaited<ReturnType<typeof loadEvent>>> } | null> {
  const encounter = await loadEncounter(id);
  if (encounter) return { encounter, cardEventId: encounter.card?.eventId ?? null };
  const event = await loadEvent(id);
  if (!event) return null;
  if (event.encounterId) {
    const enc = await loadEncounter(event.encounterId);
    if (enc) return { encounter: enc, cardEventId: event.card ? event.id : null };
  }
  return { event };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const r = await resolve(id);
  if (!r) return { title: 'Not found' };
  if ('event' in r) {
    const title = r.event.card?.headline ?? r.event.text;
    const description = r.event.text;
    const images = r.event.card ? [{ url: `/api/card/${r.event.id}`, width: 1200, height: 630, alt: title }] : undefined;
    return { title, description, openGraph: { title, description, images, type: 'article' }, twitter: { card: images ? 'summary_large_image' : 'summary', title, description, images: images?.map((i) => i.url) } };
  }
  const e = r.encounter;
  const title = headline(e);
  const description = `${e.preacher.name} preached ${e.preacher.faith.name} to ${e.target.name}. Tick ${e.tick}. Seed ${e.seedLabel}.`;
  const images = r.cardEventId ? [{ url: `/api/card/${r.cardEventId}`, width: 1200, height: 630, alt: title }] : undefined;
  return { title, description, openGraph: { title, description, images, type: 'article' }, twitter: { card: images ? 'summary_large_image' : 'summary', title, description, images: images?.map((i) => i.url) } };
}

function headline(e: EncounterView): string {
  const to = `the ${e.preacher.faith.shortName}`;
  const own = e.target.faithShort ? `the ${e.target.faithShort}` : 'no faith';
  switch (e.outcome) {
    case 'converted':
      return e.target.isBoss ? `${e.target.name} believes.` : `${e.target.name} converted to ${to}.`;
    case 'boss_held':
      return `${e.target.name} heard ${to} and remained unmoved.`;
    case 'heresy':
      return 'Heresy. The sermon was voided.';
    case 'backlash':
      return `The sermon backfired. ${e.target.name} held tighter to ${own}.`;
    case 'doubted':
      return e.target.faithShort ? `${e.target.name} doubted, but stayed with ${own}.` : `${e.target.name} doubted, but stayed unaligned.`;
    default:
      return `${e.target.name} heard ${to} and held firm.`;
  }
}

export default async function EncounterPage({ params }: Props) {
  const { id } = await params;
  const [r, viewer] = await Promise.all([resolve(id), getSessionUser()]);
  if (!r) notFound();
  if ('event' in r) return <EventShare event={r.event} />;
  const e = r.encounter;
  const tone = e.outcome === 'converted' ? 'gold' : e.outcome === 'heresy' ? 'heresy' : 'quiet';
  const S = e.roll.S;
  const lines = RUBRIC_KEYS.map((k) => ({ key: k, label: RUBRIC_LABEL[k], weight: e.config.rubricWeights[k], score: e.scores[k] }));
  const ownFaith = e.target.faithShort ? `the ${e.target.faithShort.split(' ').slice(-1)[0]}` : 'no faith';
  const preacherFaith = `the ${e.preacher.faith.shortName.split(' ').slice(-1)[0]}`;
  const items = ledgerItems({ roll: e.roll, input: e.input, config: e.config, ownFaith, preacherFaith, isBoss: e.target.isBoss, converted: e.converted, newConviction: e.newConviction });
  const preacherLabel = e.preacher.kind === 'agent' ? `A convert of the ${e.preacher.faith.shortName}` : `${e.preacher.style} apostle of the ${e.preacher.faith.shortName}`;
  const targetLabel = e.target.isBoss
    ? `Boss skeptic, skepticism ${e.target.skepticism}`
    : `${e.target.faithShort ?? 'Unaligned'}, conviction ${e.target.conviction}, skepticism ${e.target.skepticism}`;
  const lead = e.preacher.faith.founderType === 'agent' ? 'agent' : 'solid';
  const sharePath = `/e/${r.cardEventId ?? e.id}`;
  const cardButton = r.cardEventId ? (
    <a href={`/api/card/${r.cardEventId}`} target="_blank" rel="noreferrer" className="btn btn-primary no-underline">
      {e.outcome === 'converted' ? 'Make conversion card' : 'Make card'}
    </a>
  ) : null;

  return (
    <>
      <PhoneTopBar back={{ href: '/encounters', label: 'Encounters' }} title={`Tick ${e.tick}, encounter ${e.index}`} />
      <main className="flex flex-col gap-7 px-4 pb-14 pt-5 md:px-9 md:pt-7">
        <header className="flex flex-col gap-[18px]">
          <span className="text-[14px] text-faint max-md:hidden">
            Tick {e.tick}, encounter {e.index} of {e.ofCount}. Seed {e.seedLabel}.{e.fallback ? ' Some text came from the fallback writer.' : ''}
          </span>
          <div className="flex flex-wrap items-center gap-x-7 gap-y-3 max-md:flex-col max-md:items-start">
            <div className="flex items-center gap-3.5">
              <GlassPane color={e.preacher.faith.color} width={34} height={54} lead={lead} className="max-md:!h-[38px] max-md:!w-6" />
              <div className="flex flex-col gap-0.5">
                {e.preacher.slug ? (
                  <Link href={`/a/${e.preacher.slug}`} className="font-display text-[26px] font-bold leading-none text-text no-underline md:text-[36px]">
                    {e.preacher.name}
                  </Link>
                ) : (
                  <span className="font-display text-[26px] font-bold leading-none md:text-[36px]">{e.preacher.name}</span>
                )}
                <span className="text-[13px] text-muted md:text-[14px]">{preacherLabel}</span>
              </div>
            </div>
            <span className="font-display text-[28px] text-faint max-md:hidden">preached to</span>
            <div className="flex items-center gap-3.5">
              <GlassPane color={e.target.isBoss && !e.target.faithShort ? 'linear-gradient(160deg, var(--boss-a), var(--boss-b))' : e.target.color} width={34} height={54} lead={e.target.isBoss ? 'boss' : 'solid'} className="max-md:!h-[38px] max-md:!w-6" />
              <div className="flex flex-col gap-0.5">
                <Link href={`/a/${e.target.slug}`} className="font-display text-[26px] font-bold leading-none text-text no-underline md:text-[36px]">
                  {e.target.name}
                </Link>
                <span className="text-[13px] text-muted md:text-[14px]">{targetLabel}</span>
              </div>
            </div>
          </div>
          <OutcomeBanner headline={headline(e)} tone={tone}>
            {cardButton}
            <CopyLinkButton path={sharePath} className="max-md:hidden" />
          </OutcomeBanner>
        </header>

        <div className="flex flex-wrap items-start gap-8">
          <section aria-labelledby="tx-h" className="flex min-w-0 flex-[3_1_500px] flex-col gap-4">
            <h2 id="tx-h" className="m-0 font-display text-[28px] font-bold md:text-[32px]">
              The exchange
            </h2>
            <ExchangeList turns={e.turns} color={e.preacher.faith.color} />
            <div className="max-md:hidden">
              <HeresyCheckNote flagged={!!e.heresy} kind={e.heresy?.kind} quote={e.heresy?.quote} />
            </div>
          </section>

          <aside className="flex min-w-0 flex-[2_1_380px] flex-col gap-6">
            <div className="max-md:hidden">
              <RubricTable lines={lines} score={S} heresy={!!e.heresy} />
            </div>
            {e.rationale ? <p className="m-0 text-[14px] italic text-muted max-md:hidden">The judge&apos;s note: {e.rationale}</p> : null}
            <div className="max-md:hidden">
              <RollLedger items={items} footnote="Same seed, same inputs, same result. Replay it from the admin panel." />
            </div>
            {/* Phone: one compact panel, every rubric line behind a disclosure. */}
            <section aria-labelledby="rr-h" className="flex flex-col gap-2.5 rounded-panel border border-edge bg-panel p-4 md:hidden">
              <h2 id="rr-h" className="m-0 font-display text-[28px] font-bold">
                Rubric and roll
              </h2>
              <dl className="tabular m-0 grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1.5 text-[14px]">
                {items.slice(0, 6).map((it) => (
                  <div key={it.label} className="contents">
                    <dt className="text-muted">{it.label.replace(/, .*$/, '')}</dt>
                    <dd className="m-0 text-right" style={{ fontWeight: it.strong ? 700 : undefined }}>
                      {it.value}
                    </dd>
                  </div>
                ))}
              </dl>
              <details>
                <summary className="cursor-pointer font-semibold text-gold underline">See every rubric line</summary>
                <div className="mt-3 flex flex-col gap-3">
                  <RubricTable lines={lines} score={S} heresy={!!e.heresy} />
                  <RollLedger items={items} />
                </div>
              </details>
            </section>
            <div className="md:hidden">
              <HeresyCheckNote flagged={!!e.heresy} kind={e.heresy?.kind} quote={e.heresy?.quote} short />
            </div>
            {e.post ? (
              <section aria-labelledby="post-h" className="flex flex-col gap-2.5">
                <h2 id="post-h" className="m-0 font-display text-[28px] font-bold md:text-[30px]">
                  {e.post.author}&apos;s draft post
                </h2>
                <blockquote className="m-0 rounded-panel border border-edge p-4 text-[15px] leading-[1.55] text-text-2">{e.post.text}</blockquote>
                <span className="text-[13px] text-faint">{e.post.status === 'posted' ? 'Approved and logged. Real posting is off in v1.' : 'Queued, not posted. Posting is off in v1.'}</span>
              </section>
            ) : null}
            <ReportButton targetType="encounter" targetId={e.id} label="Report this encounter" signedIn={!!viewer} returnTo={`/e/${e.id}`} />
          </aside>
        </div>
      </main>
    </>
  );
}

function EventShare({ event }: { event: NonNullable<Awaited<ReturnType<typeof loadEvent>>> }) {
  return (
    <>
      <PhoneTopBar back={{ href: '/', label: 'The Nave' }} title={`Tick ${event.tick}`} />
      <main className="flex flex-col gap-7 px-4 pb-14 pt-5 md:px-9 md:pt-7">
        <span className="text-[14px] text-faint">Tick {event.tick}. {event.card?.kicker ?? ''}</span>
        <OutcomeBanner headline={event.card?.headline ?? event.text} tone="gold">
          {event.card ? (
            <a href={`/api/card/${event.id}`} target="_blank" rel="noreferrer" className="btn btn-primary no-underline">
              Make card
            </a>
          ) : null}
          <CopyLinkButton path={`/e/${event.id}`} />
        </OutcomeBanner>
        <p className="m-0 max-w-[64ch] text-[17px] text-text-2">{event.text}</p>
        {event.card?.quote ? <p className="m-0 max-w-[60ch] font-scripture text-[20px] italic">{event.card.quote}</p> : null}
        <div className="flex flex-wrap gap-6">
          {[event.faith, event.other].filter((f): f is NonNullable<typeof f> => !!f).map((f) => (
            <Link key={f.slug} href={`/f/${f.slug}`} className="inline-flex items-center gap-2 text-text">
              <GlassPane color={f.color} width={12} height={18} leadWidth={2} />
              {f.name}
            </Link>
          ))}
        </div>
        {event.card ? (
          // eslint-disable-next-line @next/next/no-img-element -- the OG card is a dynamic route image
          <img src={`/api/card/${event.id}`} alt={event.card.headline} width={1200} height={630} className="h-auto w-full max-w-[720px] rounded-panel border border-edge" />
        ) : null}
      </main>
    </>
  );
}
