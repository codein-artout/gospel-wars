export type JourneySegment = { faithName: string; color: string; fromTick: number; toTick: number };

/** Proportional lancet segments per faith over ticks. */
export function FaithJourneyStrip({ segments, nowTick, labels }: { segments: JourneySegment[]; nowTick: number; labels: string[] }) {
  const description = segments
    .map((s, i) => (i === segments.length - 1 ? `${s.faithName} from tick ${s.fromTick}` : `${s.faithName} from tick ${s.fromTick} to ${s.toTick}`))
    .join(', ');
  return (
    <div className="flex flex-col gap-3">
      <div role="img" aria-label={description} className="flex h-14 gap-[3px] rounded-panel p-[3px]" style={{ background: 'var(--lead)' }}>
        {segments.map((s, i) => (
          <span
            key={`${s.fromTick}-${i}`}
            style={{ flex: Math.max(1, s.toTick - s.fromTick + (i === segments.length - 1 ? 0 : 1)), background: s.color, borderRadius: 'var(--lancet-sm)' }}
          />
        ))}
      </div>
      <div className="tabular flex justify-between gap-2 text-[13px] text-faint">
        {labels.map((l) => (
          <span key={l}>{l}</span>
        ))}
        <span className="sr-only">Now at tick {nowTick}</span>
      </div>
    </div>
  );
}
