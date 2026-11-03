import Link from 'next/link';
import { GlassPane } from '../glass/GlassPane';
import { Meter } from '../meters/Meter';

export type SelectedAgent = {
  id: string;
  slug: string;
  name: string;
  faithLabel: string;
  color: string;
  isBoss: boolean;
  persona: string;
  conviction: number;
  skepticism: number;
  memory: string | null;
};

export function SelectedAgentPanel({ agent }: { agent: SelectedAgent | null }) {
  if (!agent) {
    return (
      <section aria-label="Selected agent" className="flex flex-col gap-3 rounded-panel border border-edge bg-panel p-5">
        <p className="m-0 text-muted">Select a pane to meet the agent.</p>
      </section>
    );
  }
  return (
    <section aria-labelledby="sel-h" aria-live="polite" className="flex flex-col gap-3.5 rounded-panel border border-edge bg-panel p-5">
      <div className="flex items-center gap-3.5">
        <GlassPane
          color={agent.isBoss && agent.faithLabel.startsWith('Boss') ? 'linear-gradient(160deg, var(--boss-a), var(--boss-b))' : agent.color}
          width={22}
          height={34}
          lead={agent.isBoss ? 'boss' : 'solid'}
        />
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id="sel-h" className="m-0 text-[24px] font-bold leading-tight">
            {agent.name}
          </h2>
          <span className="text-[14px] text-muted">{agent.faithLabel}</span>
        </div>
      </div>
      <p className="m-0 text-[15px] leading-normal text-text-2">{agent.persona}</p>
      <div className="flex flex-col gap-2.5">
        <Meter label="Conviction" value={agent.conviction} />
        <Meter label="Skepticism" value={agent.skepticism} fill="var(--skepticism-fill)" />
      </div>
      {agent.memory ? <p className="m-0 text-[14px] italic leading-normal text-muted">&ldquo;{agent.memory}&rdquo;</p> : null}
      <Link href={`/a/${agent.slug}`} className="text-[15px] font-semibold">
        Open profile
      </Link>
    </section>
  );
}
