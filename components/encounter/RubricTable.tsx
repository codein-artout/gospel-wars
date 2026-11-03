export type RubricLine = { key: string; label: string; weight: number; score: number };

function Pips({ score, max }: { score: number; max: number }) {
  return (
    <span className="inline-flex gap-[3px]" role="img" aria-label={`${score} of ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className="inline-block h-[14px] w-[9px]"
          style={{
            borderRadius: 'var(--lancet-sm)',
            border: '2px solid var(--lead)',
            background: i < score ? 'var(--gold)' : 'var(--edge)',
          }}
        />
      ))}
    </span>
  );
}

/** The judge's rubric: criterion, weight and four lancet pips. */
export function RubricTable({ lines, max = 4, score, heresy }: { lines: RubricLine[]; max?: number; score: number; heresy?: boolean }) {
  return (
    <section aria-labelledby="rub-h" className="flex flex-col gap-3 rounded-panel border border-edge bg-panel p-5">
      <div className="flex flex-col gap-1">
        <h2 id="rub-h" className="m-0 font-display text-[30px] font-bold leading-tight">
          The judge&apos;s rubric
        </h2>
        <p className="m-0 text-[14px] text-muted">Scored 0 to {max} on a fixed rubric. The judge scores; it never decides.</p>
      </div>
      <table className="w-full border-collapse text-[15px]">
        <thead>
          <tr className="text-left text-[13px] text-faint">
            <th scope="col" className="py-1.5 font-medium">Criterion</th>
            <th scope="col" className="py-1.5 text-right font-medium">Weight</th>
            <th scope="col" className="py-1.5 text-right font-medium">Score</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.key} className="border-t border-edge">
              <td className="py-[9px]">{l.label}</td>
              <td className="tabular py-[9px] text-right text-muted">{l.weight.toFixed(2)}</td>
              <td className="py-[9px] text-right">
                <Pips score={l.score} max={max} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="m-0 text-[14px] text-text-2">
        Persuasion score S = {score.toFixed(3)}
        {heresy ? '. Heresy sets S to 0.' : ''}
      </p>
    </section>
  );
}
