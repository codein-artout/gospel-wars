import Link from 'next/link';
import { GlassPane, type GlassLead } from '../glass/GlassPane';
import { formatPct } from '../meters/ShareBar';

export type StandingRow = {
  key: string;
  rank: number | null;
  name: string;
  slug: string | null;
  color: string;
  lead?: GlassLead;
  lineage: string;
  prophet: string;
  style: string;
  share: number;
  delta: number | null;
  heresies: number | null;
  silenced?: boolean;
};

function signed(n: number): string {
  if (n > 0) return `+${n}`;
  if (n < 0) return `−${Math.abs(n)}`;
  return '0';
}

/** Season standings. Scrolls horizontally inside its own box on narrow widths. */
export function StandingsTable({ rows, caption = 'Standings' }: { rows: StandingRow[]; caption?: string }) {
  return (
    <div className="overflow-x-auto rounded-panel border border-hairline" tabIndex={0} role="region" aria-label={caption}>
      <table className="w-full min-w-[860px] border-collapse text-[15px]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="text-left text-[13px] text-faint">
            <th scope="col" className="px-4 py-3 font-medium">Rank</th>
            <th scope="col" className="px-4 py-3 font-medium">Faith</th>
            <th scope="col" className="px-4 py-3 font-medium">Prophet</th>
            <th scope="col" className="px-4 py-3 font-medium">Apostle</th>
            <th scope="col" className="w-[26%] px-4 py-3 font-medium">Flock share</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Season</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Heresies</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-hairline">
              <td className="tabular px-4 py-3.5 text-muted">{r.rank ?? ''}</td>
              <td className="px-4 py-3.5">
                <div className="flex items-center gap-2.5">
                  <GlassPane color={r.color} width={12} height={18} leadWidth={2} lead={r.lead} />
                  <div className="flex flex-col gap-0.5">
                    {r.slug ? (
                      <Link href={`/f/${r.slug}`} className="font-semibold text-text no-underline hover:underline">
                        {r.name}
                      </Link>
                    ) : (
                      <span className="font-semibold">{r.name}</span>
                    )}
                    <span className="text-[13px] text-faint">
                      {r.lineage}
                      {r.silenced ? '. Apostle silenced' : ''}
                    </span>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3.5">{r.prophet}</td>
              <td className="px-4 py-3.5 text-text-2">{r.style}</td>
              <td className="px-4 py-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="h-2 flex-1 rounded-[2px] bg-nave-well" aria-hidden="true">
                    <div className="h-2 rounded-[2px]" style={{ width: formatPct(r.share), background: r.color }} />
                  </div>
                  <span className="tabular w-12 text-right">{formatPct(r.share)}</span>
                </div>
              </td>
              <td
                className="tabular px-4 py-3.5 text-right"
                style={{ color: r.delta === null ? undefined : r.delta >= 0 ? 'var(--grace)' : 'var(--heresy-text)' }}
              >
                {r.delta === null ? '' : signed(r.delta)}
              </td>
              <td className="tabular px-4 py-3.5 text-right">{r.heresies ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
