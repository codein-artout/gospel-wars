'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { advanceTicks } from '@/lib/server/actions/tick';
import { useToast } from '../ui/Toast';

/** Admin-only. Same runTick as the cron route and `pnpm tick`. */
export function AdvanceTickButton({ variant = 'button', n = 1, label }: { variant?: 'button' | 'icon'; n?: number; label?: string }) {
  const [pending, start] = useTransition();
  const { show } = useToast();
  const router = useRouter();
  const text = label ?? (n === 1 ? 'Advance tick' : `Run ${n} ticks`);
  const onClick = () =>
    start(async () => {
      const r = await advanceTicks(n);
      show(r.ok ? r.message : r.error, r.ok ? 'info' : 'error');
      router.refresh();
    });
  if (variant === 'icon') {
    return (
      <button type="button" aria-label={text} onClick={onClick} disabled={pending} aria-busy={pending} className="grid h-11 w-11 place-items-center rounded-control border border-gold bg-transparent disabled:opacity-60">
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 4l12 8-12 8z" />
        </svg>
      </button>
    );
  }
  return (
    <button type="button" className="btn btn-secondary" onClick={onClick} disabled={pending} aria-busy={pending}>
      {pending ? 'Advancing…' : text}
    </button>
  );
}
