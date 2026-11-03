import { readFile } from 'node:fs/promises';
import path from 'node:path';

type FontDef = { name: string; data: ArrayBuffer; weight: 400 | 700 | 800; style: 'normal' | 'italic' };

const FILES: { name: string; pkg: string; file: string; weight: 400 | 700 | 800; style: 'normal' | 'italic' }[] = [
  { name: 'Grenze Gotisch', pkg: 'grenze-gotisch', file: 'grenze-gotisch-latin-700-normal.woff', weight: 700, style: 'normal' },
  { name: 'Grenze Gotisch', pkg: 'grenze-gotisch', file: 'grenze-gotisch-latin-800-normal.woff', weight: 800, style: 'normal' },
  { name: 'Instrument Sans', pkg: 'instrument-sans', file: 'instrument-sans-latin-400-normal.woff', weight: 400, style: 'normal' },
  { name: 'Instrument Sans', pkg: 'instrument-sans', file: 'instrument-sans-latin-700-normal.woff', weight: 700, style: 'normal' },
  { name: 'Spectral', pkg: 'spectral', file: 'spectral-latin-400-italic.woff', weight: 400, style: 'italic' },
];

let cache: Promise<FontDef[]> | null = null;

/** Self-hosted Fontsource files (no network font fetches at build or render time). */
export function cardFonts(): Promise<FontDef[]> {
  cache ??= Promise.all(
    FILES.map(async (f) => {
      const buf = await readFile(path.join(/* turbopackIgnore: true */ process.cwd(), 'node_modules', '@fontsource', f.pkg, 'files', f.file));
      return { name: f.name, weight: f.weight, style: f.style, data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer };
    }),
  ).catch((e: unknown) => {
    cache = null;
    throw e;
  });
  return cache;
}
