'use client';

import { useState } from 'react';
import { ApostleStylePicker, type ApostleStyleName } from '@/components/editor/ApostleStylePicker';
import { GlassColorPicker } from '@/components/editor/GlassColorPicker';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { ToastProvider, useToast } from '@/components/ui/Toast';
import { RoseWindow, RoseWindowList, type RosePane } from '@/components/world/RoseWindow';
import { SelectedAgentPanel } from '@/components/world/SelectedAgentPanel';
import { SAMPLE_FAITHS, sampleAgents, sampleShares } from './samples';

export function RoseDemo() {
  const [agents, setAgents] = useState<RosePane[]>(() => sampleAgents());
  const [selected, setSelected] = useState<string>(agents[1]!.id);
  const [tick, setTick] = useState(142);
  const sel = agents.find((a) => a.id === selected) ?? null;
  function convertThree() {
    setTick((t) => t + 1);
    setAgents((xs) => {
      const next = xs.map((a) => ({ ...a }));
      for (let k = 0; k < 3; k++) {
        const i = (tick * 7 + k * 13) % next.length;
        const a = next[i]!;
        if (a.isBoss) continue;
        const f = SAMPLE_FAITHS[(tick + k) % SAMPLE_FAITHS.length]!;
        if (a.faithId === f.id) continue;
        next[i] = { ...a, faithId: f.id, faithName: f.name, color: f.color };
      }
      return next;
    });
  }
  return (
    <div className="flex flex-wrap items-start gap-7">
      <div className="flex min-w-0 flex-[3_1_520px] flex-col items-center gap-3.5">
        <RoseWindow agents={agents} shares={sampleShares(agents)} tick={tick} selectedId={selected} onSelect={setSelected} />
        <RoseWindowList agents={agents} />
        <button type="button" className="btn btn-secondary" onClick={convertThree}>
          Advance tick (demo pulse)
        </button>
      </div>
      <div className="flex min-w-0 flex-[2_1_320px] flex-col gap-5">
        <SelectedAgentPanel
          agent={
            sel
              ? {
                  id: sel.id,
                  slug: sel.slug,
                  name: sel.name,
                  faithLabel: sel.isBoss ? 'Boss skeptic, unconverted' : sel.faithName,
                  color: sel.color,
                  isBoss: sel.isBoss,
                  persona: 'Retired lighthouse keeper. Trusts routine, distrusts urgency.',
                  conviction: 81,
                  skepticism: 54,
                  memory: 'The Kettle sermon about waiting was the first thing that made sense this season.',
                }
              : null
          }
        />
        <SelectedAgentPanel agent={null} />
      </div>
    </div>
  );
}

export function ControlsDemo() {
  const [season, setSeason] = useState<'season' | 'all'>('season');
  const [style, setStyle] = useState<ApostleStyleName>('Scholar');
  const [glass, setGlass] = useState<string | null>('#2F5FD8');
  return (
    <div className="flex flex-wrap items-end gap-6">
      <SegmentedControl
        label="Season"
        mode="pressed"
        value={season}
        onChange={setSeason}
        options={[
          { value: 'season', label: 'Season 1' },
          { value: 'all', label: 'All time' },
        ]}
      />
      <GlassColorPicker
        value={glass}
        onChange={setGlass}
        options={[
          { name: 'Cobalt', hex: '#2F5FD8', taken: false },
          { name: 'Amber', hex: '#EDA53A', taken: true },
          { name: 'Ruby', hex: '#D8435F', taken: false },
          { name: 'Violet', hex: '#A57BEA', taken: true },
          { name: 'Emerald', hex: '#2DA877', taken: false },
          { name: 'Teal', hex: '#24A3B5', taken: false },
        ]}
      />
      <div className="min-w-[420px] flex-1">
        <ApostleStylePicker value={style} onChange={setStyle} />
      </div>
    </div>
  );
}

function ToastButton() {
  const { show } = useToast();
  return (
    <div className="flex gap-3">
      <button type="button" className="btn btn-quiet" onClick={() => show('Tick 143 done. 3 conversions.')}>
        Show toast
      </button>
      <button type="button" className="btn btn-quiet" onClick={() => show('This gospel is 1,612 tokens. Trim 112 to publish.', 'error')}>
        Show error toast
      </button>
    </div>
  );
}

export function ToastDemo() {
  return (
    <ToastProvider>
      <ToastButton />
    </ToastProvider>
  );
}
