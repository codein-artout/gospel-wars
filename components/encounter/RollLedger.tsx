export type LedgerItem = { label: string; value: string; strong?: boolean; accent?: 'gold' | 'heresy' | 'grace' };

const ACCENT = { gold: 'var(--gold-bright)', heresy: 'var(--heresy-text)', grace: 'var(--grace)' } as const;

/** The deterministic math of an encounter, as a definition list. */
export function RollLedger({ items, footnote, title = 'The roll' }: { items: LedgerItem[]; footnote?: string; title?: string }) {
  return (
    <section aria-labelledby="roll-h" className="flex flex-col gap-2.5 rounded-panel border border-edge p-5">
      <h2 id="roll-h" className="m-0 font-display text-[30px] font-bold leading-tight">
        {title}
      </h2>
      <dl className="tabular m-0 grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 text-[15px]">
        {items.map((it) => (
          <div key={it.label} className="contents">
            <dt className="text-muted">{it.label}</dt>
            <dd
              className="m-0 text-right"
              style={{ fontWeight: it.strong || it.accent ? 700 : undefined, color: it.accent ? ACCENT[it.accent] : undefined }}
            >
              {it.value}
            </dd>
          </div>
        ))}
      </dl>
      {footnote ? <p className="m-0 mt-1 text-[13px] text-faint">{footnote}</p> : null}
    </section>
  );
}
