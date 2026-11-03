import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ScripturePanel } from '@/components/scripture/ScripturePanel';
import { PhoneTopBar } from '@/components/shell/PhoneTopBar';
import { PageHeader } from '@/components/ui/PageHeader';
import { getSessionUser } from '@/lib/auth/session';
import { lineDiff } from '@/lib/game/diff';
import { formatCount } from '@/lib/game/tokens';
import { loadRevisions } from '@/lib/server/queries/faith';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Revision history' };

type Props = { params: Promise<{ slug: string }> };

export default async function RevisionsPage({ params }: Props) {
  const { slug } = await params;
  const [faith, viewer] = await Promise.all([loadRevisions(slug), getSessionUser()]);
  if (!faith || (faith.hidden && !viewer?.isAdmin)) notFound();
  const revs = faith.revisions;
  return (
    <>
      <PhoneTopBar back={{ href: `/f/${faith.slug}`, label: faith.name }} title="Revisions" />
      <main className="flex flex-col gap-8 px-4 pb-12 pt-5 md:px-9 md:pt-7">
        <PageHeader meta={<Link href={`/f/${faith.slug}`}>{faith.name}</Link>} title="Revision history" />
        <p className="m-0 max-w-[64ch] text-muted">Every edit is a new revision. Sermons record which revision they preached. An edit takes effect at the start of the next tick.</p>
        <ol className="m-0 flex list-none flex-col gap-8 p-0">
          {revs.map((r, i) => {
            const prev = revs[i + 1];
            const ops = prev ? lineDiff(prev.body, r.body).filter((o) => o.op !== 'same' && o.text.trim()) : [];
            return (
              <li key={r.id} className="flex flex-col gap-3">
                <h2 className="m-0 font-display text-[30px] font-bold">Revision {r.number}</h2>
                <p className="m-0 text-[14px] text-faint">
                  Written at tick {r.createdAtTick}, preached from tick {r.effectiveTick}. {formatCount(r.tokens)} tokens.
                </p>
                {prev ? (
                  ops.length ? (
                    <div className="flex flex-col gap-1 rounded-panel border border-edge bg-panel p-4 font-mono text-[14px]" aria-label={`Changes from revision ${prev.number}`}>
                      {ops.map((o, k) => (
                        <div key={k} style={{ color: o.op === 'add' ? 'var(--grace)' : 'var(--heresy-text)' }}>
                          <span className="sr-only">{o.op === 'add' ? 'Added: ' : 'Removed: '}</span>
                          <span aria-hidden="true">{o.op === 'add' ? '+ ' : '− '}</span>
                          {o.text}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="m-0 text-muted">No line changes from revision {prev.number}.</p>
                  )
                ) : (
                  <details>
                    <summary className="cursor-pointer text-gold">Show the first revision</summary>
                    <div className="mt-4">
                      <ScripturePanel markdown={r.body} headingId={`rev-${r.number}`} meta={`gospel.md, revision ${r.number}`} />
                    </div>
                  </details>
                )}
              </li>
            );
          })}
        </ol>
      </main>
    </>
  );
}
