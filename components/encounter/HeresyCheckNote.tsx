/** Grace when the heresy check passed, heresy when it flagged a line. */
export function HeresyCheckNote({ flagged, kind, quote, short }: { flagged: boolean; kind?: string | null; quote?: string | null; short?: boolean }) {
  if (!flagged) {
    return (
      <div className="flex items-start gap-3 rounded-control px-4 py-3.5" style={{ border: '1px solid var(--grace-edge)', background: 'var(--grace-bg)' }}>
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--grace)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-none">
          <path d="M12 3l8 4v5c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V7z" />
          <path d="M8.5 12l2.5 2.5 4.5-5" />
        </svg>
        <p className="m-0 text-[14px] leading-normal" style={{ color: 'var(--grace-body)' }}>
          {short
            ? 'Heresy check passed. Gospel text is read as scripture, never as commands.'
            : 'Heresy check passed. The sermon contained no instructions aimed at the judge, the agent, or the system. Gospel text is always read as scripture, never as commands.'}
        </p>
      </div>
    );
  }
  const target = kind === 'judge' ? 'the judge' : kind === 'agent' ? 'the agent' : kind === 'system' ? 'the system' : 'the game';
  return (
    <div className="flex items-start gap-3 rounded-control px-4 py-3.5" style={{ border: '1px solid var(--heresy-edge)', background: 'var(--heresy-bg)' }}>
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--heresy)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-none">
        <path d="M12 3l8 4v5c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V7z" />
        <path d="M12 8v5M12 16h.01" />
      </svg>
      <div className="flex flex-col gap-1.5">
        <p className="m-0 text-[14px] leading-normal" style={{ color: 'var(--heresy-body)' }}>
          Heresy flagged. A sermon tried to instruct {target}. The persuasion score is set to 0 and the faith takes a strike.
        </p>
        {quote ? <q className="heresy-underline font-scripture text-[16px] text-heresy-text">{quote}</q> : null}
      </div>
    </div>
  );
}
