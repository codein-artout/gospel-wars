'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

/** Polls the lightweight tick endpoint and refreshes the page when a new tick lands. */
export function TickPoller({ tick, intervalMs = 30_000 }: { tick: number; intervalMs?: number }) {
  const router = useRouter();
  const current = useRef(tick);
  useEffect(() => {
    current.current = tick;
  }, [tick]);
  useEffect(() => {
    let stopped = false;
    const poll = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const res = await fetch('/api/tick', { cache: 'no-store' });
        if (!res.ok) return;
        const body = (await res.json()) as { tick?: number };
        if (!stopped && typeof body.tick === 'number' && body.tick > current.current) {
          current.current = body.tick;
          router.refresh();
        }
      } catch {
        // Offline or the server is restarting: try again next interval.
      }
    };
    const id = setInterval(poll, intervalMs);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [router, intervalMs]);
  return null;
}
