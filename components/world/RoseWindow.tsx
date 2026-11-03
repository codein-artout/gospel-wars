'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { navigatePane, panePositions, shareBandGradient, type ShareSegment } from '@/lib/ui/rose';

export type RosePane = {
  id: string;
  slug: string;
  name: string;
  /** Faith id, or null for Unaligned. */
  faithId: string | null;
  faithName: string;
  color: string;
  isBoss: boolean;
  /** The agent's faith was founded by an agent: dashed gold lead. */
  agentFounded?: boolean;
};

type Props = {
  agents: RosePane[];
  shares: ShareSegment[];
  tick: number;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  /** Compact lead widths for the phone layout. */
  compact?: boolean;
  label?: string;
};

const STAGGER_MS = 120;
const PULSE_MS = 1200;
const REDUCED_OUTLINE_MS = 2000;
const BAND_EASE_MS = 600;

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return reduced;
}

/** Eases the outer band's share segments over 600ms when they change. */
function useEasedShares(shares: ShareSegment[], reduced: boolean): ShareSegment[] {
  const [shown, setShown] = useState(shares);
  const fromRef = useRef(shares);
  const key = shares.map((s) => `${s.color}:${s.share.toFixed(4)}`).join('|');
  useEffect(() => {
    const from = fromRef.current;
    const to = shares;
    const sameShape = from.length === to.length && from.every((s, i) => s.color === to[i]?.color);
    if (reduced || !sameShape) {
      fromRef.current = to;
      setShown(to);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / BAND_EASE_MS);
      const e = 1 - (1 - t) ** 3;
      setShown(to.map((s, i) => ({ color: s.color, share: from[i]!.share + (s.share - from[i]!.share) * e })));
      if (t < 1) raf = requestAnimationFrame(step);
      else fromRef.current = to;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the serialized shares
  }, [key, reduced]);
  return shown;
}

export function RoseWindow({ agents, shares, tick, selectedId, onSelect, compact, label = 'Rose window of the world' }: Props) {
  const router = useRouter();
  const reduced = usePrefersReducedMotion();
  const positions = useMemo(() => panePositions(agents.length), [agents.length]);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const [focusIndex, setFocusIndex] = useState(0);
  const [pulsing, setPulsing] = useState<Set<string>>(new Set());
  const prevFaith = useRef<Map<string, string | null> | null>(null);
  const band = useEasedShares(shares, reduced);

  // Detect conversions between renders (a new tick landed) and pulse those panes.
  useEffect(() => {
    const prev = prevFaith.current;
    const next = new Map(agents.map((a) => [a.id, a.faithId]));
    prevFaith.current = next;
    if (!prev) return;
    const changed = agents.filter((a) => prev.has(a.id) && prev.get(a.id) !== a.faithId).map((a) => a.id);
    if (changed.length === 0) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    changed.forEach((id, i) => {
      const delay = reduced ? 0 : i * STAGGER_MS;
      timers.push(
        setTimeout(() => setPulsing((s) => new Set(s).add(id)), delay),
        setTimeout(
          () =>
            setPulsing((s) => {
              const n = new Set(s);
              n.delete(id);
              return n;
            }),
          delay + (reduced ? REDUCED_OUTLINE_MS : PULSE_MS),
        ),
      );
    });
    return () => timers.forEach(clearTimeout);
  }, [agents, reduced]);

  const selectedIndex = agents.findIndex((a) => a.id === selectedId);
  const tabbable = selectedIndex >= 0 ? selectedIndex : focusIndex;

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (e.key === 'Enter') {
      const a = agents[index];
      if (a) {
        e.preventDefault();
        router.push(`/a/${a.slug}`);
      }
      return;
    }
    const next = navigatePane(agents.length, index, e.key);
    if (next !== index) {
      e.preventDefault();
      setFocusIndex(next);
      buttons.current[next]?.focus();
      const a = agents[next];
      if (a) onSelect?.(a.id);
    }
  }

  const leadW = compact ? 2 : 3;

  return (
    <div
      className="relative aspect-square w-full max-w-[660px]"
      style={{ containerType: 'inline-size' }}
      role="group"
      aria-label={label}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 rounded-full"
        style={{ background: shareBandGradient(band), border: '3px solid var(--lead)' }}
      />
      <div
        aria-hidden="true"
        className="absolute rounded-full"
        style={{ inset: '3.2%', background: 'var(--nave-well)', border: '3px solid var(--lead)' }}
      />
      {!compact ? (
        <>
          <div aria-hidden="true" className="absolute rounded-full" style={{ inset: '15%', border: '2px solid var(--ring-line)' }} />
          <div aria-hidden="true" className="absolute rounded-full" style={{ inset: '27%', border: '2px solid var(--ring-line)' }} />
        </>
      ) : null}
      {agents.map((a, i) => {
        const p = positions[i];
        if (!p) return null;
        const selected = a.id === selectedId;
        const isPulsing = pulsing.has(a.id);
        const unconvertedBoss = a.isBoss && a.faithId === null;
        const border = a.isBoss
          ? `${leadW}px double var(--gold)`
          : a.agentFounded
            ? `${leadW}px dashed var(--gold)`
            : `${leadW}px solid var(--lead)`;
        const ariaFaith = a.isBoss
          ? unconvertedBoss
            ? 'boss skeptic, unconverted'
            : `boss skeptic, converted to ${a.faithName}`
          : a.faithName;
        return (
          <button
            key={a.id}
            ref={(el) => {
              buttons.current[i] = el;
            }}
            type="button"
            data-agent-id={a.id}
            aria-label={`${a.name}, ${ariaFaith}`}
            aria-pressed={selected}
            tabIndex={i === tabbable ? 0 : -1}
            onClick={() => {
              setFocusIndex(i);
              onSelect?.(a.id);
            }}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={`absolute cursor-pointer p-0 ${isPulsing ? 'pane-pulse' : ''}`}
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: `${p.width}%`,
              height: `${p.height}%`,
              transform: `translate(-50%, -50%) rotate(${p.angle}deg)`,
              borderRadius: compact ? 'var(--lancet-sm)' : 'var(--lancet)',
              border,
              background: unconvertedBoss ? 'linear-gradient(160deg, var(--boss-a), var(--boss-b))' : a.color,
              transition: reduced ? 'none' : 'background 600ms ease, box-shadow 600ms ease',
              boxShadow: !isPulsing && selected ? '0 0 0 3px var(--text)' : undefined,
              boxSizing: 'border-box',
            }}
          />
        );
      })}
      <div
        className="absolute left-1/2 top-1/2 flex h-[20%] w-[20%] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-0.5 rounded-full"
        style={{ border: '3px solid var(--gold)', background: 'var(--medallion)' }}
      >
        <span className="font-display leading-none text-gold" style={{ fontSize: 'clamp(18px, 6cqw, 40px)' }}>
          {tick}
        </span>
        {!compact ? <span className="text-[12px] text-muted">tick</span> : <span className="sr-only">tick</span>}
      </div>
    </div>
  );
}

/** Visually hidden text alternative: agents listed by faith. */
export function RoseWindowList({ agents }: { agents: RosePane[] }) {
  const groups = new Map<string, RosePane[]>();
  for (const a of agents) {
    const key = a.isBoss && a.faithId === null ? 'Boss skeptics, unconverted' : a.faithName;
    const list = groups.get(key) ?? [];
    list.push(a);
    groups.set(key, list);
  }
  return (
    <div className="sr-only">
      <h2>Agents by faith</h2>
      <ul>
        {[...groups.entries()].map(([faith, list]) => (
          <li key={faith}>
            {faith}: {list.length} {list.length === 1 ? 'agent' : 'agents'}.{' '}
            <ul>
              {list.map((a) => (
                <li key={a.id}>
                  <a href={`/a/${a.slug}`}>{a.name}</a>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
