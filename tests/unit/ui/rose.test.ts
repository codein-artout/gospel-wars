import { describe, expect, it } from 'vitest';
import { computeRings, innerRingSeats, navigatePane, panePositions, ringCounts, shareBandGradient } from '@/lib/ui/rose';

describe('rose window geometry', () => {
  it('uses the canonical 8/16/24 rings for a world of 48', () => {
    const rings = computeRings(48);
    expect(rings.map((r) => r.count)).toEqual([8, 16, 24]);
    expect(rings.map((r) => r.radius)).toEqual([17, 29, 41]);
    expect(rings.map((r) => r.offset)).toEqual([0, 11.25, 7.5]);
    expect(rings.map((r) => [r.paneWidth, r.paneHeight])).toEqual([
      [5.2, 8.4],
      [4.6, 7.6],
      [4.0, 7.0],
    ]);
  });

  it('places the first inner pane at 12 o’clock and matches the mockup positions', () => {
    const p = panePositions(48);
    expect(p).toHaveLength(48);
    expect(p[0]).toMatchObject({ x: 50, y: 33, angle: 0, ring: 0 });
    // Inner ring pane 2 sits at 3 o'clock.
    expect(p[2]).toMatchObject({ x: 67, y: 50, angle: 90 });
    // First middle-ring pane is offset by 11.25 degrees.
    expect(p[8]!.angle).toBe(11.25);
    expect(p[8]!.x).toBeCloseTo(50 + 29 * Math.sin((11.25 * Math.PI) / 180), 2);
    // First outer pane offset 7.5 degrees, radius 41.
    expect(p[24]!.angle).toBe(7.5);
    expect(p[24]!.y).toBeCloseTo(50 - 41 * Math.cos((7.5 * Math.PI) / 180), 2);
  });

  it('keeps every pane inside the window', () => {
    for (const n of [1, 7, 12, 30, 48, 60, 100, 144]) {
      for (const p of panePositions(n)) {
        expect(p.x).toBeGreaterThan(0);
        expect(p.x).toBeLessThan(100);
        expect(p.y).toBeGreaterThan(0);
        expect(p.y).toBeLessThan(100);
      }
    }
  });

  it('grows each ring by about 1.5x for other world sizes', () => {
    for (const n of [30, 60, 72, 100, 144]) {
      const counts = ringCounts(n);
      expect(counts.reduce((a, b) => a + b, 0)).toBe(n);
      for (let i = 1; i < counts.length - 1; i++) {
        const ratio = counts[i]! / counts[i - 1]!;
        expect(ratio).toBeGreaterThan(1.2);
        expect(ratio).toBeLessThan(1.8);
      }
      expect(counts[counts.length - 1]!).toBeGreaterThanOrEqual(counts[counts.length - 2] ?? 0);
    }
  });

  it('handles tiny and empty worlds', () => {
    expect(ringCounts(0)).toEqual([]);
    expect(ringCounts(5)).toEqual([5]);
    expect(() => ringCounts(-1)).toThrow();
  });

  it('seats bosses in the inner ring', () => {
    expect(innerRingSeats(48)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('navigates with arrow keys within and across rings', () => {
    expect(navigatePane(48, 0, 'ArrowRight')).toBe(1);
    expect(navigatePane(48, 0, 'ArrowLeft')).toBe(7);
    expect(navigatePane(48, 7, 'ArrowRight')).toBe(0);
    // Outward from the 12 o'clock inner pane: the middle ring pane nearest 0 degrees.
    const up = navigatePane(48, 0, 'ArrowUp');
    expect([8, 23]).toContain(up);
    expect(navigatePane(48, up, 'ArrowDown')).toBe(0);
    expect(navigatePane(48, 0, 'ArrowDown')).toBe(0);
    expect(navigatePane(48, 30, 'Home')).toBe(0);
    expect(navigatePane(48, 3, 'End')).toBe(47);
    expect(navigatePane(48, 3, 'x')).toBe(3);
  });

  it('builds the share band from fractions', () => {
    expect(shareBandGradient([{ color: '#000', share: 0.5 }, { color: '#fff', share: 0.5 }])).toBe(
      'conic-gradient(#000 0.00% 50.00%, #fff 50.00% 100.00%)',
    );
    expect(shareBandGradient([])).toContain('glass-unaligned');
  });
});
