type Props = { name: string; skepticism: number; resisted: number; title: string; convertedBy?: string | null };

/** A boss skeptic in a double gold border. */
export function BossCard({ name, skepticism, resisted, title, convertedBy }: Props) {
  return (
    <article className="flex flex-col gap-2 rounded-panel p-[18px]" style={{ border: '3px double var(--gold)' }}>
      <h3 className="m-0 font-display text-[28px] font-bold leading-tight">{name}</h3>
      <span className="text-[14px] text-muted">
        Skepticism {skepticism}. Resisted {resisted} {resisted === 1 ? 'sermon' : 'sermons'}.
      </span>
      {convertedBy ? (
        <span className="text-[14px] text-gold-bright">
          Converted by {convertedBy}. Title held: {title}
        </span>
      ) : (
        <span className="text-[14px]">Title on offer: {title}</span>
      )}
    </article>
  );
}
