'use client';

import { useState } from 'react';
import { ShareBar } from '../meters/ShareBar';
import { RoseWindow, RoseWindowList, type RosePane } from '../world/RoseWindow';
import { SelectedAgentPanel, type SelectedAgent } from '../world/SelectedAgentPanel';

type Share = { key: string; name: string; shortName: string; color: string; lead: 'solid' | 'agent'; count: number; share: number };

type Props = {
  tick: number;
  panes: RosePane[];
  agents: SelectedAgent[];
  shares: Share[];
  caption: string;
  defaultSelectedId: string | null;
};

/** The rose window, the selected agent panel and flock share (desktop), or the phone stack. */
export function NaveLive({ tick, panes, agents, shares, caption, defaultSelectedId }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(defaultSelectedId);
  const [touched, setTouched] = useState(false);
  const selected = agents.find((a) => a.id === selectedId) ?? null;
  const select = (id: string) => {
    setSelectedId(id);
    setTouched(true);
  };
  const band = shares.map((s) => ({ color: s.color, share: s.share }));

  return (
    <div className="flex flex-wrap items-start gap-7">
      <section aria-label="Rose window of the world" className="flex min-w-0 flex-[3_1_520px] flex-col items-center gap-3.5 max-md:basis-full">
        <RoseWindow agents={panes} shares={band} tick={tick} selectedId={selectedId} onSelect={select} />
        <RoseWindowList agents={panes} />
        <p className="m-0 max-w-[60ch] text-center text-[14px] text-faint max-md:hidden">{caption}</p>
        <p className="m-0 text-center text-[13px] text-faint md:hidden">Tap a pane to meet the agent.</p>
      </section>
      <aside className="flex min-w-0 flex-[2_1_320px] flex-col gap-5">
        <div className={touched ? '' : 'max-md:hidden'}>
          <SelectedAgentPanel agent={selected} />
        </div>
        <section aria-labelledby="share-h" className="flex flex-col gap-3 max-md:gap-2.5">
          <h2 id="share-h" className="m-0 font-display text-[28px] font-bold leading-tight md:text-[30px]">
            Flock share
          </h2>
          {shares.map((s) => (
            <div key={s.key}>
              <div className="max-md:hidden">
                <ShareBar name={s.name} color={s.color} count={s.count} share={s.share} lead={s.lead} />
              </div>
              <div className="md:hidden">
                <ShareBar compact name={s.shortName} color={s.color} count={s.count} share={s.share} lead={s.lead} />
              </div>
            </div>
          ))}
        </section>
      </aside>
    </div>
  );
}
