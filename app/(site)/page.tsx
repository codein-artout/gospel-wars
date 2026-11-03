import type { Metadata } from 'next';
import Link from 'next/link';
import { AdvanceTickButton } from '@/components/nave/AdvanceTickButton';
import { NaveLive } from '@/components/nave/NaveLive';
import { TickPoller } from '@/components/nave/TickPoller';
import { PhoneTopBar } from '@/components/shell/PhoneTopBar';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/States';
import { ChronicleList } from '@/components/world/ChronicleList';
import { getSessionUser } from '@/lib/auth/session';
import { seasonMeta } from '@/lib/server/queries/common';
import { loadNave } from '@/lib/server/queries/nave';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: { absolute: 'The Nave | Gospel Wars' } };

export default async function NavePage() {
  const [data, user] = await Promise.all([loadNave(), getSessionUser()]);
  if (!data) {
    return (
      <>
        <PhoneTopBar />
        <main className="flex flex-col gap-7 px-4 pb-12 pt-5 md:px-9 md:pt-7">
          <PageHeader title="The Nave" />
          <EmptyState title="The nave is empty." body="No world has been seeded yet. Run pnpm db:migrate and pnpm db:seed, then reload." />
        </main>
      </>
    );
  }
  const { header } = data;
  const isAdmin = user?.isAdmin ?? false;
  const caption = data.anyBossConverted
    ? 'Each pane is an agent, colored by its faith. The outer band is flock share. Gold-leaded panes are boss skeptics; pewter ones nobody has converted yet.'
    : 'Each pane is an agent, colored by its faith. The outer band is flock share. Gold-leaded panes are boss skeptics nobody has converted yet.';
  const defaultSelected = data.panes.find((p) => !p.isBoss)?.id ?? null;
  return (
    <>
      <PhoneTopBar action={isAdmin ? <AdvanceTickButton variant="icon" /> : undefined} />
      <TickPoller tick={header.tick} />
      <main className="flex flex-col gap-7 px-4 pb-12 pt-[18px] md:px-9 md:pb-12 md:pt-7">
        <div className="max-md:hidden">
          <PageHeader
            meta={seasonMeta(header)}
            title="The Nave"
            actions={
              <>
                {isAdmin ? <AdvanceTickButton /> : null}
                <Link href="/write" className="btn btn-primary">
                  Write a gospel
                </Link>
              </>
            }
          />
        </div>
        <div className="flex flex-col gap-1 md:hidden">
          <span className="text-[13px] text-faint">
            Season {header.season.number}, tick {header.season.seasonTick} of {header.config.seasonLengthTicks}
          </span>
          <h1 className="m-0 font-display text-[44px] font-bold leading-none">The Nave</h1>
        </div>
        <NaveLive tick={header.tick} panes={data.panes} agents={data.agents} shares={data.shares} caption={caption} defaultSelectedId={defaultSelected} />
        <section aria-labelledby="chron-h" className="flex flex-col gap-3.5 max-md:gap-0">
          <div className="flex flex-wrap items-baseline justify-between gap-3 max-md:mb-2">
            <h2 id="chron-h" className="m-0 font-display text-[28px] font-bold md:text-[34px]">
              Chronicle
            </h2>
            {data.latestEncounterId ? (
              <Link href={`/e/${data.latestEncounterId}`} className="text-[15px] font-semibold max-md:hidden">
                See the latest encounter
              </Link>
            ) : null}
          </div>
          <ChronicleList rows={data.chronicle} />
        </section>
      </main>
    </>
  );
}
