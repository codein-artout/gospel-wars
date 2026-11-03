export function TokenMeter({ tokens, max, htmlFor }: { tokens: number; max: number; htmlFor: string }) {
  const pct = Math.min(100, (tokens / max) * 100);
  const over = tokens > max;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={htmlFor} className="text-[14px] text-muted">
          gospel.md
        </label>
        <span className="tabular text-[14px]" style={{ color: over ? 'var(--heresy-text)' : undefined }}>
          {tokens.toLocaleString('en-US')} of {max.toLocaleString('en-US')} tokens
        </span>
      </div>
      <div aria-hidden="true" className="h-1.5 rounded-[2px] bg-nave-well">
        <div className="h-1.5 rounded-[2px]" style={{ width: `${pct}%`, background: over ? 'var(--heresy)' : 'var(--gold)' }} />
      </div>
    </div>
  );
}
