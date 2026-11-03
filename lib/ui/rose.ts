/**
 * Rose-window geometry (design/mockups/source/Main.dc.html). Pure and framework-free.
 *
 * Canonical world of 48: rings of 8, 16 and 24 panes at radii 17%, 29% and 41% of the
 * diameter, offsets 0°, 11.25° and 7.5°, pane sizes 5.2×8.4, 4.6×7.6 and 4.0×7.0 (% of the diameter).
 * Other sizes: each ring holds about 1.5× the previous one.
 */

export type Ring = {
  count: number;
  /** Distance of pane centers from the window center, as % of the diameter. */
  radius: number;
  /** Angular offset of the first pane, degrees clockwise from 12 o'clock. */
  offset: number;
  /** Pane width and height as % of the diameter. */
  paneWidth: number;
  paneHeight: number;
};

export type PanePosition = {
  index: number;
  ring: number;
  indexInRing: number;
  /** Center, as % of the diameter from the top-left corner. */
  x: number;
  y: number;
  /** Rotation in degrees. */
  angle: number;
  width: number;
  height: number;
};

const CANONICAL: readonly Ring[] = [
  { count: 8, radius: 17, offset: 0, paneWidth: 5.2, paneHeight: 8.4 },
  { count: 16, radius: 29, offset: 11.25, paneWidth: 4.6, paneHeight: 7.6 },
  { count: 24, radius: 41, offset: 7.5, paneWidth: 4.0, paneHeight: 7.0 },
];

const RING_RATIO = 1.5;
const INNER_RADIUS = 17;
const OUTER_RADIUS = 41;

/** Splits n panes into rings, each holding about RING_RATIO× the previous one. */
export function ringCounts(n: number): number[] {
  if (!Number.isInteger(n) || n < 0) throw new Error(`ringCounts: invalid pane count ${n}`);
  if (n === 0) return [];
  if (n === 48) return CANONICAL.map((r) => r.count);
  if (n <= 8) return [n];
  // Pick the ring count whose first ring is closest to 8 panes (the canonical inner ring).
  let best: number[] = [n];
  let bestScore = Number.POSITIVE_INFINITY;
  for (let rings = 1; rings <= 6; rings++) {
    let geometric = 0;
    for (let i = 0; i < rings; i++) geometric += RING_RATIO ** i;
    const first = n / geometric;
    if (first < 3) break;
    const counts: number[] = [];
    let assigned = 0;
    for (let i = 0; i < rings - 1; i++) {
      const c = Math.max(1, Math.round(first * RING_RATIO ** i));
      counts.push(c);
      assigned += c;
    }
    counts.push(n - assigned);
    if (counts.some((c) => c < 1)) continue;
    const score = Math.abs(first - 8) + (counts[counts.length - 1]! < counts[counts.length - 2]! ? 100 : 0);
    if (score < bestScore) {
      bestScore = score;
      best = counts;
    }
  }
  return best;
}

export function computeRings(n: number): Ring[] {
  if (n === 48) return CANONICAL.map((r) => ({ ...r }));
  const counts = ringCounts(n);
  const k = counts.length;
  return counts.map((count, i) => {
    const radius = k === 1 ? (INNER_RADIUS + OUTER_RADIUS) / 2 : INNER_RADIUS + ((OUTER_RADIUS - INNER_RADIUS) * i) / (k - 1);
    // Pane size shrinks gently outward and with crowding, never wider than the arc allows.
    const arc = (2 * Math.PI * radius) / count;
    const paneWidth = Math.min(5.2 - 0.6 * i, arc * 0.62);
    const paneHeight = Math.min(8.4 - 0.7 * i, 12 / Math.max(1, k - 1));
    return {
      count,
      radius,
      offset: i === 0 ? 0 : 180 / count,
      paneWidth: round(paneWidth, 2),
      paneHeight: round(paneHeight, 2),
    };
  });
}

export function panePositions(n: number): PanePosition[] {
  const rings = computeRings(n);
  const out: PanePosition[] = [];
  let index = 0;
  rings.forEach((ring, r) => {
    for (let i = 0; i < ring.count; i++) {
      const angle = (i / ring.count) * 360 + ring.offset;
      const rad = (angle * Math.PI) / 180;
      out.push({
        index,
        ring: r,
        indexInRing: i,
        x: round(50 + ring.radius * Math.sin(rad), 2),
        y: round(50 - ring.radius * Math.cos(rad), 2),
        angle: round(angle, 2),
        width: ring.paneWidth,
        height: ring.paneHeight,
      });
      index++;
    }
  });
  return out;
}

/** Indices (into the flat pane list) of the inner ring, where bosses are seated. */
export function innerRingSeats(n: number): number[] {
  const first = computeRings(n)[0];
  if (!first) return [];
  return Array.from({ length: first.count }, (_, i) => i);
}

/** Keyboard navigation between panes. Returns the next flat index. */
export function navigatePane(n: number, from: number, key: string): number {
  const panes = panePositions(n);
  const cur = panes[from];
  if (!cur) return 0;
  const ringPanes = panes.filter((p) => p.ring === cur.ring);
  switch (key) {
    case 'ArrowRight': {
      const next = ringPanes[(cur.indexInRing + 1) % ringPanes.length]!;
      return next.index;
    }
    case 'ArrowLeft': {
      const next = ringPanes[(cur.indexInRing - 1 + ringPanes.length) % ringPanes.length]!;
      return next.index;
    }
    case 'ArrowUp':
    case 'ArrowDown': {
      // Up moves outward, down moves inward, to the nearest angle on that ring.
      const targetRing = cur.ring + (key === 'ArrowUp' ? 1 : -1);
      const candidates = panes.filter((p) => p.ring === targetRing);
      if (candidates.length === 0) return from;
      let best = candidates[0]!;
      let bestDelta = Number.POSITIVE_INFINITY;
      for (const p of candidates) {
        const d = angularDistance(p.angle, cur.angle);
        if (d < bestDelta - 1e-9) {
          bestDelta = d;
          best = p;
        }
      }
      return best.index;
    }
    case 'Home':
      return 0;
    case 'End':
      return panes.length - 1;
    default:
      return from;
  }
}

function angularDistance(a: number, b: number): number {
  const d = Math.abs(((a - b) % 360) + 360) % 360;
  return Math.min(d, 360 - d);
}

function round(v: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}

export type ShareSegment = { color: string; share: number };

/** The conic-gradient for the outer flock-share band. Shares are fractions that sum to about 1. */
export function shareBandGradient(segments: ShareSegment[]): string {
  const total = segments.reduce((s, x) => s + Math.max(0, x.share), 0);
  if (total <= 0) return 'conic-gradient(var(--glass-unaligned) 0% 100%)';
  let acc = 0;
  const stops = segments
    .filter((s) => s.share > 0)
    .map((s) => {
      const p = (Math.max(0, s.share) / total) * 100;
      const stop = `${s.color} ${acc.toFixed(2)}% ${(acc + p).toFixed(2)}%`;
      acc += p;
      return stop;
    });
  return `conic-gradient(${stops.join(', ')})`;
}
