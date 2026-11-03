import { GlassPane } from '../glass/GlassPane';

type Props = {
  name: string;
  color: string;
  value: number;
  /** Conversion threshold (config.conversionThreshold); drawn as a dashed gold marker. */
  threshold: number;
};

/** A faith's pull on an agent, with the conversion threshold marked. */
export function LeaningBar({ name, color, value, threshold }: Props) {
  const pct = Math.max(0, Math.min(100, value));
  const t = Math.max(0, Math.min(100, threshold));
  return (
    <div className="grid grid-cols-[14px_minmax(0,1fr)_36px] items-center gap-2.5 text-[14px]">
      <GlassPane color={color} width={10} height={16} leadWidth={2} />
      <div
        className="relative h-[18px] rounded-[2px] bg-nave-well"
        role="meter"
        aria-label={`Leaning toward ${name}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
      >
        <div
          data-testid="leaning-fill"
          className="h-[18px] rounded-[2px]"
          style={{ width: `${pct}%`, background: color, opacity: 0.85 }}
        />
        <span
          data-testid="leaning-threshold"
          aria-hidden="true"
          className="absolute -bottom-[3px] -top-[3px] border-l-2 border-dashed border-gold"
          style={{ left: `${t}%` }}
        />
        <span className="absolute left-2 top-0 text-[12px] leading-[18px] text-text">{name}</span>
      </div>
      <span className="tabular text-right">{value}</span>
    </div>
  );
}
