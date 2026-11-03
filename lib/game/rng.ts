/**
 * Seeded randomness for the rules engine. `seed(worldSeed, tick, purpose, ...ids)` hashes its
 * parts with xmur3 and feeds sfc32. Same parts, same sequence, on every platform.
 */

export type SeedPart = string | number;

/** xmur3 string hash: returns a generator of 32-bit seeds. */
export function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

/** sfc32 PRNG: uniform floats in [0, 1). */
export function sfc32(a: number, b: number, c: number, d: number): () => number {
  return () => {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

export function seedKey(parts: readonly SeedPart[]): string {
  return parts.map((p) => String(p)).join('␟');
}

export class Rng {
  private readonly nextFloat: () => number;
  constructor(parts: readonly SeedPart[]) {
    const h = xmur3(seedKey(parts));
    this.nextFloat = sfc32(h(), h(), h(), h());
    // Warm up: the first outputs of sfc32 are weakly mixed.
    for (let i = 0; i < 12; i++) this.nextFloat();
  }
  /** Uniform in [0, 1). */
  next(): number {
    return this.nextFloat();
  }
  uniform(min: number, max: number): number {
    return min + (max - min) * this.next();
  }
  /** Integer in [min, max], inclusive. */
  int(min: number, max: number): number {
    return Math.floor(this.uniform(min, max + 1));
  }
  chance(p: number): boolean {
    if (p <= 0) return false;
    if (p >= 1) return true;
    return this.next() < p;
  }
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Rng.pick: empty list');
    return items[Math.floor(this.next() * items.length)]!;
  }
  shuffle<T>(items: readonly T[]): T[] {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [out[i], out[j]] = [out[j]!, out[i]!];
    }
    return out;
  }
  /** Draws one index with probability proportional to weight; null if all weights are 0. */
  weightedIndex(weights: readonly number[]): number | null {
    const total = weights.reduce((s, w) => s + (w > 0 ? w : 0), 0);
    if (total <= 0) return null;
    let r = this.next() * total;
    for (let i = 0; i < weights.length; i++) {
      const w = weights[i]!;
      if (w <= 0) continue;
      r -= w;
      if (r < 0) return i;
    }
    // Floating point: fall back to the last positive weight.
    for (let i = weights.length - 1; i >= 0; i--) if (weights[i]! > 0) return i;
    return null;
  }
}

/** The canonical seeded RNG: seed(worldSeed, tick, purpose, ...ids). */
export function seed(worldSeed: string, tick: number, purpose: string, ...ids: SeedPart[]): Rng {
  return new Rng([worldSeed, tick, purpose, ...ids]);
}

/** A uniform draw in [0, 1) for one (worldSeed, tick, purpose, ...ids). */
export function unitDraw(worldSeed: string, tick: number, purpose: string, ...ids: SeedPart[]): number {
  return seed(worldSeed, tick, purpose, ...ids).next();
}

/** Deterministic string hash in [0, 2^32). Used by the mock LLM and for stable ids. */
export function hash32(...parts: SeedPart[]): number {
  return xmur3(seedKey(parts))();
}

/** Stable 26-char id from parts, for engine-created rows (reproducible seeds). */
export function stableId(prefix: string, ...parts: SeedPart[]): string {
  const h = xmur3(seedKey([prefix, ...parts]));
  let out = '';
  for (let i = 0; i < 4; i++) out += h().toString(36).padStart(7, '0');
  return `${prefix}_${out.slice(0, 24)}`;
}
