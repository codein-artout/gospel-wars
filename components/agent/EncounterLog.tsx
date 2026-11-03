import Link from 'next/link';

export type EncounterLogRow = { id: string; tick: number; who: string; outcome: string; tone: 'gold' | 'muted' | 'heresy' | 'grace' };

const TONE = { gold: 'var(--gold-bright)', muted: 'var(--muted)', heresy: 'var(--heresy-kind)', grace: 'var(--grace)' } as const;

export function EncounterLog({ rows }: { rows: EncounterLogRow[] }) {
  if (rows.length === 0) return <p className="m-0 border-t border-hairline py-3 text-muted">No encounters yet.</p>;
  return (
    <ul className="m-0 list-none border-t border-hairline p-0">
      {rows.map((r) => (
        <li key={r.id} className="grid grid-cols-[70px_minmax(0,1fr)_auto] gap-2.5 border-b border-hairline px-0.5 py-[11px] text-[15px]">
          <span className="tabular text-faint">Tick {r.tick}</span>
          <Link href={`/e/${r.id}`} className="truncate text-text">
            {r.who}
          </Link>
          <span style={{ color: TONE[r.tone], fontWeight: r.tone === 'gold' ? 600 : undefined }}>{r.outcome}</span>
        </li>
      ))}
    </ul>
  );
}
