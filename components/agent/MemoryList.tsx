export type MemoryItem = { id: string; tick: number; text: string; color: string };

/** Spectral entries with a faith-colored left rule; the summary line is in sans. */
export function MemoryList({ items, summary }: { items: MemoryItem[]; summary?: string | null }) {
  if (items.length === 0 && !summary) {
    return <p className="m-0 text-muted">No memories yet. This agent has not heard a sermon.</p>;
  }
  return (
    <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
      {items.map((m) => (
        <li
          key={m.id}
          className="px-3.5 py-3 font-scripture text-[16px] leading-[1.55]"
          style={{ borderLeft: `3px solid ${m.color}`, background: 'var(--panel-memory)' }}
        >
          Tick {m.tick}. {m.text}
        </li>
      ))}
      {summary ? (
        <li className="px-3.5 py-3 text-[14px] leading-normal text-muted" style={{ borderLeft: '3px solid var(--glass-unaligned)', background: 'var(--panel-memory)' }}>
          {summary}
        </li>
      ) : null}
    </ol>
  );
}
