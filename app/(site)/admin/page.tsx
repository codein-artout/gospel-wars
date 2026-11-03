import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { AdminActionButton, ConfigEditor, ReplayForm, ReseedForm } from '@/components/admin/AdminControls';
import { GlassPane } from '@/components/glass/GlassPane';
import { AdvanceTickButton } from '@/components/nave/AdvanceTickButton';
import { PhoneTopBar } from '@/components/shell/PhoneTopBar';
import { PageHeader } from '@/components/ui/PageHeader';
import { getSessionUser } from '@/lib/auth/session';
import {
  adminDeleteRevision,
  adminResolveReport,
  adminReviewPost,
  adminSetBanned,
  adminSetFaithHidden,
  adminSetSilenced,
} from '@/lib/server/actions/admin';
import { loadAdmin } from '@/lib/server/queries/admin';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin', robots: { index: false } };

const REASON: Record<string, string> = { real_religion_or_person: 'Real religion or person', hateful: 'Hateful', sexual: 'Sexual', spam: 'Spam', other: 'Other' };

function Section({ id, title, children, note }: { id: string; title: string; note?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3.5 border-t border-hairline pt-6">
      <h2 id={id} className="m-0 font-display text-[32px] font-bold">
        {title}
      </h2>
      {note ? <p className="m-0 max-w-[70ch] text-[14px] text-muted">{note}</p> : null}
      {children}
    </section>
  );
}

type Props = { searchParams: Promise<{ q?: string }> };

export default async function AdminPage({ searchParams }: Props) {
  const user = await getSessionUser();
  if (!user) redirect('/signin?callbackUrl=/admin');
  if (!user.isAdmin) notFound();
  const { q } = await searchParams;
  const data = await loadAdmin(q);
  if (!data) {
    return (
      <main className="px-4 py-7 md:px-9">
        <PageHeader title="Admin" />
        <p>No world yet. Run pnpm db:seed.</p>
        <ReseedForm />
      </main>
    );
  }
  const { header } = data;
  return (
    <>
      <PhoneTopBar back={{ href: '/', label: 'The Nave' }} title="Admin" />
      <main className="flex flex-col gap-8 px-4 pb-14 pt-5 md:px-9 md:pt-7">
        <PageHeader
          meta={`Signed in as @${user.handle}. World at tick ${header.tick}, season ${header.season.number}.`}
          title="Admin"
          actions={
            <>
              <AdvanceTickButton />
              <AdvanceTickButton n={10} />
            </>
          }
        />

        <Section id="ticks-h" title="Ticks" note="The same runTick as the hourly cron and pnpm tick. A tick that already ran is a no-op.">
          <div className="overflow-x-auto rounded-panel border border-hairline" tabIndex={0} role="region" aria-label="Recent ticks">
            <table className="w-full min-w-[640px] border-collapse text-[14px]">
              <thead>
                <tr className="text-left text-[13px] text-faint">
                  {['Tick', 'Status', 'Encounters', 'Conversions', 'LLM calls', 'Fallbacks', 'Time'].map((h) => (
                    <th key={h} scope="col" className="px-3 py-2 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.runs.map((r) => (
                  <tr key={r.tick} className="tabular border-t border-hairline">
                    <td className="px-3 py-2">{r.tick}</td>
                    <td className="px-3 py-2" style={{ color: r.status === 'done' ? 'var(--grace)' : r.status === 'failed' ? 'var(--heresy-text)' : 'var(--gold)' }}>
                      {r.status}
                      {r.error ? `: ${r.error.slice(0, 80)}` : ''}
                    </td>
                    <td className="px-3 py-2">{r.encounters}</td>
                    <td className="px-3 py-2">{r.conversions}</td>
                    <td className="px-3 py-2">{r.llmCalls}</td>
                    <td className="px-3 py-2">{r.fallbacks}</td>
                    <td className="px-3 py-2">{r.ms}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section id="replay-h" title="Replay an encounter" note="Re-runs resolveEncounter from the stored inputs and scores with the config the tick used, and re-derives the seeded draws.">
          <ReplayForm recent={data.recent} />
        </Section>

        <Section id="reports-h" title="Reports" note={`Open reports, oldest first. A faith with ${header.config.reportHideThreshold} unique open reports is hidden automatically until resolved.`}>
          {data.reports.length === 0 ? <p className="m-0 text-muted">No open reports.</p> : null}
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {data.reports.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 rounded-panel border border-edge bg-panel p-4">
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="font-semibold">
                    {REASON[r.reason]} on a {r.targetType}
                    {r.faith ? (
                      <>
                        {' '}
                        of <Link href={`/f/${r.faith.slug}`}>{r.faith.name}</Link>
                        {r.faith.hidden ? ' (hidden)' : ''}
                      </>
                    ) : null}
                  </span>
                  <span className="text-[13px] text-faint">
                    By @{r.reporter}. Target {r.targetId}.
                  </span>
                  {r.note ? <span className="text-[14px] text-text-2">“{r.note}”</span> : null}
                </div>
                <div className="flex gap-2">
                  <AdminActionButton action={adminResolveReport.bind(null, r.id, 'uphold')} label="Uphold and hide" tone="secondary" />
                  <AdminActionButton action={adminResolveReport.bind(null, r.id, 'dismiss')} label="Dismiss" />
                </div>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="posts-h" title="Post queue" note={`Draft posts by agents and apostles. Approve sends one to the log provider; real posting is off in v1. ${Object.entries(data.postCounts).map(([k, v]) => `${v} ${k}`).join(', ')}.`}>
          {data.posts.length === 0 ? <p className="m-0 text-muted">No drafts waiting.</p> : null}
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {data.posts.map((p) => (
              <li key={p.id} className="flex flex-wrap items-start justify-between gap-3 rounded-panel border border-edge p-4">
                <div className="flex min-w-0 max-w-[70ch] flex-col gap-1">
                  <span className="text-[13px] text-faint">
                    {p.author}
                    {p.tick !== null ? `, tick ${p.tick}` : ''}
                    {p.event ? `. ${p.event}` : ''}
                  </span>
                  <span className="text-[15px] text-text-2">{p.text}</span>
                </div>
                <div className="flex gap-2">
                  <AdminActionButton action={adminReviewPost.bind(null, p.id, 'approve')} label="Approve" tone="secondary" />
                  <AdminActionButton action={adminReviewPost.bind(null, p.id, 'discard')} label="Discard" />
                </div>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="faiths-h" title="Faiths" note="Hide removes a faith from public pages (its apostle keeps preaching). Silence stops the apostle until the season ends. Deleting a revision falls back to the previous one.">
          <div className="overflow-x-auto rounded-panel border border-hairline" tabIndex={0} role="region" aria-label="Faith moderation">
            <table className="w-full min-w-[900px] border-collapse text-[14px]">
              <thead>
                <tr className="text-left text-[13px] text-faint">
                  {['Faith', 'Status', 'Strikes', 'Reports', 'Revisions', 'Actions'].map((h) => (
                    <th key={h} scope="col" className="px-3 py-2 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.faiths.map((f) => (
                  <tr key={f.id} className="border-t border-hairline align-top">
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center gap-2">
                        <GlassPane color={f.color} width={12} height={18} leadWidth={2} lead={f.founderType === 'agent' ? 'agent' : 'solid'} />
                        <Link href={`/f/${f.slug}`} className="text-text">
                          {f.name}
                        </Link>
                      </span>
                      <div className="text-[13px] text-faint">{f.prophet ? `@${f.prophet}` : 'Agent-founded'}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      {f.status}
                      {f.hidden ? ', hidden' : ''}
                      {f.silenced ? ', silenced' : ''}
                    </td>
                    <td className="tabular px-3 py-2.5">{f.strikes}</td>
                    <td className="tabular px-3 py-2.5">{f.openReports}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-col items-start gap-1">
                        {f.revisions.map((r, i) => (
                          <span key={r.id} className="inline-flex items-center gap-2 text-[13px]">
                            Revision {r.number}, tick {r.createdAtTick}
                            {f.revisions.length > 1 ? <AdminActionButton action={adminDeleteRevision.bind(null, r.id)} label="Delete" confirm={`Delete revision ${r.number} of ${f.name}?${i === 0 ? ' The faith falls back to the previous revision.' : ''}`} /> : null}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-2">
                        <AdminActionButton action={adminSetFaithHidden.bind(null, f.id, !f.hidden)} label={f.hidden ? 'Unhide' : 'Hide'} />
                        <AdminActionButton action={adminSetSilenced.bind(null, f.id, !f.silenced)} label={f.silenced ? 'Unsilence' : 'Silence'} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section id="users-h" title="Users" note="Banned users cannot sign in, publish, follow or report.">
          <form className="flex flex-wrap gap-3" role="search">
            <label htmlFor="q" className="sr-only">
              Search users
            </label>
            <input id="q" name="q" defaultValue={q ?? ''} placeholder="Handle or email" className="min-h-11 min-w-[260px] rounded-control border px-3" style={{ borderColor: 'var(--edge-strong)', background: 'var(--nave-well)', color: 'var(--text)' }} />
            <button type="submit" className="btn btn-quiet">
              Search
            </button>
          </form>
          <ul className="m-0 flex list-none flex-col p-0">
            {data.users.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline py-2.5">
                <span>
                  <span className="font-semibold">@{u.handle}</span> <span className="text-[13px] text-faint">{u.email}</span>
                  {u.banned ? <span className="text-[13px] text-heresy-text"> Banned</span> : null}
                </span>
                {u.id !== user.id ? <AdminActionButton action={adminSetBanned.bind(null, u.id, !u.banned)} label={u.banned ? 'Unban' : 'Ban'} confirm={u.banned ? undefined : `Ban @${u.handle}?`} /> : <span className="text-[13px] text-faint">You</span>}
              </li>
            ))}
          </ul>
        </Section>

        <Section id="config-h" title="Config overrides">
          <ConfigEditor initial={data.overrides} />
        </Section>

        <Section id="reseed-h" title="Reseed world" note="Destroys every faith, agent, encounter and account, then rebuilds the demo world.">
          <ReseedForm />
        </Section>

        <Section id="log-h" title="Admin log">
          <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[14px]">
            {data.actions.map((a) => (
              <li key={a.id} className="text-text-2">
                <span className="tabular text-faint">{a.at.slice(0, 16).replace('T', ' ')}</span> @{a.admin} {a.action.replace(/_/g, ' ')} {a.targetType} <span className="font-mono text-[12px] text-faint">{a.targetId}</span>
              </li>
            ))}
          </ul>
        </Section>
      </main>
    </>
  );
}
