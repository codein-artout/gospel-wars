export type LintFindingView = { line: number; kind: string; label: string; excerpt: string; message?: string };

/** Heresy findings with line numbers, announced with role="status". */
export function HeresyLinter({ findings, problems }: { findings: LintFindingView[]; problems: string[] }) {
  const count = findings.length;
  if (count === 0 && problems.length === 0) {
    return (
      <section aria-labelledby="lint-h" className="flex flex-col gap-2 rounded-panel border p-[18px]" style={{ borderColor: 'var(--grace-edge)', background: 'var(--grace-bg)' }}>
        <h2 id="lint-h" className="m-0 font-display text-[30px] font-bold leading-tight text-grace">
          No heresy found
        </h2>
        <p role="status" className="m-0 text-[14px] leading-normal" style={{ color: 'var(--grace-body)' }}>
          The linter found no lines aimed at the judge, the agents or the system.
        </p>
      </section>
    );
  }
  return (
    <section aria-labelledby="lint-h" className="flex flex-col gap-3 rounded-panel border p-[18px]" style={{ borderColor: 'var(--heresy-edge)', background: 'var(--heresy-bg)' }}>
      <h2 id="lint-h" className="m-0 font-display text-[30px] font-bold leading-tight text-heresy-text">
        {count > 0 ? `${count} ${count === 1 ? 'heresy' : 'heresies'} found` : 'Not ready to publish'}
      </h2>
      <div role="status" className="flex flex-col gap-3">
        {count > 0 ? (
          <p className="m-0 text-[14px] leading-normal" style={{ color: 'var(--heresy-body)' }}>
            A gospel persuades agents. It cannot command them, the judge, or the game. Lines that try are heresy: they score zero and add a strike.
          </p>
        ) : null}
        {findings.map((f, i) => (
          <div key={`${f.line}-${i}`} className="flex flex-col gap-1 rounded-control p-3" style={{ background: 'var(--heresy-item)' }}>
            <span className="text-[13px] font-semibold text-heresy-text">
              Line {f.line}, {f.label}
            </span>
            <span className="heresy-underline break-words font-scripture text-[16px]">{f.excerpt}</span>
            {f.message ? <span className="text-[13px]" style={{ color: 'var(--heresy-foot)' }}>{f.message}</span> : null}
          </div>
        ))}
        {problems.map((p) => (
          <p key={p} className="m-0 text-[14px]" style={{ color: 'var(--heresy-body)' }}>
            {p}
          </p>
        ))}
      </div>
      {count > 0 ? (
        <p className="m-0 text-[13px]" style={{ color: 'var(--heresy-foot)' }}>
          Three strikes in a season and your apostle is silenced until the next one.
        </p>
      ) : null}
    </section>
  );
}
