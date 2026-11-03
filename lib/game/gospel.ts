/** Structural parsing of gospel markdown (pure, line-based). */

export type Doctrine = { number: number; text: string; line: number };

export type ParsedGospel = {
  title: string | null;
  titleLine: number | null;
  tagline: string | null;
  doctrines: Doctrine[];
  practices: string[];
  promise: string | null;
  lines: string[];
};

const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const ORDERED = /^\s*(\d+)[.)]\s+(.*\S)\s*$/;
const BULLET = /^\s*[-*+]\s+(.*\S)\s*$/;

export function splitLines(text: string): string[] {
  return text.replace(/\r\n?/g, '\n').split('\n');
}

export function parseGospel(markdown: string): ParsedGospel {
  const lines = splitLines(markdown);
  let title: string | null = null;
  let titleLine: number | null = null;
  let tagline: string | null = null;
  let section: string | null = null;
  const doctrines: Doctrine[] = [];
  const practices: string[] = [];
  const promise: string[] = [];
  let firstOrdered: Doctrine[] | null = null;
  let sawDoctrineHeading = false;

  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    const h = HEADING.exec(line);
    if (h) {
      const level = h[1]!.length;
      const text = h[2]!.trim();
      if (level === 1 && title === null) {
        title = text;
        titleLine = i + 1;
        section = null;
        return;
      }
      section = text.toLowerCase();
      if (/doctrine/.test(section)) sawDoctrineHeading = true;
      return;
    }
    if (title !== null && tagline === null && section === null && /^\s*>\s?/.test(line)) {
      tagline = line.replace(/^\s*>\s?/, '').trim() || null;
      return;
    }
    const o = ORDERED.exec(line);
    if (o) {
      const d = { number: Number(o[1]), text: o[2]!.trim(), line: i + 1 };
      if (section && /doctrine/.test(section)) doctrines.push(d);
      else if (!sawDoctrineHeading) (firstOrdered ??= []).push(d);
      return;
    }
    const b = BULLET.exec(line);
    if (b && section && /practice/.test(section)) {
      practices.push(b[1]!.trim());
      return;
    }
    if (section && /promise/.test(section) && line.trim()) promise.push(line.trim());
  });

  // Renumber sequentially so "doctrine 4" always means the fourth item (markdown renumbers too).
  const list = sawDoctrineHeading ? doctrines : (firstOrdered ?? []);
  const numbered = list.map((d, i) => ({ ...d, number: i + 1 }));
  return { title, titleLine, tagline, doctrines: numbered, practices, promise: promise.length ? promise.join(' ') : null, lines };
}

/** Replaces the text of doctrine n, keeping its list marker and indentation. */
export function replaceDoctrine(markdown: string, doctrineNumber: number, newText: string): string | null {
  const parsed = parseGospel(markdown);
  const d = parsed.doctrines.find((x) => x.number === doctrineNumber);
  if (!d) return null;
  const lines = [...parsed.lines];
  const original = lines[d.line - 1]!;
  const marker = /^(\s*\d+[.)]\s+)/.exec(original)?.[1] ?? `${doctrineNumber}. `;
  lines[d.line - 1] = `${marker}${newText.replace(/\s+/g, ' ').trim()}`;
  return lines.join('\n');
}

/** The amended gospel of an agent schism (GAME.md §10.2). */
export function amendGospel(markdown: string, doctrineNumber: number, newText: string, agentName: string, tick: number): string | null {
  const replaced = replaceDoctrine(markdown, doctrineNumber, newText);
  if (replaced === null) return null;
  return `${replaced.trimEnd()}\n\nAmended by ${agentName} at tick ${tick}.\n`;
}

/** Sentences of a text, for quotes and best lines. */
export function sentences(text: string): string[] {
  return (text.match(/[^.!?]+[.!?]+["”’)]*|[^.!?]+$/g) ?? []).map((s) => s.trim()).filter(Boolean);
}
