type Props = {
  label: string;
  value: number;
  max?: number;
  /** CSS color for the fill. Default gold. */
  fill?: string;
  height?: number;
  note?: string;
  labelClassName?: string;
};

/** A labelled value bar. */
export function Meter({ label, value, max = 100, fill = 'var(--gold)', height = 8, note, labelClassName }: Props) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="flex flex-col gap-1">
      <div className={`flex justify-between ${labelClassName ?? 'text-[13px]'}`}>
        <span className="text-muted">{label}</span>
        <span className="tabular">{value}</span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        className="rounded-[2px] bg-nave-well"
        style={{ height }}
      >
        <div className="rounded-[2px]" style={{ height, width: `${pct}%`, background: fill }} />
      </div>
      {note ? <span className="text-[13px] text-faint">{note}</span> : null}
    </div>
  );
}

/** Temperament trait meter (Agent profile). */
export function TraitMeter({ label, value, note }: { label: string; value: number; note: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="flex flex-col gap-[5px]">
      <div className="flex justify-between text-[14px]">
        <span>{label}</span>
        <span className="tabular text-muted">{value}</span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        className="h-2 rounded-[2px] bg-nave-well"
      >
        <div className="h-2 rounded-[2px]" style={{ width: `${pct}%`, background: 'var(--trait)' }} />
      </div>
      <span className="text-[13px] text-faint">{note}</span>
    </div>
  );
}
