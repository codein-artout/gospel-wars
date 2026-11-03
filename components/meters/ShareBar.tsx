import { GlassPane, type GlassLead } from '../glass/GlassPane';

type Props = {
  name: string;
  color: string;
  count: number;
  /** Fraction 0..1 */
  share: number;
  lead?: GlassLead;
  compact?: boolean;
};

export function formatPct(share: number): string {
  return `${(share * 100).toFixed(1)}%`;
}

/** Flock share row: faith mark, name, members and percentage, plus a thin bar. */
export function ShareBar({ name, color, count, share, lead, compact }: Props) {
  const pct = formatPct(share);
  if (compact) {
    return (
      <div className="grid grid-cols-[12px_minmax(0,1fr)_52px] items-center gap-2.5 text-[14px]">
        <GlassPane color={color} width={10} height={16} leadWidth={2} lead={lead} />
        <span className="truncate">{name}</span>
        <span className="tabular text-right">{pct}</span>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-[5px]">
      <div className="flex justify-between gap-3 text-[14px]">
        <span className="flex min-w-0 items-center gap-2">
          <GlassPane color={color} width={10} height={16} leadWidth={2} lead={lead} />
          <span className="truncate">{name}</span>
        </span>
        <span className="tabular shrink-0 text-text-2">
          {count} {count === 1 ? 'agent' : 'agents'}, {pct}
        </span>
      </div>
      <div className="h-1.5 rounded-[2px] bg-nave-well" aria-hidden="true">
        <div className="h-1.5 rounded-[2px]" style={{ width: pct, background: color }} />
      </div>
    </div>
  );
}
