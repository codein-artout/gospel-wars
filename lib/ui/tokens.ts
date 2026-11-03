/**
 * Hex mirrors of the DESIGN.md tokens in app/globals.css, for renderers that cannot read CSS
 * variables (the next/og card renderer). Components use the CSS variables, never these.
 */
export const OG = {
  nave: '#191430',
  lead: '#0E0A1E',
  text: '#F3EFFA',
  text2: '#E4DEF2',
  muted: '#C9C0E3',
  edge: '#3A3163',
  gold: '#E7BE57',
  goldBright: '#F6D98E',
  onGold: '#1C1430',
} as const;

/** Mixes a hex color toward white (amount > 0) or black (amount < 0). */
export function shade(hex: string, amount: number): string {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.round(amount >= 0 ? c + (255 - c) * amount : c * (1 + amount)));
  return `#${ch.map((c) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0')).join('')}`;
}
