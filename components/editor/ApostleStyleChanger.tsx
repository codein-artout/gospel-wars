'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { requestStyleChange } from '@/lib/server/actions/gospel';
import { useToast } from '../ui/Toast';
import { ApostleStylePicker, type ApostleStyleName } from './ApostleStylePicker';

/** Change the apostle's style once per season; applied at the start of the next tick. */
export function ApostleStyleChanger({ faithId, current, pending, changesLeft, apostleName }: { faithId: string; current: ApostleStyleName; pending: ApostleStyleName | null; changesLeft: number; apostleName: string }) {
  const [style, setStyle] = useState<ApostleStyleName>(pending ?? current);
  const [busy, start] = useTransition();
  const { show } = useToast();
  const router = useRouter();
  const locked = changesLeft === 0;
  return (
    <section aria-labelledby="style-h" className="flex flex-col gap-3 rounded-panel border border-edge bg-panel p-5">
      <h2 id="style-h" className="m-0 font-display text-[26px] font-bold">
        {apostleName}, {current.toLowerCase()} apostle
      </h2>
      <p className="m-0 text-[14px] text-muted">
        {pending ? `Becomes ${pending} at the next tick.` : locked ? 'The style already changed this season. It can change again next season.' : 'The style can change once per season. It takes effect at the next tick.'}
      </p>
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-0 flex-[1_1_420px]">
          <ApostleStylePicker value={style} onChange={setStyle} disabled={locked || !!pending} />
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={locked || !!pending || style === current || busy}
          onClick={() =>
            start(async () => {
              const r = await requestStyleChange({ faithId, style });
              show(r.ok ? r.message : r.error, r.ok ? 'info' : 'error');
              router.refresh();
            })
          }
        >
          Change apostle style
        </button>
      </div>
    </section>
  );
}
